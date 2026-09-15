'use strict';
const router = require('express').Router();
const db = require('../db');
const { wrap, parseJSON } = require('../utils');

/** GET /api/packages — bang gia cong khai, khong can dang nhap */
router.get('/', wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM packages ORDER BY sort_order, id').all();
  res.json(rows.map(r => ({ ...r, tasks: parseJSON(r.tasks, []) })));
}));

/** GET /api/packages/:code */
router.get('/:code', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM packages WHERE code = ? OR id = ?')
    .get(req.params.code, req.params.code);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy gói dịch vụ' });
  res.json({ ...row, tasks: parseJSON(row.tasks, []) });
}));

/** POST /api/packages/quote — tinh thu chi phi truoc khi dat lich */
router.post('/quote', wrap((req, res) => {
  const { package_id, mode, start_at, end_at, days_per_month } = req.body || {};
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(package_id);
  if (!pkg) return res.status(404).json({ error: 'Không tìm thấy gói dịch vụ' });

  let hours = 0;
  if (start_at && end_at) {
    hours = Math.round(((new Date(end_at) - new Date(start_at)) / 36e5) * 10) / 10;
    if (!(hours > 0)) return res.status(400).json({ error: 'Thời gian không hợp lệ' });
  }

  let total = 0, breakdown = '';
  if (mode === 'monthly') {
    total = pkg.price_month || 0;
    breakdown = `Gói tháng${days_per_month ? ` · ${days_per_month} ngày/tháng` : ''}`;
  } else if (mode === 'shift') {
    total = pkg.price_shift || 0;
    breakdown = `1 ca ${pkg.shift_hours} giờ × ${(pkg.price_shift || 0).toLocaleString('vi-VN')} đ`;
  } else if (mode === 'procedure') {
    total = pkg.price_shift || 0;
    breakdown = 'Thủ thuật lẻ theo yêu cầu';
  } else {
    total = Math.round((pkg.price_hour || 0) * hours);
    breakdown = `${hours} giờ × ${(pkg.price_hour || 0).toLocaleString('vi-VN')} đ/giờ`;
  }

  res.json({
    package: pkg.name, mode, hours, total, breakdown,
    price_note: pkg.price_note || null
  });
}));

module.exports = router;
