'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Log gon tung request cho de theo doi khi phat trien
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path}`);
  next();
});

// Giao dien tinh
app.use(express.static(path.join(__dirname, '..', 'public')));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/caregivers', require('./routes/caregivers'));
app.use('/api/elders', require('./routes/elders'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'An Lão API' }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy endpoint' }));

// Trang khong khop route tinh thi tra ve trang chu
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Xu ly loi tap trung
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Lỗi hệ thống' });
});

app.listen(PORT, () => {
  console.log(`An Lão đang chạy tại http://localhost:${PORT}`);
});

module.exports = app;
