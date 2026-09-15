'use strict';
const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, parseJSON, makeBookingCode, assertElderOwner, canAccessBooking, calcAmount } = require('../utils');

const BOOKING_SELECT = `
  SELECT b.*,
         e.full_name AS elder_name, e.birth_year AS elder_birth_year,
         p.name AS package_name, p.code AS package_code,
         cg.full_name AS caregiver_name, cg.avatar_color AS caregiver_color,
         fa.full_name AS family_name, fa.phone AS family_phone,
         (SELECT COUNT(*) FROM tasks t WHERE t.booking_id = b.id) AS task_total,
         (SELECT COUNT(*) FROM tasks t WHERE t.booking_id = b.id AND t.done = 1) AS task_done,
         (SELECT status FROM payments pm WHERE pm.booking_id = b.id ORDER BY pm.id DESC LIMIT 1) AS payment_status,
         (SELECT method FROM payments pm WHERE pm.booking_id = b.id ORDER BY pm.id DESC LIMIT 1) AS payment_method,
         (SELECT rating FROM reviews rv WHERE rv.booking_id = b.id) AS review_rating
  FROM bookings b
  JOIN elders e ON e.id = b.elder_id
  LEFT JOIN packages p ON p.id = b.package_id
  LEFT JOIN users cg ON cg.id = b.caregiver_id
  LEFT JOIN users fa ON fa.id = b.family_user_id
`;

function getBooking(id) {
  return db.prepare(BOOKING_SELECT + ' WHERE b.id = ?').get(id);
}

/** GET /api/bookings — danh sach ca lam theo vai tro dang dang nhap */
router.get('/', requireAuth, wrap((req, res) => {
  const { status, from, to } = req.query;
  let sql = BOOKING_SELECT + ' WHERE 1 = 1';
  const params = [];

  if (req.user.role === 'family') { sql += ' AND b.family_user_id = ?'; params.push(req.user.id); }
  else if (req.user.role === 'caregiver') { sql += ' AND b.caregiver_id = ?'; params.push(req.user.id); }
  else if (req.user.role === 'elder') {
    sql += ' AND e.elder_user_id = ?'; params.push(req.user.id);
  }

  if (status) { sql += ' AND b.status = ?'; params.push(status); }
  if (from)   { sql += ' AND b.start_at >= ?'; params.push(from); }
  if (to)     { sql += ' AND b.start_at <= ?'; params.push(to); }
  sql += ' ORDER BY b.start_at DESC LIMIT 200';

  res.json(db.prepare(sql).all(...params));
}));

/** GET /api/bookings/open — cac ca dang cho nhan, danh cho cham soc vien */
router.get('/open', requireAuth, requireRole('caregiver'), wrap((req, res) => {
  const rows = db.prepare(BOOKING_SELECT + `
    WHERE b.caregiver_id IS NULL AND b.status = 'pending' AND b.start_at >= datetime('now', '-1 day')
    ORDER BY b.start_at ASC LIMIT 100
  `).all();

  const applied = db.prepare('SELECT booking_id FROM shift_applications WHERE caregiver_id = ?')
    .all(req.user.id).map(r => r.booking_id);

  res.json(rows.map(r => ({ ...r, applied: applied.includes(r.id) })));
}));

/** POST /api/bookings — gia dinh dat lich */
router.post('/', requireAuth, requireRole('family'), wrap((req, res) => {
  const { elder_id, package_id, caregiver_id, mode, start_at, end_at, address, lat, lng, note,
          payment_method = 'cash' } = req.body || {};

  if (!elder_id || !mode || !start_at || !end_at) {
    return res.status(400).json({ error: 'Cần chọn người được chăm sóc, hình thức và thời gian' });
  }
  assertElderOwner(Number(elder_id), req.user.id);

  const start = new Date(start_at), end = new Date(end_at);
  if (isNaN(start) || isNaN(end) || end <= start) {
    return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
  }
  const hours = Math.round(((end - start) / 36e5) * 10) / 10;

  const pkg = package_id ? db.prepare('SELECT * FROM packages WHERE id = ?').get(package_id) : null;
  const total = calcAmount(pkg, mode, hours);

  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(elder_id);
  const code = makeBookingCode();

  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO bookings (code, elder_id, family_user_id, caregiver_id, package_id, mode,
                            start_at, end_at, hours, address, lat, lng, note, status, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, elder_id, req.user.id, caregiver_id || null, package_id || null, mode,
           start_at, end_at, hours,
           address || elder.address, lat ?? elder.lat, lng ?? elder.lng, note || null,
           caregiver_id ? 'confirmed' : 'pending', total);

    const bookingId = info.lastInsertRowid;

    // E-Logbook: tu sinh checklist tu goi dich vu + don thuoc trong ho so suc khoe
    const defaults = parseJSON(pkg?.tasks, []);
    const insertTask = db.prepare(
      'INSERT INTO tasks (booking_id, title, due_time, sort_order) VALUES (?, ?, ?, ?)'
    );
    defaults.forEach((t, i) => insertTask.run(bookingId, t.title || t, t.time || null, i));

    const rec = db.prepare('SELECT medications FROM health_records WHERE elder_id = ?').get(elder_id);
    parseJSON(rec?.medications, []).forEach((m, i) => {
      insertTask.run(bookingId, `Cho uống thuốc: ${m.name}${m.dose ? ' (' + m.dose + ')' : ''}`,
                     m.time || null, defaults.length + i);
    });

    // Tao ban ghi thanh toan o trang thai cho
    db.prepare('INSERT INTO payments (booking_id, amount, method) VALUES (?, ?, ?)')
      .run(bookingId, total, payment_method);

    return bookingId;
  });

  res.status(201).json(getBooking(create()));
}));

