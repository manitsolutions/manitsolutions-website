// ═══════════════════════════════════════════════════════════════════
// MANIT SOLUTIONS Payroll — Cloudflare Workers + Assets API
// ═══════════════════════════════════════════════════════════════════
// Bindings:
//   DB — D1 database (manit-payroll-db)
//   JWT_SECRET — Worker Secret (auto-generated if missing)
//   ASSETS — Static asset serving (built-in Workers + Assets)
// ═══════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const JSON_CT = { 'Content-Type': 'application/json' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // ── API routes ──
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // ── Static assets (fallback) ──
    return env.ASSETS.fetch(request);
  }
};

// ═══════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, '');
  const method = request.method;

  try {
    await initDB(env);

    let result;
    if (path === 'login' && method === 'POST') {
      result = await handleLogin(request, env);
    } else if (path === 'me' && method === 'GET') {
      result = await handleMe(request, env);
    } else if (path === 'seed' && method === 'POST') {
      result = await handleSeed(request, env);
    } else {
      const user = await authenticate(request, env);
      result = await routeRequest(path, method, url, request, user, env);
    }

    if (result && result.body) {
      const headers = { ...CORS, ...JSON_CT, ...result.headers };
      return new Response(JSON.stringify(result.body), {
        status: result.status || 200,
        headers,
      });
    }
    return new Response(JSON.stringify(result || { ok: true }), {
      status: 200,
      headers: { ...CORS, ...JSON_CT },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.status || 500,
      headers: { ...CORS, ...JSON_CT },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DATABASE INIT
// ═══════════════════════════════════════════════════════════════════
async function initDB(env) {
  const DB = env.DB;
  const inited = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if (inited) {
    const adminExists = await DB.prepare("SELECT id FROM users WHERE username = ?").bind('ManitSolutions').first();
    if (!adminExists) {
      const hash = await hashPassword('Manit@2407');
      await DB.prepare(
        "INSERT OR IGNORE INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)"
      ).bind('ManitSolutions', hash, 'MANIT Administrator', 'admin').run();
    }
    return;
  }

  await DB.exec(`
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
  `);

  // Seed admin user
  const hash = await hashPassword('Manit@2407');
  await DB.prepare(
    "INSERT OR IGNORE INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).bind('ManitSolutions', hash, 'MANIT Administrator', 'admin').run();
}

// ═══════════════════════════════════════════════════════════════════
// PASSWORD HASHING (PBKDF2-HMAC-SHA256)
// ═══════════════════════════════════════════════════════════════════
async function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltB64 = btoa(String.fromCharCode(...salt));
  return `${saltB64}:${hash}`;
}

async function verifyPassword(password, stored) {
  const [saltB64, hash] = stored.split(':');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const computed = await hashPassword(password, salt);
  return computed === stored;
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN AUTH (HMAC-SHA256 stateless tokens)
// ═══════════════════════════════════════════════════════════════════
async function getJWTSecret(env) {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  let row = await env.DB.prepare("SELECT value FROM settings WHERE key='jwt_secret'").first();
  if (row) return row.value;
  const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('jwt_secret', ?)").bind(secret).run();
  return secret;
}

async function createToken(user, env) {
  const secret = await getJWTSecret(env);
  const payload = { userId: user.id, username: user.username, role: user.role, exp: Date.now() + 86400000 };
  const data = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyToken(token, env) {
  try {
    const [data, sigB64] = token.split('.');
    const secret = await getJWTSecret(env);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(data));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════
async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw authError('Authentication required');
  const payload = await verifyToken(token, env);
  if (!payload) throw authError('Invalid or expired token');
  return payload;
}

function authError(msg) { const e = new Error(msg); e.status = 401; return e; }
function adminRequired(user) { if (user.role !== 'admin') { const e = new Error('Admin access required'); e.status = 403; throw e; } }

// ═══════════════════════════════════════════════════════════════════
// LOGIN HANDLER
// ═══════════════════════════════════════════════════════════════════
async function handleLogin(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) throw Object.assign(new Error('Username and password required'), { status: 400 });

  const row = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  if (!row) throw Object.assign(new Error('Invalid username or password'), { status: 401 });

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid username or password'), { status: 401 });

  const user = { id: row.id, username: row.username, name: row.name, role: row.role,
    permittedDepts: JSON.parse(row.permitted_depts || '[]'),
    permittedSubDepts: JSON.parse(row.permitted_subdepts || '[]') };

  const token = await createToken(user, env);

  return { body: { token, user }, headers: { 'Set-Cookie': `token=${token}; Path=/; Max-Age=86400; SameSite=Strict` } };
}

async function handleMe(request, env) {
  const user = await authenticate(request, env);
  const row = await env.DB.prepare("SELECT id, username, name, role, permitted_depts, permitted_subdepts FROM users WHERE id = ?").bind(user.userId).first();
  if (!row) throw Object.assign(new Error('User not found'), { status: 404 });
  return {
    body: {
      id: row.id, username: row.username, name: row.name, role: row.role,
      permittedDepts: JSON.parse(row.permitted_depts || '[]'),
      permittedSubDepts: JSON.parse(row.permitted_subdepts || '[]')
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════
async function handleSeed(request, env) {
  const user = await authenticate(request, env);
  if (user.role !== 'admin') throw Object.assign(new Error('Admin access required'), { status: 403 });
  const DB = env.DB;

  const count = await DB.prepare("SELECT COUNT(*) as c FROM departments").first();
  if (count.c > 0) return { body: { ok: true, message: 'Already seeded' } };

  const deptNames = ['Engineering', 'Human Resources', 'Finance', 'Marketing', 'Operations'];
  const deptIds = [];
  for (const name of deptNames) {
    const r = await DB.prepare("INSERT INTO departments (name) VALUES (?) RETURNING id").bind(name).first();
    deptIds.push(r.id);
  }

  const subData = [
    ['Web Development', deptIds[0]], ['Mobile Development', deptIds[0]], ['QA', deptIds[0]],
    ['Recruitment', deptIds[1]], ['Training', deptIds[1]],
    ['Accounts', deptIds[2]], ['Tax', deptIds[2]],
    ['Digital Marketing', deptIds[3]], ['Content', deptIds[3]],
    ['Admin', deptIds[4]], ['Logistics', deptIds[4]],
  ];
  const subIds = [];
  for (const [n, d] of subData) {
    const r = await DB.prepare("INSERT INTO subdepartments (name, department_id) VALUES (?, ?) RETURNING id").bind(n, d).first();
    subIds.push(r.id);
  }

  const emps = [
    { code:'EMP001', fn:'Rahul', ln:'Sharma', gen:'Male', dep:deptIds[0], sub:subIds[0], des:'Senior Developer', mob:'9876543210', em:'rahul@manitsolutions.com', b:80000, d:16000, h:15000 },
    { code:'EMP002', fn:'Priya', ln:'Singh', gen:'Female', dep:deptIds[0], sub:subIds[1], des:'Mobile Developer', mob:'9876543211', em:'priya@manitsolutions.com', b:65000, d:13000, h:12000 },
    { code:'EMP003', fn:'Amit', ln:'Verma', gen:'Male', dep:deptIds[2], sub:subIds[5], des:'Accountant', mob:'9876543214', em:'amit@manitsolutions.com', b:35000, d:7000, h:6000 },
    { code:'EMP004', fn:'Sneha', ln:'Gupta', gen:'Female', dep:deptIds[3], sub:subIds[7], des:'Marketing Lead', mob:'9876543216', em:'sneha@manitsolutions.com', b:42000, d:8400, h:7500 },
    { code:'EMP005', fn:'Vikram', ln:'Singh', gen:'Male', dep:deptIds[4], sub:subIds[9], des:'Operations Head', mob:'9876543218', em:'vikram@manitsolutions.com', b:60000, d:12000, h:11000 },
  ];
  for (const e of emps) {
    await DB.prepare(
      "INSERT INTO employees (code,first_name,last_name,gender,department_id,sub_department_id,designation,mobile_number,email_id,basic,da,hra,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'Active')"
    ).bind(e.code, e.fn, e.ln, e.gen, e.dep, e.sub, e.des, e.mob, e.em, e.b, e.d, e.h).run();
  }

  return { body: { ok: true, message: 'Sample data seeded' } };
}

// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════
async function routeRequest(path, method, url, request, user, env) {
  const DB = env.DB;

  // ── USERS ──
  if (path === 'users') {
    if (method === 'GET') {
      const rows = await DB.prepare("SELECT id, username, name, role, permitted_depts, permitted_subdepts, created_at FROM users ORDER BY id").all();
      return { body: rows.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      const body = await request.json();
      const hash = await hashPassword(body.password);
      const r = await DB.prepare(
        "INSERT INTO users (username, password_hash, name, role, permitted_depts, permitted_subdepts) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, username, name, role"
      ).bind(body.username, hash, body.name, body.role || 'user', JSON.stringify(body.permittedDepts || []), JSON.stringify(body.permittedSubDepts || [])).first();
      return { body: r, status: 201 };
    }
  }

  if (path.match(/^users\/(\d+)$/)) {
    const id = path.match(/^users\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      const body = await request.json();
      if (body.password) {
        const hash = await hashPassword(body.password);
        await DB.prepare("UPDATE users SET password_hash=?, name=?, role=?, permitted_depts=?, permitted_subdepts=? WHERE id=?")
          .bind(hash, body.name, body.role, JSON.stringify(body.permittedDepts || []), JSON.stringify(body.permittedSubDepts || []), id).run();
      } else {
        await DB.prepare("UPDATE users SET name=?, role=?, permitted_depts=?, permitted_subdepts=? WHERE id=?")
          .bind(body.name, body.role, JSON.stringify(body.permittedDepts || []), JSON.stringify(body.permittedSubDepts || []), id).run();
      }
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      const u = await DB.prepare("SELECT username FROM users WHERE id=?").bind(id).first();
      if (u && u.username === 'ManitSolutions') throw Object.assign(new Error('Cannot delete the built-in admin'), { status: 400 });
      await DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
      return { body: { ok: true } };
    }
  }

  // ── DEPARTMENTS ──
  if (path === 'departments') {
    if (method === 'GET') {
      const rows = await DB.prepare("SELECT * FROM departments ORDER BY name").all();
      return { body: rows.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      const body = await request.json();
      const r = await DB.prepare("INSERT INTO departments (name) VALUES (?) RETURNING id, name").bind(body.name).first();
      return { body: r, status: 201 };
    }
  }

  if (path.match(/^departments\/(\d+)$/)) {
    const id = path.match(/^departments\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      const body = await request.json();
      await DB.prepare("UPDATE departments SET name=? WHERE id=?").bind(body.name, id).run();
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      const empCount = await DB.prepare("SELECT COUNT(*) as c FROM employees WHERE department_id=?").bind(id).first();
      if (empCount.c > 0) throw Object.assign(new Error('Cannot delete department with employees'), { status: 400 });
      await DB.prepare("DELETE FROM subdepartments WHERE department_id=?").bind(id).run();
      await DB.prepare("DELETE FROM departments WHERE id=?").bind(id).run();
      return { body: { ok: true } };
    }
  }

  // ── SUB-DEPARTMENTS ──
  if (path === 'subdepartments') {
    if (method === 'GET') {
      const deptId = url.searchParams.get('departmentId');
      let rows;
      if (deptId) {
        rows = await DB.prepare("SELECT * FROM subdepartments WHERE department_id=? ORDER BY name").bind(deptId).all();
      } else {
        rows = await DB.prepare("SELECT * FROM subdepartments ORDER BY name").all();
      }
      return { body: rows.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      const body = await request.json();
      const r = await DB.prepare("INSERT INTO subdepartments (name, department_id) VALUES (?, ?) RETURNING id, name, department_id")
        .bind(body.name, body.departmentId).first();
      return { body: r, status: 201 };
    }
  }

  if (path.match(/^subdepartments\/(\d+)$/)) {
    const id = path.match(/^subdepartments\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      const body = await request.json();
      await DB.prepare("UPDATE subdepartments SET name=? WHERE id=?").bind(body.name, id).run();
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      await DB.prepare("DELETE FROM subdepartments WHERE id=?").bind(id).run();
      return { body: { ok: true } };
    }
  }

  // ── EMPLOYEES ──
  if (path === 'employees') {
    if (method === 'GET') {
      let query = "SELECT * FROM employees";
      const params = [];
      const conditions = [];

      if (user.role !== 'admin') {
        const depts = user.permittedDepts || [];
        const subdepts = user.permittedSubDepts || [];
        if (depts.length > 0) {
          conditions.push(`department_id IN (${depts.map(() => '?').join(',')})`);
          params.push(...depts);
        }
        if (subdepts.length > 0) {
          conditions.push(`sub_department_id IN (${subdepts.map(() => '?').join(',')})`);
          params.push(...subdepts);
        }
        if (depts.length === 0 && subdepts.length === 0) {
          return { body: [] };
        }
      }

      const deptFilter = url.searchParams.get('departmentId');
      if (deptFilter) {
        conditions.push("department_id = ?");
        params.push(deptFilter);
      }
      const subdeptFilter = url.searchParams.get('subDepartmentId');
      if (subdeptFilter) {
        conditions.push("sub_department_id = ?");
        params.push(subdeptFilter);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(' AND ');
      }
      query += " ORDER BY first_name, last_name";

      const rows = await DB.prepare(query).bind(...params).all();
      return { body: rows.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      const body = await request.json();
      const r = await DB.prepare(`
        INSERT INTO employees (code,first_name,middle_name,last_name,name_as_per_aadhar,father_name,mother_name,
          gender,marital_status,religion,date_of_birth,blood_group,category,
          department_id,sub_department_id,designation,joining_date,
          mobile_number,emergency_contact,email_id,current_address,permanent_address,
          aadhar_number,pan_number,voter_id,driving_licence,
          pf_number,uan_number,esic_number,
          qualification,university,passing_year,previous_company,prev_designation,
          total_experience,exp_years,exp_months,
          nominee_name,nominee_relation,nominee_contact,
          bank_name,account_number,ifsc_code,bank_branch_details,
          basic,da,hra,photo,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        RETURNING id
      `).bind(
        body.code, body.firstName, body.middleName||'', body.lastName, body.nameAsPerAadhar||'', body.fatherName||'', body.motherName||'',
        body.gender||'', body.maritalStatus||'', body.religion||'', body.dateOfBirth||'', body.bloodGroup||'', body.category||'',
        body.departmentId, body.subDepartmentId, body.designation||'', body.joiningDate||'',
        body.mobileNumber||'', body.emergencyContact||'', body.emailId||'', body.currentAddress||'', body.permanentAddress||'',
        body.aadharNumber||'', body.panNumber||'', body.voterId||'', body.drivingLicence||'',
        body.pfNumber||'', body.uanNumber||'', body.esicNumber||'',
        body.qualification||'', body.university||'', body.passingYear||'', body.previousCompany||'', body.prevDesignation||'',
        body.totalExperience||'', body.expYears||'', body.expMonths||'',
        body.nomineeName||'', body.nomineeRelation||'', body.nomineeContact||'',
        body.bankName||'', body.accountNumber||'', body.ifscCode||'', body.bankBranchDetails||'',
        body.basic||0, body.da||0, body.hra||0, body.photo||'', body.status||'Active'
      ).first();
      return { body: { id: r.id, ...body }, status: 201 };
    }
  }

  if (path.match(/^employees\/(\d+)$/)) {
    const id = path.match(/^employees\/(\d+)$/)[1];
    if (method === 'GET') {
      const row = await DB.prepare("SELECT * FROM employees WHERE id=?").bind(id).first();
      if (!row) throw Object.assign(new Error('Employee not found'), { status: 404 });
      return { body: row };
    }
    if (method === 'PUT') {
      adminRequired(user);
      const body = await request.json();
      await DB.prepare(`
        UPDATE employees SET
          code=?,first_name=?,middle_name=?,last_name=?,name_as_per_aadhar=?,father_name=?,mother_name=?,
          gender=?,marital_status=?,religion=?,date_of_birth=?,blood_group=?,category=?,
          department_id=?,sub_department_id=?,designation=?,joining_date=?,
          mobile_number=?,emergency_contact=?,email_id=?,current_address=?,permanent_address=?,
          aadhar_number=?,pan_number=?,voter_id=?,driving_licence=?,
          pf_number=?,uan_number=?,esic_number=?,
          qualification=?,university=?,passing_year=?,previous_company=?,prev_designation=?,
          total_experience=?,exp_years=?,exp_months=?,
          nominee_name=?,nominee_relation=?,nominee_contact=?,
          bank_name=?,account_number=?,ifsc_code=?,bank_branch_details=?,
          basic=?,da=?,hra=?,photo=?,status=?
        WHERE id=?
      `).bind(
        body.code, body.firstName, body.middleName||'', body.lastName, body.nameAsPerAadhar||'', body.fatherName||'', body.motherName||'',
        body.gender||'', body.maritalStatus||'', body.religion||'', body.dateOfBirth||'', body.bloodGroup||'', body.category||'',
        body.departmentId, body.subDepartmentId, body.designation||'', body.joiningDate||'',
        body.mobileNumber||'', body.emergencyContact||'', body.emailId||'', body.currentAddress||'', body.permanentAddress||'',
        body.aadharNumber||'', body.panNumber||'', body.voterId||'', body.drivingLicence||'',
        body.pfNumber||'', body.uanNumber||'', body.esicNumber||'',
        body.qualification||'', body.university||'', body.passingYear||'', body.previousCompany||'', body.prevDesignation||'',
        body.totalExperience||'', body.expYears||'', body.expMonths||'',
        body.nomineeName||'', body.nomineeRelation||'', body.nomineeContact||'',
        body.bankName||'', body.accountNumber||'', body.ifscCode||'', body.bankBranchDetails||'',
        body.basic||0, body.da||0, body.hra||0, body.photo||'', body.status||'Active',
        id
      ).run();
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      await DB.prepare("DELETE FROM employees WHERE id=?").bind(id).run();
      return { body: { ok: true } };
    }
  }

  // ── ATTENDANCE ──
  if (path === 'attendance') {
    if (method === 'GET') {
      const empId = url.searchParams.get('employeeId');
      const month = url.searchParams.get('month');
      const year = url.searchParams.get('year');
      let query = "SELECT * FROM attendance WHERE 1=1";
      const params = [];
      if (empId) { query += " AND employee_id=?"; params.push(empId); }
      if (month) { query += " AND cast(strftime('%m',date) as integer)=?"; params.push(month); }
      if (year) { query += " AND strftime('%Y',date)=?"; params.push(year); }
      query += " ORDER BY date";
      const rows = await DB.prepare(query).bind(...params).all();
      return { body: rows.results };
    }
  }

  if (path === 'attendance/batch' && method === 'POST') {
    adminRequired(user);
    const body = await request.json();
    const { records } = body;
    const stmt = DB.prepare(
      "INSERT INTO attendance (employee_id, date, status, marked_by) VALUES (?, ?, ?, ?) ON CONFLICT(employee_id, date) DO UPDATE SET status=excluded.status, marked_by=excluded.marked_by"
    );
    for (const r of records) {
      await stmt.bind(r.employeeId, r.date, r.status, user.userId).run();
    }
    return { body: { ok: true, count: records.length } };
  }

  if (path.match(/^attendance\/(\d+)$/) && method === 'PUT') {
    adminRequired(user);
    const id = path.match(/^attendance\/(\d+)$/)[1];
    const body = await request.json();
    await DB.prepare("UPDATE attendance SET status=?, marked_by=? WHERE id=?").bind(body.status, user.userId, id).run();
    return { body: { ok: true } };
  }

  // ── SALARY ──
  if (path === 'salary') {
    if (method === 'GET') {
      const empId = url.searchParams.get('employeeId');
      const month = url.searchParams.get('month');
      const year = url.searchParams.get('year');
      let query = "SELECT sr.*, e.first_name, e.last_name, e.code FROM salary_records sr JOIN employees e ON sr.employee_id=e.id WHERE 1=1";
      const params = [];
      if (empId) { query += " AND sr.employee_id=?"; params.push(empId); }
      if (month) { query += " AND sr.month=?"; params.push(month); }
      if (year) { query += " AND sr.year=?"; params.push(year); }
      query += " ORDER BY sr.generated_at DESC";
      const rows = await DB.prepare(query).bind(...params).all();
      return { body: rows.results };
    }
  }

  if (path === 'salary/generate' && method === 'POST') {
    adminRequired(user);
    const body = await request.json();
    const { employeeId, month, year } = body;
    const emp = await DB.prepare("SELECT * FROM employees WHERE id=?").bind(employeeId).first();
    if (!emp) throw Object.assign(new Error('Employee not found'), { status: 404 });

    const basic = emp.basic || 0;
    const da = emp.da || 0;
    const hra = emp.hra || 0;
    const gross = basic + da + hra;
    const pf = Math.round(basic * 0.12);
    const esic = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    let pt = 0;
    if (gross <= 15000) pt = 0;
    else if (gross <= 25000) pt = 150;
    else if (gross <= 41667) pt = 200;
    else pt = 300;
    const netPay = gross - pf - esic - pt;

    const r = await DB.prepare(`
      INSERT INTO salary_records (employee_id, month, year, basic, da, hra, gross, pf, esic, pt, net_pay, generated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(employeeId, month, year, basic, da, hra, gross, pf, esic, pt, netPay, user.userId).first();

    return { body: { id: r.id, employeeId, month, year, basic, da, hra, gross, pf, esic, pt, netPay }, status: 201 };
  }

  if (path.match(/^salary\/(\d+)$/)) {
    const id = path.match(/^salary\/(\d+)$/)[1];
    if (method === 'GET') {
      const row = await DB.prepare("SELECT sr.*, e.first_name, e.last_name, e.code, e.bank_name, e.account_number, e.ifsc_code, e.designation, e.department_id, e.sub_department_id FROM salary_records sr JOIN employees e ON sr.employee_id=e.id WHERE sr.id=?").bind(id).first();
      if (!row) throw Object.assign(new Error('Salary record not found'), { status: 404 });
      return { body: row };
    }
    if (method === 'PUT') {
      adminRequired(user);
      const body = await request.json();
      await DB.prepare("UPDATE salary_records SET paid=? WHERE id=?").bind(body.paid ? 1 : 0, id).run();
      return { body: { ok: true } };
    }
  }

  // ── SETTINGS ──
  if (path === 'settings') {
    if (method === 'GET') {
      const rows = await DB.prepare("SELECT * FROM settings").all();
      const obj = {};
      for (const r of rows.results) obj[r.key] = r.value;
      return { body: obj };
    }
    if (method === 'PUT') {
      adminRequired(user);
      const body = await request.json();
      for (const [key, value] of Object.entries(body)) {
        if (key === 'jwt_secret') continue;
        await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(key, String(value)).run();
      }
      return { body: { ok: true } };
    }
  }

  throw Object.assign(new Error(`Not found: ${method} /api/${path}`), { status: 404 });
}
