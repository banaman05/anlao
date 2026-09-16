'use strict';
const db = require('./db');

/** Bao boc handler async de loi tu dong day ve error middleware */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Tao ma booking dang AL-240915-4821 */
function makeBookingCode() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AL-${ymd}-${rand}`;
}

function parseJSON(value, fallback) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

/** Kiem tra elder co thuoc ve tai khoan gia dinh dang goi khong */
function assertElderOwner(elderId, userId) {
  const row = db.prepare('SELECT family_user_id FROM elders WHERE id = ?').get(elderId);
  if (!row) { const e = new Error('Không tìm thấy hồ sơ người cao tuổi'); e.status = 404; throw e; }
  if (row.family_user_id !== userId) { const e = new Error('Không có quyền với hồ sơ này'); e.status = 403; throw e; }
  return row;
}

/** Quyen xem mot booking: gia dinh so huu, cham soc vien duoc gan, hoac admin */
function canAccessBooking(booking, user) {
  if (!booking) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'family') return booking.family_user_id === user.id;
  if (user.role === 'caregiver') return booking.caregiver_id === user.id;
  if (user.role === 'elder') {
    const elder = db.prepare('SELECT elder_user_id FROM elders WHERE id = ?').get(booking.elder_id);
    return elder && elder.elder_user_id === user.id;
  }
  return false;
}

/** Tinh tien theo goi + hinh thuc dat */
function calcAmount(pkg, mode, hours) {
  if (!pkg) return 0;
  if (mode === 'monthly') return pkg.price_month || 0;
  if (mode === 'shift') return pkg.price_shift || 0;
  if (mode === 'procedure') return pkg.price_shift || 0;
  return Math.round((pkg.price_hour || 0) * (hours || 0));
}

/** Cap nhat lai diem trung binh cua cham soc vien sau khi co danh gia moi */
function refreshCaregiverRating(caregiverId) {
  const stat = db.prepare(
    'SELECT COUNT(*) AS c, AVG(rating) AS a FROM reviews WHERE caregiver_id = ?'
  ).get(caregiverId);
  db.prepare('UPDATE caregivers SET rating_avg = ?, rating_count = ? WHERE user_id = ?')
    .run(Math.round((stat.a || 0) * 10) / 10, stat.c || 0, caregiverId);
}

module.exports = {
  wrap, makeBookingCode, parseJSON, assertElderOwner,
  canAccessBooking, calcAmount, refreshCaregiverRating
};