/** GET /api/bookings/:id — chi tiet ca lam kem checklist, cap nhat, GPS */
router.get('/:id', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền xem ca làm này' });

  b.tasks = db.prepare('SELECT * FROM tasks WHERE booking_id = ? ORDER BY sort_order, id').all(b.id);
  b.updates = db.prepare(`
    SELECT up.*, u.full_name AS author_name
    FROM updates up LEFT JOIN users u ON u.id = up.author_id
    WHERE up.booking_id = ? ORDER BY up.created_at DESC
  `).all(b.id);
  b.tracking = db.prepare(
    'SELECT lat, lng, recorded_at FROM tracking_points WHERE booking_id = ? ORDER BY recorded_at'
  ).all(b.id);
  b.payment = db.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1').get(b.id);
  b.review = db.prepare('SELECT * FROM reviews WHERE booking_id = ?').get(b.id) || null;

  res.json(b);
}));

/** PUT /api/bookings/:id/status — doi trang thai ca lam */
router.put('/:id/status', requireAuth, wrap((req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  // Cham soc vien chi duoc bat dau / ket thuc ca
  if (req.user.role === 'caregiver' && !['in_progress', 'completed'].includes(status)) {
    return res.status(403).json({ error: 'Chăm sóc viên chỉ được bắt đầu hoặc kết thúc ca' });
  }
  if (b.status === 'completed' && status !== 'completed') {
    return res.status(400).json({ error: 'Ca đã hoàn thành, không thể đổi trạng thái' });
  }

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);

  // Ket thuc ca thanh toan tien mat thi ghi nhan da thu
  if (status === 'completed') {
    db.prepare(`
      UPDATE payments SET status = 'paid', paid_at = datetime('now')
      WHERE booking_id = ? AND method = 'cash' AND status = 'pending'
    `).run(req.params.id);
  }

  res.json(getBooking(req.params.id));
}));

/** POST /api/bookings/:id/assign — gan cham soc vien (gia dinh chon) */
router.post('/:id/assign', requireAuth, requireRole('family', 'admin'), wrap((req, res) => {
  const { caregiver_id } = req.body || {};
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  const cg = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'caregiver'").get(caregiver_id);
  if (!cg) return res.status(404).json({ error: 'Không tìm thấy chăm sóc viên' });

  db.transaction(() => {
    db.prepare("UPDATE bookings SET caregiver_id = ?, status = 'confirmed' WHERE id = ?")
      .run(caregiver_id, req.params.id);
    db.prepare("UPDATE shift_applications SET status = 'accepted' WHERE booking_id = ? AND caregiver_id = ?")
      .run(req.params.id, caregiver_id);
    db.prepare("UPDATE shift_applications SET status = 'rejected' WHERE booking_id = ? AND caregiver_id != ?")
      .run(req.params.id, caregiver_id);
  })();

  res.json(getBooking(req.params.id));
}));

/** POST /api/bookings/:id/apply — cham soc vien dang ky nhan ca */
router.post('/:id/apply', requireAuth, requireRole('caregiver'), wrap((req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy ca làm' });
  if (b.caregiver_id) return res.status(400).json({ error: 'Ca làm này đã có người nhận' });

  db.prepare(`
    INSERT INTO shift_applications (booking_id, caregiver_id, message) VALUES (?, ?, ?)
    ON CONFLICT(booking_id, caregiver_id) DO UPDATE SET message = excluded.message
  `).run(req.params.id, req.user.id, (req.body || {}).message || null);

  res.status(201).json({ ok: true });
}));

