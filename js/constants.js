/* باربي Barbii — الثوابت المشتركة */
(function () {
  "use strict";

  /* ========== مفاتيح التخزين ========== */
  const STORAGE_KEYS = {
    DB: "barbii_db_v1",
    AUTH: "barbii_auth_v1",
    SESSION: "barbii_session_v1",
    IMAGES: "barbii_images_v1",
    CART: "barbii_cart"
  };

  /* ========== إعدادات التطبيق ========== */
  const APP_CONFIG = {
    NAME: "باربي Barbii",
    VERSION: "1.0.0",
    CURRENCY: "د.ع",
    LOCALE: "ar-IQ",
    RTL: true,
    SESSION_DURATION: 7 * 24 * 60 * 60 * 1000,
    MAX_IMAGE_SIZE: 2 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
    DEFAULT_DELIVERY_FEE: 5000,
    DEFAULT_FREE_ABOVE: 50000
  };

  /* ========== IndexedDB ========== */
  const IDB_CONFIG = {
    NAME: "BarbiiDB",
    VERSION: 2,
    STORES: {
      products: { keyPath: "id", indexes: ["category", "sku"] },
      orders: { keyPath: "id", indexes: ["channel", "status", "date"] },
      settings: { keyPath: "key" },
      images: { keyPath: "productId" },
      cart: { keyPath: "key" },
      auth: { keyPath: "username", indexes: ["role"] },
      sessions: { keyPath: "sessionId" },
      push_subscriptions: { keyPath: "id" }
    }
  };

  /* ========== الأدوار والصلاحيات ========== */
  const ROLES = {
    admin: { name: "مدير النظام", permissions: ["*"] },
    manager: { name: "مدير الفرع", permissions: ["products:read", "products:write", "products:delete", "orders:read", "orders:write", "orders:status", "reports:read", "settings:read", "settings:write", "pos:access"] },
    cashier: { name: "كاشير", permissions: ["products:read", "orders:read", "orders:write", "pos:access"] },
    viewer: { name: "مشاهدة فقط", permissions: ["products:read", "orders:read", "reports:read"] }
  };

  const DEFAULT_USERS = [
    { id: "u1", username: "admin", password: "admin123", role: "admin", name: "المدير العام", active: true },
    { id: "u2", username: "manager", password: "manager123", role: "manager", name: "مدير الفرع", active: true },
    { id: "u3", username: "cashier", password: "cashier123", role: "cashier", name: "كاشير 1", active: true }
  ];

  const SALT = "barbii_salt_2026";

  /* ========== الفئات ========== */
  const CATEGORIES = [
    { id: "all", name: "الكل", icon: "🌈" },
    { id: "clothes", name: "ملابس", icon: "👗" },
    { id: "toys", name: "ألعاب", icon: "🧸" },
    { id: "shoes", name: "أحذية", icon: "👟" },
    { id: "school", name: "مدرسة", icon: "🎒" },
    { id: "accessories", name: "إكسسوارات", icon: "🎀" },
    { id: "baby", name: "أطفال صغار", icon: "👶" }
  ];

  const CAT_NAMES = {
    clothes: "ملابس",
    toys: "ألعاب",
    shoes: "أحذية",
    school: "مدرسة",
    accessories: "إكسسوارات",
    baby: "أطفال صغار"
  };

  /* ========== حالات الطلبات ========== */
  const ORDER_STATUS = {
    pending: "قيد الانتظار",
    shipped: "تم الشحن",
    delivered: "تم التوصيل",
    cancelled: "ملغي"
  };

  const CHANNELS = {
    online: "متجر",
    pos: "نقاط البيع"
  };

  /* ========== قنوات الإشعارات ========== */
  const NOTIFICATION_CHANNELS = {
    newOrder: { title: "📦 طلب جديد", tag: "new-order" },
    lowStock: { title: "⚠️ مخزون منخفض", tag: "low-stock" },
    orderStatus: { title: "📋 تحديث حالة الطلب", tag: "order-status" },
    dailyReport: { title: "📊 تقرير يومي", tag: "daily-report" }
  };

  /* ========== تنسيقات الباركود ========== */
  const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

  /* ========== VAPID ========== */
  const VAPID_PUBLIC_KEY = "BA3H3OJcis7Qx3-rlv_kk9hzjlbsdcvquWbuKxxWdAq43tr7ePI2q065AFAJCAGuK9SUquNoXVjJHOCNcqwJpB0";

  /* ========== أدوات مشتركة ========== */
  function fmt(n) {
    return Number(n || 0).toLocaleString(APP_CONFIG.LOCALE) + " " + APP_CONFIG.CURRENCY;
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&",
      "<": "<",
      ">": ">",
      '"': """,
      "'": "'"
    }[c]));
  }

  function hashPassword(password) {
    let hash = 0;
    const str = password + SALT;
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

  function catName(id) {
    return CAT_NAMES[id] || id;
  }

  function getCategory(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
  }

  function getRole(roleId) {
    return ROLES[roleId] || ROLES.viewer;
  }

  function getStatus(statusId) {
    return ORDER_STATUS[statusId] || statusId;
  }

  function getChannel(channelId) {
    return CHANNELS[channelId] || channelId;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /* ========== DOM Helpers ========== */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  function toast(msg) {
    const t = $("#toast");
    if (t) {
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(t._h);
      t._h = setTimeout(() => t.classList.remove("show"), 2400);
    }
  }

  /* ========== Export ========== */
  window.BARBII_CONSTANTS = {
    STORAGE_KEYS,
    APP_CONFIG,
    IDB_CONFIG,
    ROLES,
    DEFAULT_USERS,
    SALT,
    CATEGORIES,
    CAT_NAMES,
    ORDER_STATUS,
    CHANNELS,
    NOTIFICATION_CHANNELS,
    BARCODE_FORMATS,
    VAPID_PUBLIC_KEY,
    fmt,
    uid,
    esc,
    hashPassword,
    verifyPassword,
    catName,
    getCategory,
    getRole,
    getStatus,
    getChannel,
    urlBase64ToUint8Array,
    $,
    $$,
    toast
  };
})();