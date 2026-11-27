/* باربي Barbii — طبقة قاعدة البيانات باستخدام IndexedDB */
(function () {
  "use strict";

  const DB_NAME = "BarbiiDB";
  const DB_VERSION = 2;
  const STORES = {
    products: { keyPath: "id", indexes: ["category", "sku"] },
    orders: { keyPath: "id", indexes: ["channel", "status", "date"] },
    settings: { keyPath: "key" },
    images: { keyPath: "productId" },
    cart: { keyPath: "key" },
    auth: { keyPath: "username", indexes: ["role"] },
    sessions: { keyPath: "sessionId" }
  };

  let db = null;
  let initPromise = null;

  function openDB() {
    if (db) return Promise.resolve(db);
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        if (!database.objectStoreNames.contains("products")) {
          const productStore = database.createObjectStore("products", { keyPath: "id" });
          productStore.createIndex("category", "category", { unique: false });
          productStore.createIndex("sku", "sku", { unique: true });
        }

        if (!database.objectStoreNames.contains("orders")) {
          const orderStore = database.createObjectStore("orders", { keyPath: "id" });
          orderStore.createIndex("channel", "channel", { unique: false });
          orderStore.createIndex("status", "status", { unique: false });
          orderStore.createIndex("date", "date", { unique: false });
        }

        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains("images")) {
          database.createObjectStore("images", { keyPath: "productId" });
        }

        if (!database.objectStoreNames.contains("cart")) {
          database.createObjectStore("cart", { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains("auth")) {
          const authStore = database.createObjectStore("auth", { keyPath: "username" });
          authStore.createIndex("role", "role", { unique: false });
        }

        if (!database.objectStoreNames.contains("sessions")) {
          database.createObjectStore("sessions", { keyPath: "sessionId" });
        }
      };
    });

    return initPromise;
  }

  function get(storeName, key) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  function getAll(storeName) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  function put(storeName, value) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  function deleteItem(storeName, key) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  function clear(storeName) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  function queryByIndex(storeName, indexName, value) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async function migrateFromLocalStorage() {
    const migrated = await get("settings", "migrated");
    if (migrated) return;

    try {
      const productsRaw = localStorage.getItem("barbii_db_v1");
      if (productsRaw) {
        const data = JSON.parse(productsRaw);
        if (data.products) {
          for (const product of data.products) {
            await put("products", product);
          }
        }
        if (data.orders) {
          for (const order of data.orders) {
            await put("orders", order);
          }
        }
        if (data.settings) {
          await put("settings", { key: "store", ...data.settings });
        }
      }

      const cartRaw = localStorage.getItem("barbii_cart");
      if (cartRaw) {
        const cart = JSON.parse(cartRaw);
        await put("cart", { key: "store", items: cart });
      }

      const authRaw = localStorage.getItem("barbii_auth_v1");
      if (authRaw) {
        const users = JSON.parse(authRaw);
        for (const user of users) {
          await put("auth", user);
        }
      }

      const sessionRaw = localStorage.getItem("barbii_session_v1");
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        await put("sessions", { sessionId: "current", ...session });
      }

      const imagesRaw = localStorage.getItem("barbii_images_v1");
      if (imagesRaw) {
        const images = JSON.parse(imagesRaw);
        for (const [productId, base64] of Object.entries(images)) {
          await put("images", { productId, base64 });
        }
      }

      await put("settings", { key: "migrated", value: true, date: new Date().toISOString() });
      console.log("Migration from localStorage completed");
    } catch (e) {
      console.warn("Migration failed:", e);
    }
  }

  const ProductsDB = {
    async getAll() { return getAll("products"); },
    async get(id) { return get("products", id); },
    async save(product) { return put("products", product); },
    async delete(id) { return deleteItem("products", id); },
    async getByCategory(category) { return queryByIndex("products", "category", category); },
    async getBySku(sku) { return queryByIndex("products", "sku", sku); }
  };

  const OrdersDB = {
    async getAll() { return getAll("orders"); },
    async get(id) { return get("orders", id); },
    async save(order) { return put("orders", order); },
    async delete(id) { return deleteItem("orders", id); },
    async getByChannel(channel) { return queryByIndex("orders", "channel", channel); },
    async getByStatus(status) { return queryByIndex("orders", "status", status); },
    async getByDateRange(start, end) {
      const all = await getAll("orders");
      return all.filter(o => o.date >= start && o.date <= end);
    }
  };

  const SettingsDB = {
    async get() {
      const setting = await get("settings", "store");
      return setting || { deliveryFee: 5000, freeAbove: 50000, storeName: "باربي Barbii", phone: "0770 000 0000" };
    },
    async save(settings) {
      return put("settings", { key: "store", ...settings });
    }
  };

  const CartDB = {
    async get(type = "store") {
      const cart = await get("cart", type);
      return cart?.items || [];
    },
    async save(type, items) {
      return put("cart", { key: type, items, updatedAt: Date.now() });
    }
  };

  const AuthDB = {
    async getAllUsers() { return getAll("auth"); },
    async getUser(username) { return get("auth", username); },
    async saveUser(user) { return put("auth", user); },
    async deleteUser(username) { return deleteItem("auth", username); },
    async getSession() { return get("sessions", "current"); },
    async saveSession(session) { return put("sessions", { sessionId: "current", ...session }); },
    async clearSession() { return deleteItem("sessions", "current"); }
  };

  const ImagesDB = {
    async get(productId) {
      const img = await get("images", productId);
      return img?.base64 || null;
    },
    async save(productId, base64) {
      return put("images", { productId, base64, updatedAt: Date.now() });
    },
    async delete(productId) {
      return deleteItem("images", productId);
    }
  };

  async function init() {
    await openDB();
    await migrateFromLocalStorage();
    return true;
  }

  window.BARBII_DB = {
    init,
    Products: ProductsDB,
    Orders: OrdersDB,
    Settings: SettingsDB,
    Cart: CartDB,
    Auth: AuthDB,
    Images: ImagesDB,
    get,
    getAll,
    put,
    delete: deleteItem,
    clear,
    queryByIndex
  };
})();