'use strict';
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'anlao-dev-secret-doi-truoc-khi-deploy';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, full_name: user.full_name },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/** Bat buoc dang nhap */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
  }
}

/** Gioi han theo vai tro: requireRole('family'), requireRole('caregiver','admin') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Tài khoản không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, SECRET };
