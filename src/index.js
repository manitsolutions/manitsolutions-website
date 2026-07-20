// MANIT SOLUTIONS Payroll - Cloudflare Workers + Assets API
import POST_PAGE_HTML from './post-html.js';
var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
var JSON_CT = { 'Content-Type': 'application/json' };

function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 80) || 'post';
}

// Global Valmo session cache + helpers (accessible from any scope in the Worker)
globalThis.valmoSessionCache = { cookies: '', expires: 0 };
globalThis.getValmoSession = async function(force) {
  var now = Date.now();
  if (!force && globalThis.valmoSessionCache && globalThis.valmoSessionCache.cookies && globalThis.valmoSessionCache.expires > now) {
    return globalThis.valmoSessionCache.cookies;
  }
  try {
    var initResp = await fetch('https://console.valmo.in/operations/login', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    var cookies = '';
    initResp.headers.forEach(function(val, key) {
      if (key.toLowerCase() === 'set-cookie') {
        var nameVal = val.split(';')[0];
        if (cookies) cookies += '; ';
        cookies += nameVal;
      }
    });
    globalThis.valmoSessionCache = { cookies: cookies, expires: now + 300000 };
    return cookies;
  } catch(e) {
    return '';
  }
};

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    var method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    if (url.pathname === '/privacy' || url.pathname === '/privacy/') {
      return Response.redirect(new URL('/privacy.html', request.url), 301);
    }
    if (url.pathname === '/about' || url.pathname === '/about/') {
      return Response.redirect(new URL('/about.html', request.url), 301);
    }
    if (url.pathname === '/contact' || url.pathname === '/contact/') {
      return Response.redirect(new URL('/contact.html', request.url), 301);
    }

    if (url.pathname === '/sitemap.xml') {
      return handleSitemap(request, env);
    }

    if (url.pathname.match(/^\/post\/.+$/)) {
      return handlePostPage(request, env, url);
    }

    // VFM Auth — server-side OTP + login (avoids CORS/origin issues)
    if (url.pathname === '/vfm/auth/send-otp' && method === 'POST') {
      return handleVfmSendOtp(request);
    }
    if (url.pathname === '/vfm/auth/verify-otp' && method === 'POST') {
      return handleVfmVerifyOtp(request);
    }

    // VFM Ops API proxy
    if (url.pathname.startsWith('/ops/api/') || url.pathname.startsWith('/vfm/api/')) {
      return handleOpsProxy(request);
    }

    // VFM Debug: test manifest create
    if (url.pathname === '/vfm/_debug-create' && method === 'POST') {
      return handleDebugManifestCreate(request);
    }

    // VFM Ops pages — redirect to canonical /vfm/ URLs
    if (url.pathname === '/vfm' || url.pathname === '/ops' || url.pathname === '/ops.html') {
      return Response.redirect(new URL('/vfm/', request.url), 301);
    }
    if (url.pathname === '/vfm/login' || url.pathname === '/ops-login' || url.pathname === '/ops-login.html') {
      return Response.redirect(new URL('/vfm/login.html', request.url), 301);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleContact(env, request) {
  var body = await request.json();
  if (!body.name || !body.email || !body.message) {
    throw Object.assign(new Error('Name, email, and message are required'), { status: 400 });
  }
  await env.DB.prepare("INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)").bind(
    body.name, body.email, body.subject||'', body.message
  ).run();
  return { ok: true };
}

async function handlePostPage(request, env, url) {
  var slug = url.pathname.replace(/^\/post\//, '');
  var html = POST_PAGE_HTML;
  var base = 'https://manitsolutions.in';

  function escSsr(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  try {
    var row = await env.DB.prepare('SELECT title, excerpt, content, image_url, author, created_at, updated_at FROM posts WHERE slug=? AND published=1').bind(slug).first();
    if (row) {
      var title = escSsr(row.title || 'Post');
      var desc = escSsr(row.excerpt || row.title || '');
      var canonical = base + '/post/' + slug;
      var image = row.image_url ? escSsr(row.image_url) : '';
      var author = escSsr(row.author || 'Admin');
      var body = row.content || row.excerpt || '';
      var wordCount = body.replace(/<[^>]+>/g,'').split(/\s+/).filter(Boolean).length;
      var readTime = Math.max(1, Math.round(wordCount / 200));
      var dateStr = row.created_at ? new Date(row.created_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      var kw = (row.title + ' ' + (row.excerpt || '')).replace(/[^a-zA-Z0-9\s]/g,'').split(/\s+/).filter(function(w){return w.length>3;}).slice(0,10).join(', ').toLowerCase();

      var footer = '<div class="reading-time">\uD83D\uDD52 ' + readTime + ' min read &middot; ' + wordCount + ' words</div>';
      var heroStyle = image ? 'display:block;background-image:url(\'' + image + '\')' : 'display:none';

      // JSON-LD
      var ldArticle = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': row.title || '',
        'description': row.excerpt || row.title || '',
        'wordCount': wordCount,
        'author': { '@type': 'Person', 'name': row.author || 'Admin' },
        'publisher': { '@type': 'Organization', 'name': 'MANIT SOLUTIONS', 'logo': { '@type': 'ImageObject', 'url': base + '/assets/logo.png' } },
        'datePublished': row.created_at || '',
        'dateModified': row.updated_at || row.created_at || '',
        'mainEntityOfPage': { '@type': 'WebPage', '@id': canonical }
      };
      if (row.image_url) ldArticle.image = row.image_url;

      // Inject all SSR values
      html = html.split('__TITLE__').join(title);
      html = html.split('__DESC__').join(desc);
      html = html.split('__URL__').join(canonical);
      html = html.split('__AUTHOR__').join(author);
      html = html.split('__OGTITLE__').join(title);
      html = html.split('__OGDESC__').join(desc);
      html = html.split('__OGIMAGE__').join(image);
      html = html.split('__KW__').join(kw);
      html = html.split('__POST_TITLE__').join(title);
      html = html.split('__POST_AUTHOR__').join(author);
      html = html.split('__POST_DATE__').join(dateStr);
      html = html.split('__POST_BODY__').join(body);
      html = html.split('__POST_FOOTER__').join(footer);
      html = html.split('__HERO_STYLE__').join(heroStyle);
      // Inject JSON-LD into the head (right after the JSON-LD comment)
      html = html.replace('<!-- JSON-LD injected dynamically -->',
        '<script type="application/ld+json">' + JSON.stringify(ldArticle) + '</script>\n' +
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"MANIT SOLUTIONS","item":"' + base + '"},{"@type":"ListItem","position":2,"name":"' + title + '","item":"' + canonical + '"}]}</script>');
    } else {
      // Post not found — clear SSR markers
      html = html.split('__TITLE__').join('Post');
      html = html.split('__DESC__').join('');
      html = html.split('__URL__').join(base + '/post/' + slug);
      html = html.split('__AUTHOR__').join('');
      html = html.split('__OGTITLE__').join('');
      html = html.split('__OGDESC__').join('');
      html = html.split('__OGIMAGE__').join('');
      html = html.split('__KW__').join('');
      html = html.split('__POST_TITLE__').join('');
      html = html.split('__POST_AUTHOR__').join('');
      html = html.split('__POST_DATE__').join('');
      html = html.split('__POST_BODY__').join('');
      html = html.split('__POST_FOOTER__').join('');
      html = html.split('__HERO_STYLE__').join('display:none');
    }
  } catch(e) {
    // DB error — serve with empty content, JS will handle
    html = html.split('__TITLE__').join('Post');
    html = html.split('__DESC__').join('');
    html = html.split('__URL__').join('');
    html = html.split('__AUTHOR__').join('');
    html = html.split('__OGTITLE__').join('');
    html = html.split('__OGDESC__').join('');
    html = html.split('__OGIMAGE__').join('');
    html = html.split('__KW__').join('');
    html = html.split('__POST_TITLE__').join('');
    html = html.split('__POST_AUTHOR__').join('');
    html = html.split('__POST_DATE__').join('');
    html = html.split('__POST_BODY__').join('');
    html = html.split('__POST_FOOTER__').join('');
    html = html.split('__HERO_STYLE__').join('display:none');
  }
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

async function handleAPI(request, env) {
  var url = new URL(request.url);
  var path = url.pathname.replace(/^\/api\//, '');
  var method = request.method;

  try {
    await initDB(env);

    if (path === 'login' && method === 'POST') {
      return jsonResponse(await handleLogin(request, env));
    }

    if (path === 'me' && method === 'GET') {
      return jsonResponse(await handleMe(request, env));
    }

    if (path === 'seed' && method === 'POST') {
      return jsonResponse(await handleSeed(request, env));
    }

    if (path === 'seed/demo' && method === 'POST') {
      return jsonResponse(await handleSeedDemo(request, env));
    }

    if (path === 'posts' && method === 'GET' && url.searchParams.get('all') !== 'true') {
      var rows = await env.DB.prepare('SELECT id, title, excerpt, image_url, author, slug, created_at FROM posts WHERE published=1 ORDER BY created_at DESC').all();
      return jsonResponse(rows.results || []);
    }

    if (path.match(/^posts\/slug\/.+$/) && method === 'GET') {
      var slugFromPath = path.replace(/^posts\/slug\//, '');
      var row = await env.DB.prepare('SELECT * FROM posts WHERE slug=? AND published=1').bind(slugFromPath).first();
      if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: Object.assign({}, CORS, JSON_CT) });
      return new Response(JSON.stringify(row), { headers: Object.assign({}, CORS, JSON_CT) });
    }

    if (path.match(/^posts\/\d+$/) && method === 'GET') {
      var id = path.match(/^posts\/(\d+)$/)[1];
      var row = await env.DB.prepare('SELECT * FROM posts WHERE id=? AND published=1').bind(id).first();
      if (!row) throw Object.assign(new Error('Post not found'), { status: 404 });
      return jsonResponse(row);
    }

    // Public contact form (no auth required)
    if (path === 'contact' && method === 'POST') {
      return jsonResponse(await handleContact(env, request));
    }

    var user = await authenticate(request, env);
    return jsonResponse(await routeRequest(path, method, url, request, user, env));
  } catch (err) {
    var status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message }), { status: status, headers: Object.assign({}, CORS, JSON_CT) });
  }
}

