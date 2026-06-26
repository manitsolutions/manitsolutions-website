// ═══════════════════════════════════════════════════════════════════
// MANIT SOLUTIONS Payroll — Frontend API Layer
// ═══════════════════════════════════════════════════════════════════
// Replaces all localStorage calls with fetch() to the Worker API.
// Token stored in sessionStorage (cleared on tab close).
// ═══════════════════════════════════════════════════════════════════

const API = {
  BASE: '/api',

  // ── Token management ──
  getToken() { return sessionStorage.getItem('pw_token') || localStorage.getItem('pw_token'); },
  setToken(t) {
    if (t) { sessionStorage.setItem('pw_token', t); localStorage.setItem('pw_token', t); }
    else { sessionStorage.removeItem('pw_token'); localStorage.removeItem('pw_token'); }
  },

  // ── Current user cache ──
  currentUser: null,

  // ── Generic request ──
  async request(method, path, body) {
    const url = `${this.BASE}/${path}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },

  // ── Auth ──
  async login(username, password) {
    const res = await this.post('login', { username, password });
    this.setToken(res.token);
    this.currentUser = res.user;
    return res.user;
  },

  async me() {
    if (this.currentUser) return this.currentUser;
    try {
      const user = await this.get('me');
      this.currentUser = user;
      return user;
    } catch { return null; }
  },

  logout() {
    this.setToken(null);
    this.currentUser = null;
  },

  // ── Users (admin only) ──
  async getUsers() { return this.get('users'); },
  async createUser(u) { return this.post('users', u); },
  async updateUser(id, u) { return this.put(`users/${id}`, u); },
  async deleteUser(id) { return this.del(`users/${id}`); },

  // ── Departments ──
  async getDepartments() { return this.get('departments'); },
  async createDepartment(name) { return this.post('departments', { name }); },
  async updateDepartment(id, name) { return this.put(`departments/${id}`, { name }); },
  async deleteDepartment(id) { return this.del(`departments/${id}`); },

  // ── Sub-Departments ──
  async getSubDepartments(deptId) {
    const q = deptId ? `?departmentId=${deptId}` : '';
    return this.get(`subdepartments${q}`);
  },
  async createSubDepartment(name, departmentId) { return this.post('subdepartments', { name, departmentId }); },
  async updateSubDepartment(id, name) { return this.put(`subdepartments/${id}`, { name }); },
  async deleteSubDepartment(id) { return this.del(`subdepartments/${id}`); },

  // ── Employees ──
  async getEmployees(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get(`employees${q}`);
  },
  async getEmployee(id) { return this.get(`employees/${id}`); },
  async createEmployee(e) { return this.post('employees', e); },
  async updateEmployee(id, e) { return this.put(`employees/${id}`, e); },
  async deleteEmployee(id) { return this.del(`employees/${id}`); },

  // ── Attendance ──
  async getAttendance(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get(`attendance${q}`);
  },
  async batchAttendance(records) { return this.post('attendance/batch', { records }); },
  async updateAttendance(id, status) { return this.put(`attendance/${id}`, { status }); },

  // ── Salary ──
  async getSalary(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get(`salary${q}`);
  },
  async generateSalary(employeeId, month, year) { return this.post('salary/generate', { employeeId, month, year }); },
  async updateSalary(id, data) { return this.put(`salary/${id}`, data); },
  async getPayslip(id) { return this.get(`salary/${id}`); },

  // ── Settings ──
  async getSettings() { return this.get('settings'); },
  async updateSettings(s) { return this.put('settings', s); },

  // ── Seed ──
  async seedData() { return this.post('seed', {}); },
};

// Auto-restore session
(async function initAPI() {
  if (API.getToken()) {
    try {
      API.currentUser = await API.me();
    } catch {
      API.setToken(null);
    }
  }
})();