/** GET /api/bookings/:id/applications — gia dinh xem ai da dang ky nhan ca */
router.get('/:id/applications', requireAuth, requireRole('family', 'admin'), wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  const rows = db.prepare(`
    SELECT sa.*, u.full_name, u.avatar_color, c.years_experience, c.rating_avg, c.rating_count,
           c.specialties, c.verified, c.district, c.city
    FROM shift_applications sa
    JOIN users u ON u.id = sa.caregiver_id
    LEFT JOIN caregivers c ON c.user_id = sa.caregiver_id
    WHERE sa.booking_id = ? ORDER BY c.rating_avg DESC
  `).all(req.params.id).map(r => ({ ...r, specialties: parseJSON(r.specialties, []) }));

  res.json(rows);
}));

/* ===================== E-LOGBOOK ===================== */

/** POST /api/bookings/:id/tasks — them dau viec vao checklist */
router.post('/:id/tasks', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  const { title, due_time } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Cần nhập tên công việc' });

  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM tasks WHERE booking_id = ?').get(b.id);
  const info = db.prepare('INSERT INTO tasks (booking_id, title, due_time, sort_order) VALUES (?, ?, ?, ?)')
    .run(b.id, title, due_time || null, max.m + 1);

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
}));

/** PUT /api/bookings/:id/tasks/:tid — tick hoan thanh, he thong tu ghi vao dong thoi gian */
router.put('/:id/tasks/:tid', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  const { done, note } = req.body || {};
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND booking_id = ?').get(req.params.tid, b.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  db.prepare(`
    UPDATE tasks SET done = COALESCE(?, done), note = COALESCE(?, note),
                     done_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
    WHERE id = ?
  `).run(done === undefined ? null : (done ? 1 : 0), note ?? null, done ? 1 : 0, req.params.tid);

  if (done && !task.done) {
    db.prepare("INSERT INTO updates (booking_id, author_id, type, content) VALUES (?, ?, 'activity', ?)")
      .run(b.id, req.user.id, `Đã hoàn thành: ${task.title}`);
  }

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.tid));
}));

/** DELETE /api/bookings/:id/tasks/:tid */
router.delete('/:id/tasks/:tid', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });
  db.prepare('DELETE FROM tasks WHERE id = ? AND booking_id = ?').run(req.params.tid, b.id);
  res.json({ ok: true });
}));

/** GET /api/bookings/:id/report — bao cao ngan gui gia dinh cuoi ca */
router.get('/:id/report', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE booking_id = ? ORDER BY sort_order').all(b.id);
  const vitals = db.prepare('SELECT * FROM vitals WHERE booking_id = ? ORDER BY recorded_at').all(b.id);
  const updates = db.prepare('SELECT * FROM updates WHERE booking_id = ? ORDER BY created_at').all(b.id);

  res.json({
    booking: { code: b.code, elder_name: b.elder_name, caregiver_name: b.caregiver_name,
               start_at: b.start_at, end_at: b.end_at, status: b.status },
    summary: {
      task_done: tasks.filter(t => t.done).length,
      task_total: tasks.length,
      vitals_recorded: vitals.length,
      updates_sent: updates.length
    },
    tasks, vitals, updates
  });
}));

/* ===================== CAP NHAT TINH HINH + GPS ===================== */

/** POST /api/bookings/:id/updates — gui anh bua an, hoat dong, ghi chu */
router.post('/:id/updates', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });

  const { type = 'note', content, image_url } = req.body || {};
  if (!content && !image_url) return res.status(400).json({ error: 'Cần nội dung hoặc hình ảnh' });

  const info = db.prepare(
    'INSERT INTO updates (booking_id, author_id, type, content, image_url) VALUES (?, ?, ?, ?, ?)'
  ).run(b.id, req.user.id, type, content || null, image_url || null);

  res.status(201).json(db.prepare('SELECT * FROM updates WHERE id = ?').get(info.lastInsertRowid));
}));

/** POST /api/bookings/:id/tracking — cham soc vien gui vi tri trong ca */
router.post('/:id/tracking', requireAuth, requireRole('caregiver'), wrap((req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b || b.caregiver_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền' });

  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Toạ độ không hợp lệ' });
  }
  db.prepare('INSERT INTO tracking_points (booking_id, lat, lng) VALUES (?, ?, ?)').run(b.id, lat, lng);
  res.status(201).json({ ok: true });
}));

/** GET /api/bookings/:id/tracking — gia dinh theo doi lo trinh */
router.get('/:id/tracking', requireAuth, wrap((req, res) => {
  const b = getBooking(req.params.id);
  if (!canAccessBooking(b, req.user)) return res.status(403).json({ error: 'Không có quyền' });
  res.json(db.prepare(
    'SELECT lat, lng, recorded_at FROM tracking_points WHERE booking_id = ? ORDER BY recorded_at'
  ).all(b.id));
}));

module.exports = router;
