'use strict';
const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, canAccessBooking } = require('../utils');

/** GET /api/payments — lich su thanh toan cua gia dinh */
router.get('/', requireAuth, requireRole('family', 'admin'), wrap((req, res) => {
  const rows = db.prepare(`
    SELECT p.*, b.code AS booking_code, b.start_at, b.mode,
           e.full_name AS elder_name, pk.name AS package_name,
           cg.full_name AS caregiver_name
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    JOIN elders e ON e.id = b.elder_id
    LEFT JOIN packages pk ON pk.id = b.package_id
    LEFT JOIN users cg ON cg.id = b.caregiver_id
    WHERE b.family_user_id = ?
    ORDER BY p.created_at DESC LIMIT 100
  `).all(req.user.id);
  res.json(rows);
}));

/** GET /api/payments/summary — tong quan chi tieu */
router.get('/summary', requireAuth, requireRole('family'), wrap((req, res) => {
  const paid = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.family_user_id = ? AND p.status = 'paid'
  `).get(req.user.id);

  const pending = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS c FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.family_user_id = ? AND p.status = 'pending'
  `).get(req.user.id);

  const month = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.family_user_id = ? AND p.status = 'paid'
      AND strftime('%Y-%m', p.paid_at) = strftime('%Y-%m', 'now')
  `).get(req.user.id);

  res.json({
    total_paid: paid.total,
    pending_amount: pending.total,
    pending_count: pending.c,
    month_paid: month.total
  });
}));

/** POST /api/payments/:id/pay — xac nhan thanh toan (mo phong cong thanh toan) */
router.post('/:id/pay', requireAuth, requireRole('family'), wrap((req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Không tìm thấy khoản thanh toán' });

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
  if (!canAccessBooking(booking, req.user)) return res.status(403).json({ error: 'Không có quyền' });
  if (payment.status === 'paid') return res.status(400).json({ error: 'Khoản này đã được thanh toán' });

  const { method } = req.body || {};
  const allowed = ['cash', 'card', 'transfer'];
  const useMethod = allowed.includes(method) ? method : payment.method;

  // Cho tien mat: chi ghi nhan phuong thuc, thu tien khi ket thuc ca
  if (useMethod === 'cash') {
    db.prepare("UPDATE payments SET method = 'cash' WHERE id = ?").run(payment.id);
    return res.json({ ...db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id),
                      message: 'Sẽ thanh toán tiền mặt khi kết thúc ca' });
  }

  const txn = `ANLAO${Date.now().toString(36).toUpperCase()}`;
  db.prepare(`
    UPDATE payments SET method = ?, status = 'paid', paid_at = datetime('now'), txn_ref = ?
    WHERE id = ?
  `).run(useMethod, txn, payment.id);

  res.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id));
}));

module.exports = router;
