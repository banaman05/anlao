'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, parseJSON, assertElderOwner } = require('../utils');

const shapeRecord = (r) => r && ({
  ...r,
  conditions: parseJSON(r.conditions, []),
  allergies: parseJSON(r.allergies, []),
  medications: parseJSON(r.medications, [])
});

/** Lay elder_id ma tai khoan hien tai duoc phep xem */
function resolveElder(req, elderId) {
  if (req.user.role === 'family') { assertElderOwner(elderId, req.user.id); return; }
  if (req.user.role === 'elder') {
    const e = db.prepare('SELECT id FROM elders WHERE id = ? AND elder_user_id = ?').get(elderId, req.user.id);
    if (!e) { const err = new Error('Không có quyền với hồ sơ này'); err.status = 403; throw err; }
    return;
  }
  if (req.user.role === 'caregiver') {
    // Cham soc vien chi xem duoc ho so cua ca lam da duoc gan cho minh
    const b = db.prepare(`
      SELECT id FROM bookings
      WHERE elder_id = ? AND caregiver_id = ? AND status IN ('confirmed','in_progress','completed')
      LIMIT 1
    `).get(elderId, req.user.id);
    if (!b) { const err = new Error('Chưa được chỉ định chăm sóc người này'); err.status = 403; throw err; }
    return;
  }
  if (req.user.role === 'admin') return;
  const err = new Error('Không có quyền'); err.status = 403; throw err;
}

/** GET /api/elders — danh sach nguoi cao tuoi cua tai khoan gia dinh */
router.get('/', requireAuth, requireRole('family', 'admin'), wrap((req, res) => {
  const rows = db.prepare(`
    SELECT e.*, (SELECT COUNT(*) FROM bookings b WHERE b.elder_id = e.id) AS booking_count
    FROM elders e WHERE e.family_user_id = ? ORDER BY e.created_at DESC
  `).all(req.user.id);
  res.json(rows);
}));

