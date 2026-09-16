'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { wrap, parseJSON } = require('../utils');

const COLORS = ['#1C74B8', '#3FBFAE', '#E2A045', '#14507F', '#2C9385'];

/** POST /api/auth/register — dang ky gia dinh hoac cham soc vien */
router.post('/register', wrap((req, res) => {
  const { full_name, email, phone, password, role = 'family' } = req.body || {};

  if (!full_name || !password || (!email && !phone)) {
    return res.status(400).json({ error: 'Cần họ tên, mật khẩu và email hoặc số điện thoại' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự' });
  }
  if (!['family', 'caregiver', 'elder'].includes(role)) {
    return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  }

  const existed = db.prepare(
    'SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)'
  ).get(email || null, phone || null);
  if (existed) return res.status(409).json({ error: 'Email hoặc số điện thoại đã được đăng ký' });

  const hash = bcrypt.hashSync(password, 10);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const info = db.prepare(`
    INSERT INTO users (role, full_name, email, phone, password_hash, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(role, full_name, email || null, phone || null, hash, color);

  if (role === 'caregiver') {
    db.prepare('INSERT INTO caregivers (user_id) VALUES (?)').run(info.lastInsertRowid);
  }

  const user = db.prepare('SELECT id, role, full_name, email, phone, avatar_color FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user });
}));

/** POST /api/auth/login */
router.post('/login', wrap((req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Nhập email/số điện thoại và mật khẩu' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });
  }

  const safe = {
    id: user.id, role: user.role, full_name: user.full_name,
    email: user.email, phone: user.phone, avatar_color: user.avatar_color
  };
  res.json({ token: signToken(safe), user: safe });
}));

/** GET /api/auth/me — thong tin tai khoan dang dang nhap */
router.get('/me', requireAuth, wrap((req, res) => {
  const user = db.prepare(
    'SELECT id, role, full_name, email, phone, avatar_color, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

  if (user.role === 'caregiver') {
    const cg = db.prepare('SELECT * FROM caregivers WHERE user_id = ?').get(user.id);
    if (cg) {
      user.caregiver = {
        ...cg,
        specialties: parseJSON(cg.specialties, []),
        certificates: parseJSON(cg.certificates, []),
        available_days: parseJSON(cg.available_days, [])
      };
    }
  }
  if (user.role === 'elder') {
    user.elder = db.prepare('SELECT * FROM elders WHERE elder_user_id = ?').get(user.id) || null;
  }
  res.json(user);
}));

/** PUT /api/auth/me — cap nhat thong tin ca nhan */
router.put('/me', requireAuth, wrap((req, res) => {
  const { full_name, email, phone } = req.body || {};
  db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      email     = COALESCE(?, email),
      phone     = COALESCE(?, phone)
    WHERE id = ?
  `).run(full_name || null, email || null, phone || null, req.user.id);

  res.json(db.prepare('SELECT id, role, full_name, email, phone, avatar_color FROM users WHERE id = ?')
    .get(req.user.id));
}));

/** PUT /api/auth/password — doi mat khau */
router.put('/password', requireAuth, wrap((req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới cần ít nhất 6 ký tự' });
  }
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password || '', user.password_hash)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
