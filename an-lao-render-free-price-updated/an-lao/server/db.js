'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/anlao.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- ========== NGUOI DUNG ==========
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL CHECK (role IN ('family','caregiver','elder','admin')),
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_color  TEXT DEFAULT '#1C74B8',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ho so nghe nghiep cua cham soc vien
CREATE TABLE IF NOT EXISTS caregivers (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio              TEXT,
  years_experience INTEGER DEFAULT 0,
  specialties      TEXT DEFAULT '[]',   -- JSON array
  certificates     TEXT DEFAULT '[]',   -- JSON array
  city             TEXT,
  district         TEXT,
  lat              REAL,
  lng              REAL,
  verified         INTEGER DEFAULT 0,
  rating_avg       REAL DEFAULT 0,
  rating_count     INTEGER DEFAULT 0,
  available_days   TEXT DEFAULT '[]'    -- JSON array: 2..8 (T2..CN)
);

-- ========== NGUOI CAO TUOI ==========
CREATE TABLE IF NOT EXISTS elders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  elder_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL, -- tai khoan rieng cho cu (neu co)
  full_name      TEXT NOT NULL,
  birth_year     INTEGER,
  gender         TEXT CHECK (gender IN ('nam','nu','khac')),
  phone          TEXT,
  address        TEXT,
  lat            REAL,
  lng            REAL,
  relation       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== HO SO SUC KHOE SO ==========
CREATE TABLE IF NOT EXISTS health_records (
  elder_id     INTEGER PRIMARY KEY REFERENCES elders(id) ON DELETE CASCADE,
  blood_type   TEXT,
  conditions   TEXT DEFAULT '[]',  -- JSON: benh ly nen
  allergies    TEXT DEFAULT '[]',  -- JSON: di ung
  medications  TEXT DEFAULT '[]',  -- JSON: [{name, dose, time, note}]
  habits       TEXT,               -- thoi quen sinh hoat
  mobility     TEXT,               -- kha nang van dong
  care_notes   TEXT,
  next_checkup TEXT,               -- ngay tai kham
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chi so sinh ton ghi nhan theo thoi gian
CREATE TABLE IF NOT EXISTS vitals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  elder_id    INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  booking_id  INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  systolic    INTEGER,   -- huyet ap tam thu
  diastolic   INTEGER,   -- huyet ap tam truong
  heart_rate  INTEGER,
  temperature REAL,
  glucose     REAL,
  sleep_hours REAL,
  note        TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== GOI DICH VU ==========
CREATE TABLE IF NOT EXISTS packages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  target       TEXT,        -- doi tuong muc tieu
  details      TEXT,        -- chi tiet nghiep vu
  tasks        TEXT DEFAULT '[]', -- JSON: checklist mac dinh cho e-logbook
  shift_hours  INTEGER,     -- so gio moi ca
  price_shift  INTEGER,     -- gia moi ca (VND)
  price_hour   INTEGER,     -- gia moi gio (VND)
  price_month  INTEGER,     -- gia thang (VND)
  price_month_max INTEGER,
  price_note   TEXT,
  sort_order   INTEGER DEFAULT 0
);

-- ========== DAT LICH ==========
CREATE TABLE IF NOT EXISTS bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT UNIQUE NOT NULL,
  elder_id       INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  family_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  package_id     INTEGER REFERENCES packages(id),
  mode           TEXT NOT NULL CHECK (mode IN ('hourly','shift','monthly','procedure')),
  start_at       TEXT NOT NULL,
  end_at         TEXT NOT NULL,
  hours          REAL,
  address        TEXT,
  lat            REAL,
  lng            REAL,
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  total_amount   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Checklist cong viec (E-Logbook)
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due_time   TEXT,
  done       INTEGER NOT NULL DEFAULT 0,
  done_at    TEXT,
  note       TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Cap nhat tinh hinh gui ve gia dinh (anh, hoat dong, ghi chu)
CREATE TABLE IF NOT EXISTS updates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT NOT NULL CHECK (type IN ('photo','activity','meal','note','vital')),
  content    TEXT,
  image_url  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vet GPS cua cham soc vien trong ca lam
CREATE TABLE IF NOT EXISTS tracking_points (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== THANH TOAN ==========
CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  method     TEXT NOT NULL CHECK (method IN ('cash','card','transfer')),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed')),
  txn_ref    TEXT,
  paid_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== DANH GIA ==========
CREATE TABLE IF NOT EXISTS reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id     INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  family_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== NHAC NHO (giao dien nguoi cao tuoi) ==========
CREATE TABLE IF NOT EXISTS reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  elder_id    INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('medicine','checkup','exercise','water','other')),
  title       TEXT NOT NULL,
  detail      TEXT,
  time_of_day TEXT NOT NULL,        -- 'HH:MM'
  days        TEXT DEFAULT '[2,3,4,5,6,7,8]', -- JSON, 2=T2 ... 8=CN
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ca lam trong (caregiver dang ky nhan)
CREATE TABLE IF NOT EXISTS shift_applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  caregiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  message      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (booking_id, caregiver_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_family    ON bookings(family_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_caregiver ON bookings(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status    ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_vitals_elder       ON vitals(elder_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_updates_booking    ON updates(booking_id);
CREATE INDEX IF NOT EXISTS idx_tasks_booking      ON tasks(booking_id);
`);

module.exports = db;