/** POST /api/elders — them nguoi cao tuoi, tao luon ho so suc khoe rong */
router.post('/', requireAuth, requireRole('family'), wrap((req, res) => {
  const { full_name, birth_year, gender, phone, address, lat, lng, relation,
          create_account, account_password } = req.body || {};
  if (!full_name) return res.status(400).json({ error: 'Cần nhập họ tên người cao tuổi' });

  const create = db.transaction(() => {
    let elderUserId = null;

    // Tuy chon: tao tai khoan rieng de cu dung giao dien don gian
    if (create_account && phone && account_password) {
      const dup = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (dup) { const e = new Error('Số điện thoại đã được dùng cho tài khoản khác'); e.status = 409; throw e; }
      const info = db.prepare(`
        INSERT INTO users (role, full_name, phone, password_hash, avatar_color)
        VALUES ('elder', ?, ?, ?, '#E2A045')
      `).run(full_name, phone, bcrypt.hashSync(account_password, 10));
      elderUserId = info.lastInsertRowid;
    }

    const info = db.prepare(`
      INSERT INTO elders (family_user_id, elder_user_id, full_name, birth_year, gender, phone, address, lat, lng, relation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, elderUserId, full_name, birth_year || null, gender || null,
           phone || null, address || null, lat || null, lng || null, relation || null);

    db.prepare('INSERT INTO health_records (elder_id) VALUES (?)').run(info.lastInsertRowid);
    return info.lastInsertRowid;
  });

  const id = create();
  res.status(201).json(db.prepare('SELECT * FROM elders WHERE id = ?').get(id));
}));

/** GET /api/elders/:id */
router.get('/:id', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(req.params.id);
  if (!elder) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
  res.json(elder);
}));

/** PUT /api/elders/:id */
router.put('/:id', requireAuth, requireRole('family'), wrap((req, res) => {
  assertElderOwner(Number(req.params.id), req.user.id);
  const { full_name, birth_year, gender, phone, address, lat, lng, relation } = req.body || {};
  db.prepare(`
    UPDATE elders SET
      full_name = COALESCE(?, full_name), birth_year = COALESCE(?, birth_year),
      gender = COALESCE(?, gender), phone = COALESCE(?, phone),
      address = COALESCE(?, address), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      relation = COALESCE(?, relation)
    WHERE id = ?
  `).run(full_name ?? null, birth_year ?? null, gender ?? null, phone ?? null,
         address ?? null, lat ?? null, lng ?? null, relation ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM elders WHERE id = ?').get(req.params.id));
}));

/** DELETE /api/elders/:id */
router.delete('/:id', requireAuth, requireRole('family'), wrap((req, res) => {
  assertElderOwner(Number(req.params.id), req.user.id);
  db.prepare('DELETE FROM elders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

/* ===================== HO SO SUC KHOE SO ===================== */

/** GET /api/elders/:id/health — ho so benh ly, don thuoc, di ung, lich tai kham */
router.get('/:id/health', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const rec = db.prepare('SELECT * FROM health_records WHERE elder_id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Chưa có hồ sơ sức khỏe' });
  res.json(shapeRecord(rec));
}));

/** PUT /api/elders/:id/health */
router.put('/:id/health', requireAuth, requireRole('family'), wrap((req, res) => {
  assertElderOwner(Number(req.params.id), req.user.id);
  const { blood_type, conditions, allergies, medications, habits, mobility, care_notes, next_checkup } = req.body || {};

  db.prepare(`
    INSERT INTO health_records (elder_id, blood_type, conditions, allergies, medications, habits, mobility, care_notes, next_checkup, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(elder_id) DO UPDATE SET
      blood_type   = COALESCE(excluded.blood_type, blood_type),
      conditions   = COALESCE(excluded.conditions, conditions),
      allergies    = COALESCE(excluded.allergies, allergies),
      medications  = COALESCE(excluded.medications, medications),
      habits       = COALESCE(excluded.habits, habits),
      mobility     = COALESCE(excluded.mobility, mobility),
      care_notes   = COALESCE(excluded.care_notes, care_notes),
      next_checkup = COALESCE(excluded.next_checkup, next_checkup),
      updated_at   = datetime('now')
  `).run(
    req.params.id, blood_type ?? null,
    conditions ? JSON.stringify(conditions) : null,
    allergies ? JSON.stringify(allergies) : null,
    medications ? JSON.stringify(medications) : null,
    habits ?? null, mobility ?? null, care_notes ?? null, next_checkup ?? null
  );

  res.json(shapeRecord(db.prepare('SELECT * FROM health_records WHERE elder_id = ?').get(req.params.id)));
}));

/* ===================== CHI SO SINH TON ===================== */

/** GET /api/elders/:id/vitals?limit=30 */
router.get('/:id/vitals', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const rows = db.prepare(`
    SELECT v.*, u.full_name AS recorded_by_name
    FROM vitals v LEFT JOIN users u ON u.id = v.recorded_by
    WHERE v.elder_id = ? ORDER BY v.recorded_at DESC LIMIT ?
  `).all(req.params.id, Number(req.query.limit || 30));
  res.json(rows);
}));

/** POST /api/elders/:id/vitals — cham soc vien hoac gia dinh ghi nhan chi so */
router.post('/:id/vitals', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const { systolic, diastolic, heart_rate, temperature, glucose, sleep_hours, note, booking_id } = req.body || {};

  const info = db.prepare(`
    INSERT INTO vitals (elder_id, booking_id, systolic, diastolic, heart_rate, temperature, glucose, sleep_hours, note, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, booking_id || null, systolic || null, diastolic || null,
         heart_rate || null, temperature || null, glucose || null, sleep_hours || null,
         note || null, req.user.id);

  // Ghi nhan chi so cung tao mot cap nhat de gia dinh thay ngay tren dong thoi gian
  if (booking_id) {
    const parts = [];
    if (systolic && diastolic) parts.push(`Huyết áp ${systolic}/${diastolic} mmHg`);
    if (heart_rate) parts.push(`Nhịp tim ${heart_rate} lần/phút`);
    if (temperature) parts.push(`Nhiệt độ ${temperature}°C`);
    if (glucose) parts.push(`Đường huyết ${glucose} mmol/L`);
    if (sleep_hours) parts.push(`Ngủ ${sleep_hours} giờ`);
    if (parts.length) {
      db.prepare(`INSERT INTO updates (booking_id, author_id, type, content) VALUES (?, ?, 'vital', ?)`)
        .run(booking_id, req.user.id, parts.join(' · '));
    }
  }

  res.status(201).json(db.prepare('SELECT * FROM vitals WHERE id = ?').get(info.lastInsertRowid));
}));

/* ===================== NHAC NHO ===================== */

/** GET /api/elders/:id/reminders */
router.get('/:id/reminders', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const rows = db.prepare('SELECT * FROM reminders WHERE elder_id = ? ORDER BY time_of_day')
    .all(req.params.id)
    .map(r => ({ ...r, days: parseJSON(r.days, []), active: !!r.active }));
  res.json(rows);
}));

/** POST /api/elders/:id/reminders */
router.post('/:id/reminders', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const { type = 'medicine', title, detail, time_of_day, days } = req.body || {};
  if (!title || !time_of_day) return res.status(400).json({ error: 'Cần nhập nội dung và giờ nhắc' });

  const info = db.prepare(`
    INSERT INTO reminders (elder_id, type, title, detail, time_of_day, days)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, type, title, detail || null, time_of_day,
         JSON.stringify(days || [2, 3, 4, 5, 6, 7, 8]));

  res.status(201).json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid));
}));

/** PUT /api/elders/:id/reminders/:rid — bat/tat hoac sua nhac nho */
router.put('/:id/reminders/:rid', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  const { title, detail, time_of_day, days, active } = req.body || {};
  db.prepare(`
    UPDATE reminders SET
      title = COALESCE(?, title), detail = COALESCE(?, detail),
      time_of_day = COALESCE(?, time_of_day), days = COALESCE(?, days),
      active = COALESCE(?, active)
    WHERE id = ? AND elder_id = ?
  `).run(title ?? null, detail ?? null, time_of_day ?? null,
         days ? JSON.stringify(days) : null,
         active === undefined ? null : (active ? 1 : 0),
         req.params.rid, req.params.id);
  res.json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.rid));
}));

/** DELETE /api/elders/:id/reminders/:rid */
router.delete('/:id/reminders/:rid', requireAuth, wrap((req, res) => {
  resolveElder(req, Number(req.params.id));
  db.prepare('DELETE FROM reminders WHERE id = ? AND elder_id = ?').run(req.params.rid, req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
