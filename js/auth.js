/* باربي Barbii — نظام المصادقة والصلاحيات */
(function () {
  "use strict";

  const AUTH_KEY = "barbii_auth_v1";
  const SESSION_KEY = "barbii_session_v1";
  const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

  const ROLES = {
    admin: { name: "مدير النظام", permissions: ["*"] },
    manager: { name: "مدير الفرع", permissions: ["products:read", "products:write", "products:delete", "orders:read", "orders:write", "orders:status", "reports:read", "settings:read", "settings:write", "pos:access"] },
    cashier: { name: "كاشير", permissions: ["products:read", "orders:read", "orders:write", "pos:access"] },
    viewer: { name: "مشاهدة فقط", permissions: ["products:read", "orders:read", "reports:read"] }
  };

  const DEFAULT_USERS = [
    { id: "u1", username: "admin", password: hashPassword("admin123"), role: "admin", name: "المدير العام", active: true },
    { id: "u2", username: "manager", password: hashPassword("manager123"), role: "manager", name: "مدير الفرع", active: true },
    { id: "u3", username: "cashier", password: hashPassword("cashier123"), role: "cashier", name: "كاشير 1", active: true },
  ];

  function hashPassword(password) {
    const salt = "barbii_salt_2026";
    let hash = 0;
    const str = password + salt;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return "sha256$" + Math.abs(hash).toString(16) + "$" + btoa(str).slice(0, 16);
  }

  function verifyPassword(password, hashed) {
    return hashPassword(password) === hashed;
  }

  function createSession(user) {
    const session = { userId: user.id, username: user.username, role: user.role, name: user.name, createdAt: Date.now(), expiresAt: Date.now() + SESSION_DURATION };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    return session;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.expiresAt < Date.now()) { clearSession(); return null; }
      return session;
    } catch (e) { return null; }
  }

  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function refreshSession() {
    const session = getSession();
    if (session) { session.expiresAt = Date.now() + SESSION_DURATION; localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
    return session;
  }

  function loadUsers() {
    try { const raw = localStorage.getItem(AUTH_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }

  function saveUsers(users) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(users)); } catch (e) {} }

  function findUser(username) { return loadUsers().find(u => u.username === username); }
  function findUserById(id) { return loadUsers().find(u => u.id === id); }

  function login(username, password) {
    const user = findUser(username);
    if (!user) return { success: false, error: "المستخدم غير موجود" };
    if (!user.active) return { success: false, error: "الحساب معطل" };
    if (!verifyPassword(password, user.password)) return { success: false, error: "كلمة مرور خاطئة" };
    const session = createSession(user);
    return { success: true, user: session };
  }

  function logout() { clearSession(); window.location.reload(); }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const user = findUserById(session.userId);
    if (!user || !user.active) { clearSession(); return null; }
    return { ...session, permissions: ROLES[session.role]?.permissions || [] };
  }

  function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    const perms = user.permissions;
    return perms.includes("*") || perms.includes(permission);
  }

  function requirePermission(permission) { if (!hasPermission(permission)) throw new Error("غير مصرح: " + permission); }
  function requireRole(...roles) { const user = getCurrentUser(); if (!user || !roles.includes(user.role)) throw new Error("يتطلب دور: " + roles.join(" 或 ")); }

  function renderLoginForm() {
    return `
      <div class="login-container">
        <div class="login-box">
          <div class="login-header">
            <span class="logo-emoji">🎀</span>
            <h1>باربي Barbii</h1>
            <p class="subtitle">تسجيل الدخول للنظام</p>
          </div>
          <form id="loginForm" class="login-form">
            <div class="form-group"><label for="username">اسم المستخدم</label><input type="text" id="username" name="username" required autocomplete="username" placeholder="admin / manager / cashier"></div>
            <div class="form-group"><label for="password">كلمة المرور</label><input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••"></div>
            <button type="submit" class="btn btn-pink btn-block">🔐 دخول</button>
          </form>
          <div class="login-hints"><details><summary>💡 حسابات تجريبية</summary><table class="hint-table"><tr><th>الدور</th><th>المستخدم</th><th>كلمة المرور</th></tr><tr><td>👑 مدير</td><td>admin</td><td>admin123</td></tr><tr><td>👔 مدير فرع</td><td>manager</td><td>manager123</td></tr><tr><td>🧾 كاشير</td><td>cashier</td><td>cashier123</td></tr></table></details></div>
          <div id="loginError" class="login-error hidden"></div>
        </div>
      </div>`;
  }

  function showLoginError(msg) { const el = document.getElementById("loginError"); if (el) { el.textContent = msg; el.classList.remove("hidden"); } }
  function hideLoginError() { const el = document.getElementById("loginError"); if (el) el.classList.add("hidden"); }

  function bindLoginForm() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault(); hideLoginError();
      const fd = new FormData(form);
      const username = String(fd.get("username") || "").trim();
      const password = String(fd.get("password") || "");
      const result = login(username, password);
      if (result.success) { window.location.reload(); } else { showLoginError("❌ " + result.error); }
    });
  }

  function protectRoute(requiredPermission) {
    const user = getCurrentUser();
    if (!user) { showAuthScreen(); return false; }
    if (requiredPermission && !hasPermission(requiredPermission)) { showAccessDenied(requiredPermission); return false; }
    return true;
  }

  function showAuthScreen() {
    const app = document.getElementById("app");
    if (app) { app.innerHTML = renderLoginForm(); bindLoginForm(); document.getElementById("username").focus(); }
  }

  function showAccessDenied(permission) {
    const app = document.getElementById("app");
    if (app) { app.innerHTML = `<div class="login-container"><div class="login-box" style="max-width:400px"><div class="login-header"><span style="font-size:48px">🚫</span><h1>非授权</h1><p class="subtitle">没有权限: <code>${permission}</code></p></div><button class="btn btn-pink btn-block" onclick="window.location.reload()">🔄 重新登录</button></div></div>`; }
  }

  function initAuthApp(startAppCallback) {
    const user = getCurrentUser();
    if (!user) { showAuthScreen(); return; }
    refreshSession();
    window.BARBII_USER = user;
    if (startAppCallback) startAppCallback(user);
  }

  window.BARBII_AUTH = { login, logout, getCurrentUser, hasPermission, requirePermission, requireRole, loadUsers, saveUsers, findUser, findUserById, ROLES, initAuthApp, protectRoute, hashPassword, verifyPassword };

  const style = document.createElement("style");
  style.textContent = `.login-container{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#fff7fb,#ede9fe)}.login-box{background:#fff;border:1px solid #f3d9e8;border-radius:24px;padding:32px;width:100%;max-width:420px;box-shadow:0 20px 50px rgba(190,24,93,.15)}.login-header{text-align:center;margin-bottom:24px}.login-header .logo-emoji{font-size:56px;background:linear-gradient(135deg,#ec4899,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.login-header h1{margin:8px 0 0;font-size:28px;background:linear-gradient(135deg,#ec4899,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.subtitle{color:#6b7280;margin:8px 0 0;font-size:14px}.login-form{display:flex;flex-direction:column;gap:16px}.form-group{display:flex;flex-direction:column;gap:6px}.form-group label{font-weight:700;font-size:14px;color:#374151}.form-group input{border:2px solid #f3d9e8;border-radius:12px;padding:14px 16px;font-size:16px;outline:none;transition:border-color .2s}.form-group input:focus{border-color:#ec4899}.login-hints{margin-top:20px}.login-hints summary{cursor:pointer;color:#8b5cf6;font-weight:700;font-size:13px}.hint-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}.hint-table th,.hint-table td{padding:8px;text-align:center;border-bottom:1px solid #f3d9e8}.hint-table th{background:#fdf2f8;color:#be185d}.hint-table code{background:#f3d9e8;padding:2px 6px;border-radius:6px;font-family:monospace}.login-error{color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;font-weight:700;text-align:center;animation:shake .4s}.login-error.hidden{display:none}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}.hidden{display:none!important}`;
  document.head.appendChild(style);
})();