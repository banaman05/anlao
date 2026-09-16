'use strict';
const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, refreshCaregiverRating } = require('../utils');

/** POST /api/reviews — gia dinh danh gia sau khi ca hoan thanh */
router.post('/', requireAuth, requireRole('family'), wrap((req, res) => {
  const { booking_id, rating, comment } = req.body || {};
  if (!booking_id || !rating) return res.status(400).json({ error: 'Cần chọn ca làm và số sao' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Số sao từ 1 đến 5' });

  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy ca làm' });
  if (b.family_user_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền' });
  if (b.status !== 'completed') return res.status(400).json({ error: 'Chỉ đánh giá được ca đã hoàn thành' });
  if (!b.caregiver_id) return res.status(400).json({ error: 'Ca làm chưa có chăm sóc viên' });

  const existed = db.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(booking_id);
  if (existed) return res.status(409).json({ error: 'Ca làm này đã được đánh giá' });

  const info = db.prepare(`
    INSERT INTO reviews (booking_id, family_user_id, caregiver_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(booking_id, req.user.id, b.caregiver_id, rating, comment || null);

  refreshCaregiverRating(b.caregiver_id);
  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid));
}));

/** GET /api/reviews/caregiver/:id */
router.get('/caregiver/:id', wrap((req, res) => {
  const rows = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.full_name AS reviewer, u.avatar_color
    FROM reviews r JOIN users u ON u.id = r.family_user_id
    WHERE r.caregiver_id = ? ORDER BY r.created_at DESC LIMIT 50
  `).all(req.params.id);
  res.json(rows);
}));

/** GET /api/reviews/mine — danh gia cham soc vien nhan duoc */
router.get('/mine', requireAuth, requireRole('caregiver'), wrap((req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.full_name AS reviewer, b.code AS booking_code
    FROM reviews r
    JOIN users u ON u.id = r.family_user_id
    JOIN bookings b ON b.id = r.booking_id
    WHERE r.caregiver_id = ? ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(rows);
}));

module.exports = router;