function jsonResponse(body, status, extraHeaders) {
  if (body && body.body) {
    var headers = Object.assign({}, CORS, JSON_CT, body.headers || {});
    return new Response(JSON.stringify(body.body), { status: body.status || 200, headers: headers });
  }
  if (status === undefined) status = 200;
  var result = body === undefined ? { ok: true } : body;
  return new Response(JSON.stringify(result), { status: status, headers: Object.assign({}, CORS, JSON_CT, extraHeaders || {}) });
}

async function initDB(env) {
  var DB = env.DB;
  var inited = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if (inited) {
    await DB.exec('ALTER TABLE users ADD COLUMN permitted_menus TEXT DEFAULT \'[]\'').catch(function(){});
    await DB.exec('CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id)').catch(function(){});
    await DB.exec('CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)').catch(function(){});
    await DB.exec('CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date)').catch(function(){});
    await DB.exec('CREATE INDEX IF NOT EXISTS idx_salary_emp_month_year ON salary_records(employee_id, month, year)').catch(function(){});
    await DB.exec('CREATE INDEX IF NOT EXISTS idx_salary_month_year ON salary_records(month, year)').catch(function(){});
    await DB.exec('ALTER TABLE salary_records ADD COLUMN working_days INTEGER DEFAULT 26').catch(function(){});
    await DB.exec('ALTER TABLE salary_records ADD COLUMN present_days INTEGER DEFAULT 0').catch(function(){});
    await DB.exec('ALTER TABLE salary_records ADD COLUMN penalty REAL DEFAULT 0').catch(function(){});
    await DB.exec('ALTER TABLE salary_records ADD COLUMN advance REAL DEFAULT 0').catch(function(){});
    await DB.exec('ALTER TABLE salary_records ADD COLUMN deposit REAL DEFAULT 0').catch(function(){});
    await DB.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',excerpt TEXT DEFAULT '',image_url TEXT DEFAULT '',author TEXT DEFAULT 'Admin',published INTEGER DEFAULT 1,slug TEXT UNIQUE DEFAULT '',created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')))").catch(function(){});
    await DB.exec("ALTER TABLE posts ADD COLUMN slug TEXT DEFAULT ''").catch(function(){});
    var adminExists = await DB.prepare('SELECT id FROM users WHERE username = ?').bind('ManitSolutions').first();
    if (!adminExists) {
      var hash = await hashPassword('Manit@2407');
      await DB.prepare("INSERT OR IGNORE INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)").bind('ManitSolutions', hash, 'MANIT Administrator', 'admin').run();
    }
    return;
  }

  await DB.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',permitted_depts TEXT DEFAULT '[]',permitted_subdepts TEXT DEFAULT '[]',permitted_menus TEXT DEFAULT '[]',created_at TEXT DEFAULT (datetime('now')))");
  await DB.exec("CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,created_at TEXT DEFAULT (datetime('now')))");
  await DB.exec("CREATE TABLE IF NOT EXISTS subdepartments (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,department_id INTEGER NOT NULL,created_at TEXT DEFAULT (datetime('now')),FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE)");
  await DB.exec("CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,first_name TEXT NOT NULL,middle_name TEXT DEFAULT '',last_name TEXT NOT NULL,name_as_per_aadhar TEXT DEFAULT '',father_name TEXT DEFAULT '',mother_name TEXT DEFAULT '',gender TEXT DEFAULT '',marital_status TEXT DEFAULT '',religion TEXT DEFAULT '',date_of_birth TEXT DEFAULT '',blood_group TEXT DEFAULT '',category TEXT DEFAULT '',department_id INTEGER,sub_department_id INTEGER,designation TEXT DEFAULT '',joining_date TEXT DEFAULT '',mobile_number TEXT DEFAULT '',emergency_contact TEXT DEFAULT '',email_id TEXT DEFAULT '',current_address TEXT DEFAULT '',permanent_address TEXT DEFAULT '',aadhar_number TEXT DEFAULT '',pan_number TEXT DEFAULT '',voter_id TEXT DEFAULT '',driving_licence TEXT DEFAULT '',pf_number TEXT DEFAULT '',uan_number TEXT DEFAULT '',esic_number TEXT DEFAULT '',qualification TEXT DEFAULT '',university TEXT DEFAULT '',passing_year TEXT DEFAULT '',previous_company TEXT DEFAULT '',prev_designation TEXT DEFAULT '',total_experience TEXT DEFAULT '',exp_years TEXT DEFAULT '',exp_months TEXT DEFAULT '',nominee_name TEXT DEFAULT '',nominee_relation TEXT DEFAULT '',nominee_contact TEXT DEFAULT '',bank_name TEXT DEFAULT '',account_number TEXT DEFAULT '',ifsc_code TEXT DEFAULT '',bank_branch_details TEXT DEFAULT '',basic REAL DEFAULT 0,da REAL DEFAULT 0,hra REAL DEFAULT 0,photo TEXT DEFAULT '',status TEXT DEFAULT 'Active',created_at TEXT DEFAULT (datetime('now')),FOREIGN KEY (department_id) REFERENCES departments(id),FOREIGN KEY (sub_department_id) REFERENCES subdepartments(id))");
  await DB.exec("CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,marked_by INTEGER,marked_at TEXT DEFAULT (datetime('now')),FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,FOREIGN KEY (marked_by) REFERENCES users(id),UNIQUE(employee_id, date))");
  await DB.exec("CREATE TABLE IF NOT EXISTS salary_records (id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL,month INTEGER NOT NULL,year INTEGER NOT NULL,basic REAL DEFAULT 0,da REAL DEFAULT 0,hra REAL DEFAULT 0,gross REAL DEFAULT 0,pf REAL DEFAULT 0,esic REAL DEFAULT 0,pt REAL DEFAULT 0,net_pay REAL DEFAULT 0,paid INTEGER DEFAULT 0,working_days INTEGER DEFAULT 26,present_days INTEGER DEFAULT 0,penalty REAL DEFAULT 0,advance REAL DEFAULT 0,deposit REAL DEFAULT 0,generated_by INTEGER,generated_at TEXT DEFAULT (datetime('now')),FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,FOREIGN KEY (generated_by) REFERENCES users(id))");
  await DB.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)");
  await DB.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',excerpt TEXT DEFAULT '',image_url TEXT DEFAULT '',author TEXT DEFAULT 'Admin',published INTEGER DEFAULT 1,slug TEXT UNIQUE DEFAULT '',created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')))");
  await DB.exec("CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT DEFAULT (datetime('now')))");

  await DB.exec('CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id)').catch(function(){});
  await DB.exec('CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)').catch(function(){});
  // Soft delete / deactivation columns
  await DB.exec("ALTER TABLE employees ADD COLUMN exit_date TEXT DEFAULT ''").catch(function(){});
  await DB.exec("ALTER TABLE employees ADD COLUMN exit_reason TEXT DEFAULT ''").catch(function(){});
  // Face descriptor for face attendance
  await DB.exec("ALTER TABLE employees ADD COLUMN face_descriptor TEXT DEFAULT ''").catch(function(){});
  // Attendance method tracking
  await DB.exec("ALTER TABLE attendance ADD COLUMN method TEXT DEFAULT 'daily'").catch(function(){});
  await DB.exec('CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date)').catch(function(){});
  await DB.exec('CREATE INDEX IF NOT EXISTS idx_salary_emp_month_year ON salary_records(employee_id, month, year)').catch(function(){});
  await DB.exec('CREATE INDEX IF NOT EXISTS idx_salary_month_year ON salary_records(month, year)').catch(function(){});

  var hash = await hashPassword('Manit@2407');
  await DB.prepare("INSERT OR IGNORE INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)").bind('ManitSolutions', hash, 'MANIT Administrator', 'admin').run();
}

