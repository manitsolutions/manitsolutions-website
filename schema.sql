-- MANIT SOLUTIONS Payroll — D1 Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  permitted_depts TEXT DEFAULT '[]',
  permitted_subdepts TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subdepartments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT DEFAULT '',
  last_name TEXT NOT NULL,
  name_as_per_aadhar TEXT DEFAULT '',
  father_name TEXT DEFAULT '',
  mother_name TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  marital_status TEXT DEFAULT '',
  religion TEXT DEFAULT '',
  date_of_birth TEXT DEFAULT '',
  blood_group TEXT DEFAULT '',
  category TEXT DEFAULT '',
  department_id INTEGER,
  sub_department_id INTEGER,
  designation TEXT DEFAULT '',
  joining_date TEXT DEFAULT '',
  mobile_number TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  email_id TEXT DEFAULT '',
  current_address TEXT DEFAULT '',
  permanent_address TEXT DEFAULT '',
  aadhar_number TEXT DEFAULT '',
  pan_number TEXT DEFAULT '',
  voter_id TEXT DEFAULT '',
  driving_licence TEXT DEFAULT '',
  pf_number TEXT DEFAULT '',
  uan_number TEXT DEFAULT '',
  esic_number TEXT DEFAULT '',
  qualification TEXT DEFAULT '',
  university TEXT DEFAULT '',
  passing_year TEXT DEFAULT '',
  previous_company TEXT DEFAULT '',
  prev_designation TEXT DEFAULT '',
  total_experience TEXT DEFAULT '',
  exp_years TEXT DEFAULT '',
  exp_months TEXT DEFAULT '',
  nominee_name TEXT DEFAULT '',
  nominee_relation TEXT DEFAULT '',
  nominee_contact TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  ifsc_code TEXT DEFAULT '',
  bank_branch_details TEXT DEFAULT '',
  basic REAL DEFAULT 0,
  da REAL DEFAULT 0,
  hra REAL DEFAULT 0,
  photo TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (sub_department_id) REFERENCES subdepartments(id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  marked_by INTEGER,
  marked_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id),
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS salary_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic REAL DEFAULT 0,
  da REAL DEFAULT 0,
  hra REAL DEFAULT 0,
  gross REAL DEFAULT 0,
  pf REAL DEFAULT 0,
  esic REAL DEFAULT 0,
  pt REAL DEFAULT 0,
  net_pay REAL DEFAULT 0,
  paid INTEGER DEFAULT 0,
  generated_by INTEGER,
  generated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed MANIT Solutions admin user (password: Manit@2407)
-- PBKDF2-HMAC-SHA256 hash will be computed at runtime by the Worker
-- This row is inserted by the Worker on first run if not exists
