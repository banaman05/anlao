'use strict';
const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, parseJSON } = require('../utils');

const shape = (row) => ({
  id: row.user_id,
  full_name: row.full_name,
  avatar_color: row.avatar_color,
  bio: row.bio,
  years_experience: row.years_experience,
  specialties: parseJSON(row.specialties, []),
  certificates: parseJSON(row.certificates, []),
  available_days: parseJSON(row.available_days, []),
  city: row.city,
  district: row.district,
  lat: row.lat,
  lng: row.lng,
  verified: !!row.verified,
  rating_avg: row.rating_avg,
  rating_count: row.rating_count
});

/** GET /api/caregivers — danh sach cham soc vien, loc theo khu vuc / chuyen mon */
router.get('/', wrap((req, res) => {
  const { city, district, specialty, verified, q, limit = 50 } = req.query;

  let sql = `
    SELECT c.*, u.full_name, u.avatar_color
    FROM caregivers c JOIN users u ON u.id = c.user_id
    WHERE 1 = 1
  `;
  const params = [];
  if (city)     { sql += ' AND c.city = ?';     params.push(city); }
  if (district) { sql += ' AND c.district = ?'; params.push(district); }
  if (verified === '1') sql += ' AND c.verified = 1';
  if (specialty) { sql += ' AND c.specialties LIKE ?'; params.push(`%${specialty}%`); }
  if (q)         { sql += ' AND u.full_name LIKE ?';   params.push(`%${q}%`); }
  sql += ' ORDER BY c.verified DESC, c.rating_avg DESC, c.rating_count DESC LIMIT ?';
  params.push(Number(limit));

  res.json(db.prepare(sql).all(...params).map(shape));
}));

/** GET /api/caregivers/:id — ho so chi tiet kem danh gia gan day */
router.get('/:id', wrap((req, res) => {
  const row = db.prepare(`
    SELECT c.*, u.full_name, u.avatar_color
    FROM caregivers c JOIN users u ON u.id = c.user_id
    WHERE c.user_id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy chăm sóc viên' });

  const reviews = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.full_name AS reviewer
    FROM reviews r JOIN users u ON u.id = r.family_user_id
    WHERE r.caregiver_id = ? ORDER BY r.created_at DESC LIMIT 10
  `).all(req.params.id);

  res.json({ ...shape(row), reviews });
}));

/** PUT /api/caregivers/me — cham soc vien tu cap nhat ho so nghe nghiep */
router.put('/me/profile', requireAuth, requireRole('caregiver'), wrap((req, res) => {
  const { bio, years_experience, specialties, certificates, city, district, lat, lng, available_days } = req.body || {};

  db.prepare(`
    UPDATE caregivers SET
      bio              = COALESCE(?, bio),
      years_experience = COALESCE(?, years_experience),
      specialties      = COALESCE(?, specialties),
      certificates     = COALESCE(?, certificates),
      city             = COALESCE(?, city),
      district         = COALESCE(?, district),
      lat              = COALESCE(?, lat),
      lng              = COALESCE(?, lng),
      available_days   = COALESCE(?, available_days)
    WHERE user_id = ?
  `).run(
    bio ?? null,
    years_experience ?? null,
    specialties ? JSON.stringify(specialties) : null,
    certificates ? JSON.stringify(certificates) : null,
    city ?? null, district ?? null, lat ?? null, lng ?? null,
    available_days ? JSON.stringify(available_days) : null,
    req.user.id
  );

  const row = db.prepare(`
    SELECT c.*, u.full_name, u.avatar_color
    FROM caregivers c JOIN users u ON u.id = c.user_id WHERE c.user_id = ?
  `).get(req.user.id);
  res.json(shape(row));
}));

/** GET /api/caregivers/me/stats — thong ke thu nhap va ca lam */
router.get('/me/stats', requireAuth, requireRole('caregiver'), wrap((req, res) => {
  const done = db.prepare(`
    SELECT COUNT(*) AS shifts, COALESCE(SUM(total_amount), 0) AS revenue
    FROM bookings WHERE caregiver_id = ? AND status = 'completed'
  `).get(req.user.id);

  const month = db.prepare(`
    SELECT COUNT(*) AS shifts, COALESCE(SUM(total_amount), 0) AS revenue
    FROM bookings
    WHERE caregiver_id = ? AND status = 'completed'
      AND strftime('%Y-%m', start_at) = strftime('%Y-%m', 'now')
  `).get(req.user.id);

  const upcoming = db.prepare(`
    SELECT COUNT(*) AS c FROM bookings
    WHERE caregiver_id = ? AND status IN ('confirmed','in_progress')
  `).get(req.user.id);

  const cg = db.prepare('SELECT rating_avg, rating_count FROM caregivers WHERE user_id = ?').get(req.user.id);

  res.json({
    total_shifts: done.shifts,
    total_revenue: done.revenue,
    month_shifts: month.shifts,
    month_revenue: month.revenue,
    upcoming: upcoming.c,
    rating_avg: cg?.rating_avg || 0,
    rating_count: cg?.rating_count || 0
  });
}));

module.exports = router;