async function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  var hash = btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
  var saltB64 = btoa(String.fromCharCode.apply(null, salt));
  return saltB64 + ':' + hash;
}

async function verifyPassword(password, stored) {
  var parts = stored.split(':');
  var saltB64 = parts[0];
  var hash = parts[1];
  var salt = Uint8Array.from(atob(saltB64), function(c) { return c.charCodeAt(0); });
  var computed = await hashPassword(password, salt);
  return computed === stored;
}

async function getJWTSecret(env) {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  var row = await env.DB.prepare("SELECT value FROM settings WHERE key='jwt_secret'").first();
  if (row) return row.value;
  var secret = btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(32))));
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('jwt_secret', ?)").bind(secret).run();
  return secret;
}

async function createToken(user, env) {
  var secret = await getJWTSecret(env);
  var payload = { userId: user.id, username: user.username, role: user.role, menus: user.permittedMenus, exp: Date.now() + 86400000 };
  var data = btoa(JSON.stringify(payload));
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + btoa(String.fromCharCode.apply(null, new Uint8Array(sig)));
}

async function verifyToken(token, env) {
  try {
    var parts = token.split('.');
    var data = parts[0];
    var sigB64 = parts[1];
    var secret = await getJWTSecret(env);
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    var sig = Uint8Array.from(atob(sigB64), function(c) { return c.charCodeAt(0); });
    var valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    var payload = JSON.parse(atob(data));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

async function authenticate(request, env) {
  var auth = request.headers.get('Authorization') || '';
  var token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw authError('Authentication required');
  var payload = await verifyToken(token, env);
  if (!payload) throw authError('Invalid or expired token');
  return payload;
}

function authError(msg) { var e = new Error(msg); e.status = 401; return e; }
function adminRequired(user) { if (user.role !== 'admin') { var e = new Error('Admin access required'); e.status = 403; throw e; } }

async function handleLogin(request, env) {
  var body = await request.json();
  if (!body.username || !body.password) throw Object.assign(new Error('Username and password required'), { status: 400 });
  var row = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(body.username).first();
  if (!row) throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  var ok = await verifyPassword(body.password, row.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  var user = { id: row.id, username: row.username, name: row.name, role: row.role,
    permittedDepts: JSON.parse(row.permitted_depts || '[]'),
    permittedSubDepts: JSON.parse(row.permitted_subdepts || '[]'),
    permittedMenus: JSON.parse(row.permitted_menus || '[]') };
  var token = await createToken(user, env);
  return { body: { token: token, user: user }, headers: { 'Set-Cookie': 'token=' + token + '; Path=/; Max-Age=86400; SameSite=Strict' } };
}

async function handleMe(request, env) {
  var user = await authenticate(request, env);
  var row = await env.DB.prepare('SELECT id, username, name, role, permitted_depts, permitted_subdepts, permitted_menus FROM users WHERE id = ?').bind(user.userId).first();
  if (!row) throw Object.assign(new Error('User not found'), { status: 404 });
  return {
    body: {
      id: row.id, username: row.username, name: row.name, role: row.role,
      permittedDepts: JSON.parse(row.permitted_depts || '[]'),
      permittedSubDepts: JSON.parse(row.permitted_subdepts || '[]'),
      permittedMenus: JSON.parse(row.permitted_menus || '[]')
    }
  };
}

async function handleSeed(request, env) {
  var user = await authenticate(request, env);
  if (user.role !== 'admin') throw Object.assign(new Error('Admin access required'), { status: 403 });
  var DB = env.DB;
  var deptCount = await DB.prepare('SELECT COUNT(*) as c FROM departments').first();
  if (deptCount.c > 0) return { body: { ok: true, message: 'Already seeded' } };
  var deptNames = ['Engineering', 'Human Resources', 'Finance', 'Marketing', 'Operations'];
  var deptIds = [];
  for (var di = 0; di < deptNames.length; di++) {
    var r2 = await DB.prepare("INSERT INTO departments (name) VALUES (?) RETURNING id").bind(deptNames[di]).first();
    deptIds.push(r2.id);
  }
  var subData = [
    ['Web Development', deptIds[0]], ['Mobile Development', deptIds[0]], ['QA', deptIds[0]],
    ['Recruitment', deptIds[1]], ['Training', deptIds[1]],
    ['Accounts', deptIds[2]], ['Tax', deptIds[2]],
    ['Digital Marketing', deptIds[3]], ['Content', deptIds[3]],
    ['Admin', deptIds[4]], ['Logistics', deptIds[4]],
  ];
  for (var si = 0; si < subData.length; si++) {
    await DB.prepare("INSERT INTO subdepartments (name, department_id) VALUES (?, ?)").bind(subData[si][0], subData[si][1]).run();
  }
  return { body: { ok: true, message: 'Base data seeded. Call POST /api/seed/demo for 1000 demo employees.' } };
}

async function handleSeedDemo(request, env) {
  var user = await authenticate(request, env);
  if (user.role !== 'admin') throw Object.assign(new Error('Admin access required'), { status: 403 });
  var DB = env.DB;
  var deptCount2 = await DB.prepare('SELECT COUNT(*) as c FROM departments').first();
  if (deptCount2.c === 0) throw Object.assign(new Error('Run seed first'), { status: 400 });
  var empCount2 = await DB.prepare('SELECT COUNT(*) as c FROM employees').first();
  if (empCount2.c > 10) return { body: { ok: true, message: 'Demo employees already exist' } };
  var depts = (await DB.prepare('SELECT id FROM departments').all()).results;
  var subs = (await DB.prepare('SELECT id, department_id FROM subdepartments').all()).results;
  var subMap = {};
  for (var smi = 0; smi < subs.length; smi++) {
    if (!subMap[subs[smi].department_id]) subMap[subs[smi].department_id] = [];
    subMap[subs[smi].department_id].push(subs[smi].id);
  }
  var maleNames = ['Aarav','Vihaan','Vivaan','Advik','Kabir','Arjun','Reyansh','Ayaan','Ishaan','Shaurya','Yash','Pranav','Rohan','Krishna','Aryan','Dhruv','Rahul','Amit','Vikram','Rajesh','Suresh','Mahesh','Vijay','Sanjay','Deepak','Manish','Anil','Sunil','Nitin','Ravi','Pankaj','Gaurav','Sachin','Mukesh','Harish','Akash','Kunal','Varun','Mohit','Vishal','Abhishek','Hitesh','Nilesh','Prakash','Sandeep','Raj','Karan','Sameer','Ashish','Jatin'];
  var femaleNames = ['Priya','Neha','Riya','Anjali','Pooja','Aishwarya','Shreya','Kavita','Sneha','Divya','Shweta','Nisha','Megha','Swati','Anita','Sunita','Seema','Ritu','Komal','Deepika','Maya','Laxmi','Sita','Gita','Radha','Kiran','Tanvi','Isha','Aarohi','Bhavna'];
  var lastNames = ['Sharma','Verma','Singh','Gupta','Kumar','Patel','Shah','Reddy','Nair','Joshi','Deshmukh','Kulkarni','Pillai','Iyer','Rao','Naidu','Choudhury','Das','Banerjee','Chatterjee','Mukherjee','Bose','Sarkar','Sen','Mishra','Tiwari','Pandey','Dubey','Yadav','Jain','Agarwal','Mehta','Seth','Bhatia','Malhotra','Kapoor','Khanna','Chopra','Saxena','Srivastava','Prasad','Upadhyay','Tripathi','Bajaj','Wagh'];
  var designations = ['Junior Developer','Senior Developer','Team Lead','Project Manager','Tester','Analyst','Accountant','Executive','Coordinator','Assistant Manager','Manager','Senior Manager','Director','Consultant','Intern'];
  var genMobiles = function() { return '9' + String(Math.floor(7000000000 + Math.random() * 2000000000)).slice(0, 9); };
  var genEmail = function(fn, ln) { return (fn + '.' + ln + '@manitsolutions.in').toLowerCase(); };
  var stmts = [];
  for (var ei = 1; ei <= 1000; ei++) {
    var code = 'MS' + String(ei).padStart(5, '0');
    var gender = Math.random() < 0.55 ? 'Male' : 'Female';
    var fn = gender === 'Male' ? maleNames[Math.floor(Math.random() * maleNames.length)] : femaleNames[Math.floor(Math.random() * femaleNames.length)];
    var ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    var gen = gender;
    var dept = depts[Math.floor(Math.random() * depts.length)].id;
    var deptSubs = subMap[dept] || [null];
    var sub = deptSubs[Math.floor(Math.random() * deptSubs.length)];
    var des = designations[Math.floor(Math.random() * designations.length)];
    var mob = genMobiles();
    var em = genEmail(fn, ln);
    var basic = Math.round(15000 + Math.random() * 85000);
    var da2 = Math.round(basic * 0.2);
    var hra = Math.round(basic * 0.15);
    var hasPF = Math.random() < 0.7;
    var hasESIC = Math.random() < 0.4;
    var pfNo = hasPF ? 'PF/MANIT/' + String(10000 + ei) : '';
    var esicNo = hasESIC ? 'ESIC/MANIT/' + String(20000 + ei) : '';
    var uanNo = hasPF ? 'UAN/' + String(300000 + ei) : '';
    stmts.push(DB.prepare("INSERT INTO employees (code,first_name,last_name,gender,department_id,sub_department_id,designation,mobile_number,email_id,basic,da,hra,pf_number,esic_number,uan_number,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Active')").bind(code, fn, ln, gen, dept, sub, des, mob, em, basic, da2, hra, pfNo, esicNo, uanNo));
  }
  await DB.batch(stmts);
  return { body: { ok: true, message: '1000 demo employees created (MS00001–MS01000)' } };
}

async function routeRequest(path, method, url, request, user, env) {
  var DB = env.DB;

  // ── USERS ──
  if (path === 'users') {
    if (method === 'GET') {
      var rows2 = await DB.prepare("SELECT id, username, name, role, permitted_depts, permitted_subdepts, permitted_menus, created_at FROM users ORDER BY id").all();
      return { body: rows2.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      var body2 = await request.json();
      var hash2 = await hashPassword(body2.password);
      var r3 = await DB.prepare("INSERT INTO users (username, password_hash, name, role, permitted_depts, permitted_subdepts, permitted_menus) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, username, name, role").bind(body2.username, hash2, body2.name, body2.role || 'user', JSON.stringify(body2.permittedDepts || []), JSON.stringify(body2.permittedSubDepts || []), JSON.stringify(body2.permittedMenus || [])).first();
      return { body: r3, status: 201 };
    }
  }

  if (path.match(/^users\/(\d+)$/)) {
    var uid = path.match(/^users\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      var body3 = await request.json();
      if (body3.password) {
        var hash3 = await hashPassword(body3.password);
        await DB.prepare("UPDATE users SET password_hash=?, name=?, role=?, permitted_depts=?, permitted_subdepts=?, permitted_menus=? WHERE id=?").bind(hash3, body3.name, body3.role, JSON.stringify(body3.permittedDepts || []), JSON.stringify(body3.permittedSubDepts || []), JSON.stringify(body3.permittedMenus || []), uid).run();
      } else {
        await DB.prepare("UPDATE users SET name=?, role=?, permitted_depts=?, permitted_subdepts=?, permitted_menus=? WHERE id=?").bind(body3.name, body3.role, JSON.stringify(body3.permittedDepts || []), JSON.stringify(body3.permittedSubDepts || []), JSON.stringify(body3.permittedMenus || []), uid).run();
      }
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      var u2 = await DB.prepare('SELECT username FROM users WHERE id=?').bind(uid).first();
      if (u2 && u2.username === 'ManitSolutions') throw Object.assign(new Error('Cannot delete the built-in admin'), { status: 400 });
      await DB.prepare('DELETE FROM users WHERE id=?').bind(uid).run();
      return { body: { ok: true } };
    }
  }

  // ── DEPARTMENTS ──
  if (path === 'departments') {
    if (method === 'GET') {
      var depts2 = await DB.prepare('SELECT * FROM departments ORDER BY name').all();
      return { body: depts2.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      var body4 = await request.json();
      var r4 = await DB.prepare("INSERT INTO departments (name) VALUES (?) RETURNING id, name").bind(body4.name).first();
      return { body: r4, status: 201 };
    }
  }

  if (path.match(/^departments\/(\d+)$/)) {
    var did = path.match(/^departments\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      var body5 = await request.json();
      await DB.prepare('UPDATE departments SET name=? WHERE id=?').bind(body5.name, did).run();
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      var ec = await DB.prepare('SELECT COUNT(*) as c FROM employees WHERE department_id=?').bind(did).first();
      if (ec.c > 0) throw Object.assign(new Error('Cannot delete department with employees'), { status: 400 });
      await DB.prepare('DELETE FROM subdepartments WHERE department_id=?').bind(did).run();
      await DB.prepare('DELETE FROM departments WHERE id=?').bind(did).run();
      return { body: { ok: true } };
    }
  }

  // ── SUB-DEPARTMENTS ──
  if (path === 'subdepartments') {
    if (method === 'GET') {
      var deptId2 = url.searchParams.get('departmentId');
      var rows3;
      if (deptId2) {
        rows3 = await DB.prepare('SELECT * FROM subdepartments WHERE department_id=? ORDER BY name').bind(deptId2).all();
      } else {
        rows3 = await DB.prepare('SELECT * FROM subdepartments ORDER BY name').all();
      }
      return { body: rows3.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      var body6 = await request.json();
      var r5 = await DB.prepare("INSERT INTO subdepartments (name, department_id) VALUES (?, ?) RETURNING id, name, department_id").bind(body6.name, body6.departmentId).first();
      return { body: r5, status: 201 };
    }
  }

  if (path.match(/^subdepartments\/(\d+)$/)) {
    var sid = path.match(/^subdepartments\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      var body7 = await request.json();
      await DB.prepare('UPDATE subdepartments SET name=? WHERE id=?').bind(body7.name, sid).run();
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      await DB.prepare('DELETE FROM subdepartments WHERE id=?').bind(sid).run();
      return { body: { ok: true } };
    }
  }

  // ── EMPLOYEES ──
  if (path === 'employees') {
    if (method === 'GET') {
      var query = 'SELECT * FROM employees';
      var params = [];
      var conditions = [];

      // Default: only show active employees unless ?showAll=true
      if (url.searchParams.get('showAll') !== 'true') {
        conditions.push("status = 'Active'");
      }

      if (user.role !== 'admin') {
        var depts3 = user.permittedDepts || [];
        var subdepts = user.permittedSubDepts || [];
        if (depts3.length > 0) {
          conditions.push('department_id IN (' + depts3.map(function() { return '?'; }).join(',') + ')');
          params.push.apply(params, depts3);
        }
        if (subdepts.length > 0) {
          conditions.push('sub_department_id IN (' + subdepts.map(function() { return '?'; }).join(',') + ')');
          params.push.apply(params, subdepts);
        }
        if (depts3.length === 0 && subdepts.length === 0) {
          return { body: [] };
  }
}

// Get Valmo session cookies by hitting the login page (server-side only)
globalThis.valmoSessionCache = { cookies: '', expires: 0 };

async function getValmoSession(force) {
  var now = Date.now();
    if (!force && globalThis.valmoSessionCache && globalThis.valmoSessionCache.cookies && globalThis.valmoSessionCache.expires > now) {
    return globalThis.valmoSessionCache.cookies;
  }
  try {
    var initResp = await fetch('https://console.valmo.in/operations/login', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    var cookies = '';
    initResp.headers.forEach(function(val, key) {
      if (key.toLowerCase() === 'set-cookie') {
        var nameVal = val.split(';')[0];
        if (cookies) cookies += '; ';
        cookies += nameVal;
      }
    });
    globalThis.valmoSessionCache = { cookies: cookies, expires: now + 300000 };
    return cookies;
  } catch(e) {
    return '';
  }
}
      var deptFilter = url.searchParams.get('departmentId');
      if (deptFilter) {
        conditions.push('department_id = ?');
        params.push(deptFilter);
      }
      var subdeptFilter = url.searchParams.get('subDepartmentId');
      if (subdeptFilter) {
        conditions.push('sub_department_id = ?');
        params.push(subdeptFilter);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY first_name, last_name';
      var rows4 = await DB.prepare(query).bind.apply(DB.prepare(query), params).all();
      return { body: rows4.results };
    }
    if (method === 'POST') {
      adminRequired(user);
      var body8 = await request.json();
      var r6 = await DB.prepare("INSERT INTO employees (code,first_name,middle_name,last_name,name_as_per_aadhar,father_name,mother_name,gender,marital_status,religion,date_of_birth,blood_group,category,department_id,sub_department_id,designation,joining_date,mobile_number,emergency_contact,email_id,current_address,permanent_address,aadhar_number,pan_number,voter_id,driving_licence,pf_number,uan_number,esic_number,qualification,university,passing_year,previous_company,prev_designation,total_experience,exp_years,exp_months,nominee_name,nominee_relation,nominee_contact,bank_name,account_number,ifsc_code,bank_branch_details,basic,da,hra,photo,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id").bind(
        body8.code, body8.firstName, body8.middleName||'', body8.lastName, body8.nameAsPerAadhar||'', body8.fatherName||'', body8.motherName||'',
        body8.gender||'', body8.maritalStatus||'', body8.religion||'', body8.dateOfBirth||'', body8.bloodGroup||'', body8.category||'',
        body8.departmentId, body8.subDepartmentId, body8.designation||'', body8.joiningDate||'',
        body8.mobileNumber||'', body8.emergencyContact||'', body8.emailId||'', body8.currentAddress||'', body8.permanentAddress||'',
        body8.aadharNumber||'', body8.panNumber||'', body8.voterId||'', body8.drivingLicence||'',
        body8.pfNumber||'', body8.uanNumber||'', body8.esicNumber||'',
        body8.qualification||'', body8.university||'', body8.passingYear||'', body8.previousCompany||'', body8.prevDesignation||'',
        body8.totalExperience||'', body8.expYears||'', body8.expMonths||'',
        body8.nomineeName||'', body8.nomineeRelation||'', body8.nomineeContact||'',
        body8.bankName||'', body8.accountNumber||'', body8.ifscCode||'', body8.bankBranchDetails||'',
        body8.basic||0, body8.da||0, body8.hra||0, body8.photo||'', body8.status||'Active'
      ).first();
      return { body: Object.assign({ id: r6.id }, body8), status: 201 };
    }
  }

  // ── NEXT EMPLOYEE CODE (all employees, any department) ──
  if (path === 'employees/next-code' && method === 'GET') {
    var maxRow = await DB.prepare("SELECT MAX(CAST(REPLACE(code,'MS','') AS INTEGER)) as maxCode FROM employees").first();
    var nextNum = (maxRow && maxRow.maxCode ? maxRow.maxCode : 0) + 1;
    return { body: { code: 'MS' + String(nextNum).padStart(5, '0') } };
  }

  if (path === 'employees/all' && method === 'DELETE') {
    adminRequired(user);
    await DB.exec("UPDATE employees SET status='Inactive', exit_date=date('now'), exit_reason='Bulk Deactivated' WHERE status='Active'");
    return { body: { ok: true, deactivated: true } };
  }

  if (path.match(/^employees\/(\d+)$/)) {
    var eid = path.match(/^employees\/(\d+)$/)[1];
    if (method === 'GET') {
      var empRow = await DB.prepare('SELECT * FROM employees WHERE id=?').bind(eid).first();
      if (!empRow) throw Object.assign(new Error('Employee not found'), { status: 404 });
      return { body: empRow };
    }
    if (method === 'PUT') {
      adminRequired(user);
      var body9 = await request.json();
      await DB.prepare("UPDATE employees SET code=?,first_name=?,middle_name=?,last_name=?,name_as_per_aadhar=?,father_name=?,mother_name=?,gender=?,marital_status=?,religion=?,date_of_birth=?,blood_group=?,category=?,department_id=?,sub_department_id=?,designation=?,joining_date=?,mobile_number=?,emergency_contact=?,email_id=?,current_address=?,permanent_address=?,aadhar_number=?,pan_number=?,voter_id=?,driving_licence=?,pf_number=?,uan_number=?,esic_number=?,qualification=?,university=?,passing_year=?,previous_company=?,prev_designation=?,total_experience=?,exp_years=?,exp_months=?,nominee_name=?,nominee_relation=?,nominee_contact=?,bank_name=?,account_number=?,ifsc_code=?,bank_branch_details=?,basic=?,da=?,hra=?,photo=?,status=?,face_descriptor=? WHERE id=?").bind(
        body9.code||'', body9.firstName||'', body9.middleName||'', body9.lastName||'', body9.nameAsPerAadhar||'', body9.fatherName||'', body9.motherName||'',
        body9.gender||'', body9.maritalStatus||'', body9.religion||'', body9.dateOfBirth||'', body9.bloodGroup||'', body9.category||'',
        body9.departmentId||null, body9.subDepartmentId||null, body9.designation||'', body9.joiningDate||'',
        body9.mobileNumber||'', body9.emergencyContact||'', body9.emailId||'', body9.currentAddress||'', body9.permanentAddress||'',
        body9.aadharNumber||'', body9.panNumber||'', body9.voterId||'', body9.drivingLicence||'',
        body9.pfNumber||'', body9.uanNumber||'', body9.esicNumber||'',
        body9.qualification||'', body9.university||'', body9.passingYear||'', body9.previousCompany||'', body9.prevDesignation||'',
        body9.totalExperience||'', body9.expYears||'', body9.expMonths||'',
        body9.nomineeName||'', body9.nomineeRelation||'', body9.nomineeContact||'',
        body9.bankName||'', body9.accountNumber||'', body9.ifscCode||'', body9.bankBranchDetails||'',
        body9.basic||0, body9.da||0, body9.hra||0, body9.photo||'', body9.status||'Active',
        body9.faceDescriptor||'', eid
      ).run();
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      var bodyDel = await request.json().catch(function(){ return {}; });
      await DB.prepare("UPDATE employees SET status='Inactive', exit_date=?, exit_reason=? WHERE id=?").bind(
        bodyDel.exitDate || '', bodyDel.exitReason || 'Deactivated', eid
      ).run();
      return { body: { ok: true, deactivated: true } };
    }
  }

  // ── FACE DESCRIPTOR UPDATE ──
  if (path === 'employees/face' && method === 'PUT') {
    adminRequired(user);
    var faceBody = await request.json();
    await DB.prepare("UPDATE employees SET face_descriptor=? WHERE id=?").bind(
      JSON.stringify(faceBody.descriptor || []), faceBody.employeeId
    ).run();
    return { body: { ok: true } };
  }

  // ── ATTENDANCE ──
  if (path === 'attendance') {
    if (method === 'GET') {
      var empId = url.searchParams.get('employeeId');
      var month = url.searchParams.get('month');
      var year = url.searchParams.get('year');
      var q2 = 'SELECT * FROM attendance WHERE 1=1';
      var p2 = [];
      if (empId) { q2 += ' AND employee_id=?'; p2.push(empId); }
      if (month) { q2 += " AND cast(strftime('%m',date) as integer)=?"; p2.push(month); }
      if (year) { q2 += " AND strftime('%Y',date)=?"; p2.push(year); }
      q2 += ' ORDER BY date DESC';
      var rows5 = await DB.prepare(q2).bind.apply(DB.prepare(q2), p2).all();
      return { body: rows5.results };
    }
  }

  // ── ATTENDANCE AUDIT LOG ──
  if (path === 'attendance/audit' && method === 'GET') {
    var page2 = parseInt(url.searchParams.get('page')) || 1;
    var limit2 = parseInt(url.searchParams.get('limit')) || 200;
    var offset2 = (page2 - 1) * limit2;
    var empFilter = url.searchParams.get('employeeId');
    var methodFilter = url.searchParams.get('method');
    var dateFrom = url.searchParams.get('from');
    var dateTo = url.searchParams.get('to');
    var qAudit = "SELECT a.id, a.employee_id, a.date, a.status, a.marked_by, a.method, a.marked_at, e.code as emp_code, e.first_name, e.last_name, u.name as marked_by_name FROM attendance a LEFT JOIN employees e ON a.employee_id=e.id LEFT JOIN users u ON a.marked_by=u.id WHERE 1=1";
    var pAudit = [];
    if (empFilter) { qAudit += ' AND a.employee_id=?'; pAudit.push(empFilter); }
    if (methodFilter) { qAudit += ' AND a.method=?'; pAudit.push(methodFilter); }
    if (dateFrom) { qAudit += ' AND a.date>=?'; pAudit.push(dateFrom); }
    if (dateTo) { qAudit += ' AND a.date<=?'; pAudit.push(dateTo); }
    qAudit += ' ORDER BY a.marked_at DESC, a.date DESC LIMIT ? OFFSET ?';
    pAudit.push(limit2, offset2);
    var auditRows = await DB.prepare(qAudit).bind.apply(DB.prepare(qAudit), pAudit).all();
    return { body: auditRows.results };
  }

  // ── BATCH ATTENDANCE ──
  if (path === 'attendance/batch' && method === 'POST') {
    adminRequired(user);
    var body10 = await request.json();
    var records = body10.records;
    var stmt = DB.prepare("INSERT INTO attendance (employee_id, date, status, marked_by, method) VALUES (?, ?, ?, ?, ?) ON CONFLICT(employee_id, date) DO UPDATE SET status=excluded.status, marked_by=excluded.marked_by, method=excluded.method");
    for (var ri = 0; ri < records.length; ri++) {
      await stmt.bind(records[ri].employeeId, records[ri].date, records[ri].status, user.userId, records[ri].method || 'daily').run();
    }
    return { body: { ok: true, count: records.length } };
  }

  if (path.match(/^attendance\/(\d+)$/) && method === 'PUT') {
    adminRequired(user);
    var aid = path.match(/^attendance\/(\d+)$/)[1];
    var body11 = await request.json();
    await DB.prepare('UPDATE attendance SET status=?, marked_by=?, method=? WHERE id=?').bind(body11.status, user.userId, body11.method || 'daily', aid).run();
    return { body: { ok: true } };
  }

  // ── SALARY ──
  if (path === 'salary') {
    if (method === 'GET') {
      var empId2 = url.searchParams.get('employeeId');
      var month2 = url.searchParams.get('month');
      var year2 = url.searchParams.get('year');
      var q3 = "SELECT sr.*, e.first_name, e.last_name, e.code FROM salary_records sr JOIN employees e ON sr.employee_id=e.id WHERE 1=1";
      var p3 = [];
      if (empId2) { q3 += ' AND sr.employee_id=?'; p3.push(empId2); }
      if (month2) { q3 += ' AND sr.month=?'; p3.push(month2); }
      if (year2) { q3 += ' AND sr.year=?'; p3.push(year2); }
      q3 += ' ORDER BY sr.generated_at DESC';
      var rows6 = await DB.prepare(q3).bind.apply(DB.prepare(q3), p3).all();
      return { body: rows6.results };
    }
  }

  if (path === 'salary/generate' && method === 'POST') {
    adminRequired(user);
    var body12 = await request.json();
    var emp2 = await DB.prepare('SELECT * FROM employees WHERE id=?').bind(body12.employeeId).first();
    if (!emp2) throw Object.assign(new Error('Employee not found'), { status: 404 });
    var basic = emp2.basic || 0;
    var hra2 = emp2.hra || 0;
    var da3 = (body12.da !== undefined ? body12.da : emp2.da) || 0;
    var wd = body12.workingDays || 26;
    var pd = body12.presentDays || 0;
    var dailyRate = wd > 0 ? (basic + da3) / wd : 0;
    var gross = Math.round(dailyRate * pd) + hra2;
    var pf2 = emp2.pf_number ? Math.round(basic * 0.12) : 0;
    var esic2 = (emp2.esic_number && gross <= 21000) ? Math.round(gross * 0.0075) : 0;
    var pt = 0;
    if (gross <= 15000) pt = 0;
    else if (gross <= 25000) pt = 150;
    else if (gross <= 41667) pt = 200;
    else pt = 300;
    var pen = body12.penalty || 0;
    var adv = body12.advance || 0;
    var dep = body12.deposit || 0;
    var netPay = gross - pf2 - esic2 - pt - pen - adv - dep;
    var r7 = await DB.prepare("INSERT INTO salary_records (employee_id, month, year, basic, da, hra, gross, pf, esic, pt, net_pay, working_days, present_days, penalty, advance, deposit, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(body12.employeeId, body12.month, body12.year, basic, da3, hra2, gross, pf2, esic2, pt, netPay, wd, pd, pen, adv, dep, user.userId).first();
    return { body: { id: r7.id, employeeId: body12.employeeId, month: body12.month, year: body12.year, basic: basic, da: da3, hra: hra2, gross: gross, pf: pf2, esic: esic2, pt: pt, netPay: netPay, workingDays: wd, presentDays: pd, penalty: pen, advance: adv, deposit: dep }, status: 201 };
  }

  if (path === 'salary/generate-bulk' && method === 'POST') {
    adminRequired(user);
    var body13 = await request.json();
    if (!Array.isArray(body13.records) || body13.records.length === 0) {
      throw Object.assign(new Error('Send { month, year, records: [...] }'), { status: 400 });
    }
    // Delete only records for employees being regenerated (preserve others)
    var empIds = body13.records.map(function(r) { return r.employeeId; });
    var placeholders = empIds.map(function() { return '?'; }).join(',');
    var deleteParams = [body13.month, body13.year].concat(empIds);
    await DB.prepare('DELETE FROM salary_records WHERE month=? AND year=? AND employee_id IN (' + placeholders + ')').bind.apply(DB.prepare('DELETE FROM salary_records WHERE month=? AND year=? AND employee_id IN (' + placeholders + ')'), deleteParams).run();
    var results = [];
    for (var ri2 = 0; ri2 < body13.records.length; ri2++) {
      var rec = body13.records[ri2];
      var emp3 = await DB.prepare('SELECT * FROM employees WHERE id=?').bind(rec.employeeId).first();
      if (!emp3) continue;
      var basic2 = emp3.basic || 0;
      var hra3 = emp3.hra || 0;
      var da4 = (rec.da !== undefined ? rec.da : emp3.da) || 0;
      var wd2 = rec.workingDays || 26;
      var pd2 = rec.presentDays || 0;
      var dailyRate2 = wd2 > 0 ? (basic2 + da4) / wd2 : 0;
      var gross2 = Math.round(dailyRate2 * pd2) + hra3;
      var pf3 = emp3.pf_number ? Math.round(basic2 * 0.12) : 0;
      var esic3 = (emp3.esic_number && gross2 <= 21000) ? Math.round(gross2 * 0.0075) : 0;
      var pt2 = 0;
      if (gross2 <= 15000) pt2 = 0;
      else if (gross2 <= 25000) pt2 = 150;
      else if (gross2 <= 41667) pt2 = 200;
      else pt2 = 300;
      var pen2 = rec.penalty || 0;
      var adv2 = rec.advance || 0;
      var dep2 = rec.deposit || 0;
      var netPay2 = gross2 - pf3 - esic3 - pt2 - pen2 - adv2 - dep2;
      var ins2 = await DB.prepare("INSERT INTO salary_records (employee_id, month, year, basic, da, hra, gross, pf, esic, pt, net_pay, working_days, present_days, penalty, advance, deposit, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(rec.employeeId, body13.month, body13.year, basic2, da4, hra3, gross2, pf3, esic3, pt2, netPay2, wd2, pd2, pen2, adv2, dep2, user.userId).first();
      results.push({ id: ins2.id, employeeId: rec.employeeId, month: body13.month, year: body13.year, basic: basic2, da: da4, hra: hra3, gross: gross2, pf: pf3, esic: esic3, pt: pt2, netPay: netPay2, workingDays: wd2, presentDays: pd2, penalty: pen2, advance: adv2, deposit: dep2 });
    }
    return { body: { count: results.length, records: results }, status: 201 };
  }

  if (path.match(/^salary\/(\d+)$/)) {
    var sid2 = path.match(/^salary\/(\d+)$/)[1];
    if (method === 'GET') {
      var srow = await DB.prepare("SELECT sr.*, e.first_name, e.last_name, e.code, e.bank_name, e.account_number, e.ifsc_code, e.designation, e.department_id, e.sub_department_id FROM salary_records sr JOIN employees e ON sr.employee_id=e.id WHERE sr.id=?").bind(sid2).first();
      if (!srow) throw Object.assign(new Error('Salary record not found'), { status: 404 });
      return { body: srow };
    }
    if (method === 'PUT') {
      adminRequired(user);
      var body14 = await request.json();
      var updates = [];
      var vparams = [];
      if (body14.paid !== undefined) { updates.push('paid=?'); vparams.push(body14.paid ? 1 : 0); }
      if (body14.da !== undefined) { updates.push('da=?'); vparams.push(body14.da); }
      if (body14.penalty !== undefined) { updates.push('penalty=?'); vparams.push(body14.penalty); }
      if (body14.advance !== undefined) { updates.push('advance=?'); vparams.push(body14.advance); }
      if (body14.deposit !== undefined) { updates.push('deposit=?'); vparams.push(body14.deposit); }
      if (updates.length > 0) {
        if (body14.da !== undefined || body14.penalty !== undefined || body14.advance !== undefined || body14.deposit !== undefined) {
          var srow2 = await DB.prepare("SELECT sr.*, e.basic as emp_basic, e.hra as emp_hra, e.pf_number, e.esic_number FROM salary_records sr JOIN employees e ON sr.employee_id=e.id WHERE sr.id=?").bind(sid2).first();
          if (srow2) {
            var basic3 = srow2.emp_basic || 0;
            var hra4 = srow2.emp_hra || 0;
            var da5 = (body14.da !== undefined ? body14.da : srow2.da) || 0;
            var wd3 = srow2.working_days || 26;
            var pd3 = srow2.present_days || 0;
            var dailyRate3 = wd3 > 0 ? (basic3 + da5) / wd3 : 0;
            var gross3 = Math.round(dailyRate3 * pd3) + hra4;
            var pf4 = srow2.pf_number ? Math.round(basic3 * 0.12) : (srow2.pf || 0);
            var esic4 = (srow2.esic_number && gross3 <= 21000) ? Math.round(gross3 * 0.0075) : (srow2.esic || 0);
            var pt3 = 0;
            if (gross3 <= 15000) pt3 = 0;
            else if (gross3 <= 25000) pt3 = 150;
            else if (gross3 <= 41667) pt3 = 200;
            else pt3 = 300;
            var pen3 = body14.penalty !== undefined ? body14.penalty : (srow2.penalty || 0);
            var adv3 = body14.advance !== undefined ? body14.advance : (srow2.advance || 0);
            var dep3 = body14.deposit !== undefined ? body14.deposit : (srow2.deposit || 0);
            var netPay3 = gross3 - pf4 - esic4 - pt3 - pen3 - adv3 - dep3;
            updates.push('gross=?', 'net_pay=?', 'da=?');
            vparams.push(gross3, netPay3, da5);
          }
        }
        vparams.push(sid2);
        await DB.prepare('UPDATE salary_records SET ' + updates.join(',') + ' WHERE id=?').bind.apply(DB.prepare('UPDATE salary_records SET ' + updates.join(',') + ' WHERE id=?'), vparams).run();
      }
      return { body: { ok: true } };
    }
  }

  // ── EMPLOYEE IMPORT ──
  if (path === 'employees/import' && method === 'POST') {
    adminRequired(user);
    var body15 = await request.json();
    var employees = body15.employees || body15 || [];
    if (!Array.isArray(employees) || employees.length === 0) {
      throw Object.assign(new Error('Send { employees: [...] }'), { status: 400 });
    }
    var stmts2 = [];
    for (var ei2 = 0; ei2 < employees.length; ei2++) {
      var e2 = employees[ei2];
      stmts2.push(DB.prepare("INSERT INTO employees (code,first_name,middle_name,last_name,name_as_per_aadhar,father_name,mother_name,gender,marital_status,religion,date_of_birth,blood_group,category,department_id,sub_department_id,designation,joining_date,mobile_number,emergency_contact,email_id,current_address,permanent_address,aadhar_number,pan_number,voter_id,driving_licence,pf_number,uan_number,esic_number,qualification,university,passing_year,previous_company,prev_designation,total_experience,exp_years,exp_months,nominee_name,nominee_relation,nominee_contact,bank_name,account_number,ifsc_code,bank_branch_details,basic,da,hra,photo,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(
        e2.code||'', e2.firstName||'', e2.middleName||'', e2.lastName||'', e2.nameAsPerAadhar||'', e2.fatherName||'', e2.motherName||'',
        e2.gender||'', e2.maritalStatus||'', e2.religion||'', e2.dateOfBirth||'', e2.bloodGroup||'', e2.category||'',
        e2.departmentId||null, e2.subDepartmentId||null, e2.designation||'', e2.joiningDate||'',
        e2.mobileNumber||'', e2.emergencyContact||'', e2.emailId||'', e2.currentAddress||'', e2.permanentAddress||'',
        e2.aadharNumber||'', e2.panNumber||'', e2.voterId||'', e2.drivingLicence||'',
        e2.pfNumber||'', e2.uanNumber||'', e2.esicNumber||'',
        e2.qualification||'', e2.university||'', e2.passingYear||'', e2.previousCompany||'', e2.prevDesignation||'',
        e2.totalExperience||'', e2.expYears||'', e2.expMonths||'',
        e2.nomineeName||'', e2.nomineeRelation||'', e2.nomineeContact||'',
        e2.bankName||'', e2.accountNumber||'', e2.ifscCode||'', e2.bankBranchDetails||'',
        e2.basic||0, e2.da||0, e2.hra||0, e2.photo||'', e2.status||'Active'
      ));
    }
    await DB.batch(stmts2);
    return { body: { ok: true, count: employees.length } };
  }

  // ── SETTINGS ──
  if (path === 'settings') {
    if (method === 'GET') {
      var rows7 = await DB.prepare('SELECT * FROM settings').all();
      var obj = {};
      for (var sk = 0; sk < rows7.results.length; sk++) obj[rows7.results[sk].key] = rows7.results[sk].value;
      return { body: obj };
    }
    if (method === 'PUT') {
      adminRequired(user);
      var body16 = await request.json();
      for (var key in body16) {
        if (key === 'jwt_secret') continue;
        await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(key, String(body16[key])).run();
      }
      return { body: { ok: true } };
    }
  }

  // ── POSTS (admin CRUD) ──
  if (path === 'posts') {
    if (method === 'GET') {
      var rows8 = await DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
      return { body: rows8.results || [] };
    }
    if (method === 'POST') {
      adminRequired(user);
      var body17 = await request.json();
      var slug = body17.slug || makeSlug(body17.title);
      var slugOk = false;
      var attempts = 0;
      while (!slugOk && attempts < 20) {
        var existing = await DB.prepare("SELECT id FROM posts WHERE slug=? AND id!=(SELECT COALESCE(MAX(id),0) FROM posts WHERE slug=?)").bind(slug, slug).first();
        if (!existing) { slugOk = true; break; }
        slug = (makeSlug(body17.title) + '-' + (++attempts)).substring(0, 80);
      }
      var r8 = await DB.prepare("INSERT INTO posts (title, content, excerpt, image_url, author, published, slug) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, slug").bind(body17.title, body17.content || '', body17.excerpt || '', body17.image_url || '', body17.author || 'Admin', body17.published !== undefined ? (body17.published ? 1 : 0) : 1, slug).first();
      return { body: { id: r8.id, slug: r8.slug, ok: true }, status: 201 };
    }
  }

  if (path.match(/^posts\/(\d+)$/)) {
    var pid = path.match(/^posts\/(\d+)$/)[1];
    if (method === 'PUT') {
      adminRequired(user);
      var body18 = await request.json();
      var sets = [];
      var vals = [];
      if (body18.title !== undefined) { sets.push('title=?'); vals.push(body18.title); }
      if (body18.content !== undefined) { sets.push('content=?'); vals.push(body18.content); }
      if (body18.excerpt !== undefined) { sets.push('excerpt=?'); vals.push(body18.excerpt); }
      if (body18.image_url !== undefined) { sets.push('image_url=?'); vals.push(body18.image_url); }
      if (body18.author !== undefined) { sets.push('author=?'); vals.push(body18.author); }
      if (body18.published !== undefined) { sets.push('published=?'); vals.push(body18.published ? 1 : 0); }
      if (body18.slug !== undefined) { sets.push('slug=?'); vals.push(body18.slug); }
      sets.push("updated_at=datetime('now')");
      if (sets.length > 0) {
        vals.push(pid);
        await DB.prepare('UPDATE posts SET ' + sets.join(',') + ' WHERE id=?').bind.apply(DB.prepare('UPDATE posts SET ' + sets.join(',') + ' WHERE id=?'), vals).run();
      }
      return { body: { ok: true } };
    }
    if (method === 'DELETE') {
      adminRequired(user);
      await DB.prepare('DELETE FROM posts WHERE id=?').bind(pid).run();
      return { body: { ok: true } };
    }
  }

  // ── CONTACT MESSAGES (admin only) ──
  if (path === 'contact-messages') {
    adminRequired(user);
    if (method === 'GET') {
      var msgs = await DB.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
      return { body: msgs.results };
    }
  }

  throw Object.assign(new Error('Not found: ' + method + ' /api/' + path), { status: 404 });
}

async function handleSitemap(request, env) {
  var url = new URL(request.url);
  var origin = url.origin;
  var rows = [];
  try {
    rows = (await env.DB.prepare('SELECT slug, created_at, updated_at, title FROM posts WHERE published=1 ORDER BY created_at DESC').all()).results || [];
  } catch(e) { /* db might not exist yet */ }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage
  xml += '  <url><loc>' + origin + '/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>\n';

  // Static pages
  var staticPages = [
    { path: '/about.html', priority: '0.8', changefreq: 'monthly' },
    { path: '/contact.html', priority: '0.7', changefreq: 'monthly' },
    { path: '/privacy.html', priority: '0.3', changefreq: 'monthly' }
  ];

  for (var i = 0; i < staticPages.length; i++) {
    var p2 = staticPages[i];
    xml += '  <url><loc>' + origin + p2.path + '</loc><priority>' + p2.priority + '</priority><changefreq>' + p2.changefreq + '</changefreq></url>\n';
  }

  // Blog posts
  for (var j = 0; j < rows.length; j++) {
    var post = rows[j];
    var lastmod = post.updated_at || post.created_at || '';
    xml += '  <url>';
    xml += '<loc>' + origin + '/post/' + escXml(post.slug) + '</loc>';
    if (lastmod) xml += '<lastmod>' + lastmod.replace(' ', 'T') + 'Z</lastmod>';
    xml += '<priority>0.9</priority><changefreq>monthly</changefreq>';
    xml += '</url>\n';
  }

  xml += '</urlset>';

  return new Response(xml, { headers: { 'Content-Type': 'application/xml;charset=utf-8' } });

  function escXml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

// VFM Auth: Send OTP — server-side call with proper headers
async function handleVfmSendOtp(request) {
  var body = await request.json();
  var phone = (body.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) {
    return new Response(JSON.stringify({ error: 'Invalid phone number' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    var resp = await fetch('https://console.valmo.in/operations/api/v1/otp/' + phone, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://console.valmo.in',
        'Referer': 'https://console.valmo.in/operations/login',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    var data = await resp.json();
    // Forward any Set-Cookie from Valmo to browser
    var respH = new Headers({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    resp.headers.forEach(function(val, key) {
      if (key.toLowerCase() === 'set-cookie') {
        respH.append('Set-Cookie', val.replace(/;\s*Domain\s*=\s*[^;]+/gi, ''));
      }
    });
    return new Response(JSON.stringify(data), {
      status: resp.ok ? 200 : (data?.status?.code || resp.status),
      headers: respH
    });
  } catch (e) {
    return new Response(JSON.stringify({ status: { code: 500, message: e.message } }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// VFM Auth: Verify OTP — server-side call with proper headers + cookie persistence
async function handleVfmVerifyOtp(request) {
  var body = await request.json();
  var phone = (body.phone || '').replace(/\D/g, '');
  var otp = (body.otp || '').replace(/\D/g, '');
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: 'Phone and OTP required' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    // Step 1: Init session (get cookies from Valmo login page)
    var initResp = await fetch('https://console.valmo.in/operations/login', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    // Extract cookies from init response
    var cookies = '';
    var setCookieHeaders = [];
    initResp.headers.forEach(function(val, key) {
      if (key.toLowerCase() === 'set-cookie') {
        setCookieHeaders.push(val.split(';')[0]);
      }
    });
    cookies = setCookieHeaders.join('; ');

    // Forward cookies via Cookie header
    var reqHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://console.valmo.in',
      'Referer': 'https://console.valmo.in/operations/login',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (cookies) reqHeaders['Cookie'] = cookies;

    var resp = await fetch('https://console.valmo.in/operations/api/v1/login/otp', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify({ otp: otp, number: phone, callingSystem: 'B2B' })
    });
    var text = await resp.text();
    var data;
    try { data = JSON.parse(text); } catch(e) { data = null; }

    // After successful login, save Valmo session cookies into the global cache
    // (so subsequent proxy requests don't need to re-init)
    var respCookies = '';
    resp.headers.forEach(function(val, key) {
      if (key.toLowerCase() === 'set-cookie') {
        var cv = val.split(';')[0];
        if (respCookies) respCookies += '; ';
        respCookies += cv;
      }
    });
    var mergedCookies = cookies;
    if (respCookies) {
      // Merge init cookies + response cookies (response may update session)
      var all = {};
      (cookies ? cookies.split('; ') : []).forEach(function(c) { var p = c.indexOf('='); if (p>0) all[c.slice(0,p)] = c.slice(p+1); });
      respCookies.split('; ').forEach(function(c) { var p = c.indexOf('='); if (p>0) all[c.slice(0,p)] = c.slice(p+1); });
      mergedCookies = Object.keys(all).map(function(k) { return k + '=' + all[k]; }).join('; ');
    }
    if (mergedCookies) {
      var now = Date.now();
      globalThis.valmoSessionCache = { cookies: mergedCookies, expires: now + 3600000 }; // 1h cache
    }

    // Log the actual Valmo response for debugging
    console.log('Valmo verify response:', resp.status, text);

    var outStatus = data?.status?.code === 200 ? 200 : (data?.status?.code || resp.status || 500);

    // Build response — forward Valmo Set-Cookie headers to browser (so browser stores session)
    var h = new Headers({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    if (mergedCookies) {
      mergedCookies.split('; ').forEach(function(c) {
        h.append('Set-Cookie', c + '; Path=/; Max-Age=3600; SameSite=Lax');
      });
    }

    return new Response(JSON.stringify({
      status: data?.status || { code: resp.status, message: resp.statusText },
      response: data?.response || null,
      _debug: { httpStatus: resp.status, body: text }
    }), {
      status: outStatus,
      headers: h
    });
  } catch (e) {
    return new Response(JSON.stringify({ status: { code: 500, message: e.message } }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// VFM Debug: test manifest create with server-side session
async function handleDebugManifestCreate(request) {
  try {
    var body = await request.json();
    var cookies = await globalThis.getValmoSession();
    if (!cookies) {
      return new Response(JSON.stringify({ error: 'No Valmo session. Login via browser first.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    var proxyHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://console.valmo.in',
      'Referer': 'https://console.valmo.in/operations/login',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': cookies
    };
    var resp = await fetch('https://console.valmo.in/operations/api/hub/manifest', {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify(body)
    });
    var text = await resp.text();
    return new Response(JSON.stringify({
      status: resp.status,
      statusText: resp.statusText,
      body: text,
      cookiesLen: cookies.length
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}

// VFM Ops API Proxy — forwards /ops/api/* or /vfm/api/* to https://console.valmo.in/operations/api/*
async function handleOpsProxy(request) {
  var url = new URL(request.url);
  var targetPath = url.pathname.replace(/^\/(ops|vfm)\/api/, '/operations/api') + url.search;
  var targetUrl = 'https://console.valmo.in' + targetPath;

  // Read request body as text FIRST (before any stream operations)
  var bodyText = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try { bodyText = await request.text(); } catch(e) { bodyText = null; }
  }

  // Extract cookies from browser request (forwarded from login response)
  var browserHeaders = new Headers(request.headers);
  var browserCookies = browserHeaders.get('cookie') || '';

  // Valmo-specific headers (Android app's OkHttpClient interceptor)
  var proxyHeaders = new Headers({
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': 'https://console.valmo.in',
    'Referer': 'https://console.valmo.in/operations/login',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36'
  });
  // Copy relevant browser-originated headers (Authorization, Content-Type)
  ['authorization', 'content-type'].forEach(function(key) {
    if (browserHeaders.has(key)) proxyHeaders.set(key, browserHeaders.get(key));
  });
  // Inject Valmo cookies: try browser cookies first, fall back to server-side auto-init
  if (!browserCookies || browserCookies.trim() === '') {
    // No cookie in browser — auto-init server-side
    browserCookies = await globalThis.getValmoSession();
  }
  if (browserCookies) proxyHeaders.set('Cookie', browserCookies);

  var proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: bodyText,
    redirect: 'follow'
  });

  try {
    var response = await fetch(proxyRequest);

    // Handle 401 - session might be stale, re-init and retry once
    if (response.status === 401 && browserCookies) {
      browserCookies = await globalThis.getValmoSession(true);
      if (browserCookies) {
        proxyHeaders.set('Cookie', browserCookies);
        proxyRequest = new Request(targetUrl, {
          method: request.method,
          headers: proxyHeaders,
          body: bodyText,
          redirect: 'follow'
        });
        response = await fetch(proxyRequest);
      }
    }

    var respHeaders = new Headers(response.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    respHeaders.set('Access-Control-Allow-Credentials', 'true');

    // Rewrite all Set-Cookie headers — strip Domain attribute so browser accepts cookies for our origin
    // Cloudflare Workers `fetch()` may return multiple Set-Cookie headers; iterate all headers
    var cookieHeaders = [];
    respHeaders.forEach(function(value, key) {
      if (key.toLowerCase() === 'set-cookie') {
        cookieHeaders.push(value.replace(/;\s*Domain\s*=\s*[^;]+/gi, ''));
      }
    });
    if (cookieHeaders.length > 0) {
      respHeaders.delete('Set-Cookie');
      cookieHeaders.forEach(function(c) { respHeaders.append('Set-Cookie', c); });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
