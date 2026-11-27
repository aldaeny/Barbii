/* باربي Barbii — إشعارات Push (Service Worker + VAPID) */
(function () {
  "use strict";

  const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY_HERE"; // استبدل بمفتاحك العام
  const NOTIFICATION_CHANNELS = {
    newOrder: { title: "📦 طلب جديد", tag: "new-order" },
    lowStock: { title: "⚠️ مخزون منخفض", tag: "low-stock" },
    orderStatus: { title: "📋 تحديث حالة الطلب", tag: "order-status" },
    dailyReport: { title: "📊 تقرير يومي", tag: "daily-report" }
  };

  let swRegistration = null;
  let pushSubscription = null;

  async function initPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications not supported");
      return false;
    }

    try {
      swRegistration = await navigator.serviceWorker.ready;
      pushSubscription = await swRegistration.pushManager.getSubscription();

      await updateServiceWorker();
      return true;
    } catch (e) {
      console.error("Push init failed:", e);
      return false;
    }
  }

  async function updateServiceWorker() {
    if (swRegistration?.active) {
      swRegistration.active.postMessage({ type: "SET_VAPID_KEY", key: VAPID_PUBLIC_KEY });
    }
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

  async function subscribe() {
    if (!swRegistration) await initPush();
    if (!swRegistration) return { success: false, error: "Service Worker not ready" };

    if (pushSubscription) {
      return { success: true, subscription: pushSubscription };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { success: false, error: "Notification permission denied" };
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      pushSubscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      await saveSubscription(pushSubscription);
      return { success: true, subscription: pushSubscription };
    } catch (e) {
      console.error("Subscribe failed:", e);
      return { success: false, error: e.message };
    }
  }

  async function unsubscribe() {
    if (!pushSubscription) return { success: true };
    try {
      await pushSubscription.unsubscribe();
      pushSubscription = null;
      await deleteSubscription();
      return { success: true };
    } catch (e) {
      console.error("Unsubscribe failed:", e);
      return { success: false, error: e.message };
    }
  }

  async function saveSubscription(subscription) {
    if (window.BARBII_DB?.Auth) {
      await window.BARBII_DB.put("push_subscriptions", {
        id: "current",
        subscription: subscription.toJSON(),
        createdAt: Date.now()
      });
    }
  }

  async function deleteSubscription() {
    if (window.BARBII_DB) {
      await window.BARBII_DB.delete("push_subscriptions", "current");
    }
  }

  async function getSubscription() {
    if (pushSubscription) return pushSubscription;
    if (window.BARBII_DB?.Auth) {
      const saved = await window.BARBII_DB.get("push_subscriptions", "current");
      if (saved?.subscription) {
        return saved.subscription;
      }
    }
    return null;
  }

  function showLocalNotification(channel, data = {}) {
    const config = NOTIFICATION_CHANNELS[channel] || { title: "باربي Barbii", tag: "default" };
    const options = {
      body: data.body || "لديك تحديث جديد",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: config.tag,
      data: data.data || {},
      requireInteraction: true,
      actions: [
        { action: "view", title: "👁️ عرض" },
        { action: "dismiss", title: "✖️ تجاهل" }
      ],
      vibrate: [200, 100, 200],
      timestamp: Date.now()
    };

    if ("serviceWorker" in navigator && swRegistration) {
      swRegistration.showNotification(config.title, options);
    } else if (Notification.permission === "granted") {
      new Notification(config.title, options);
    }
  }

  function setupNotificationHandlers() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        const { action, data } = event.data;
        handleNotificationAction(action, data);
      }
    });

    Notification.prototype.onclick = (event) => {
      const notification = event.target;
      if (notification.data?.url) {
        window.focus();
        window.location.href = notification.data.url;
      }
      notification.close();
    };
  }

  function handleNotificationAction(action, data) {
    switch (action) {
      case "view":
        if (data?.url) {
          window.focus();
          window.location.href = data.url;
        } else if (data?.orderId) {
          window.location.href = `#orders/${data.orderId}`;
        }
        break;
      case "dismiss":
        break;
    }
  }

  function notifyNewOrder(order) {
    return showLocalNotification("newOrder", {
      body: `طلب جديد من ${order.customer} - ${fmt(order.total)}`,
      data: { url: `#orders/${order.id}`, orderId: order.id }
    });
  }

  function notifyLowStock(products) {
    const count = products.length;
    return showLocalNotification("lowStock", {
      body: `${count} منتج أوشكت على النفاد`,
      data: { url: "#admin/products" }
    });
  }

  function notifyOrderStatusChange(order, oldStatus, newStatus) {
    const statusNames = { pending: "قيد الانتظار", shipped: "تم الشحن", delivered: "تم التوصيل", cancelled: "ملغي" };
    return showLocalNotification("orderStatus", {
      body: `طلب ${order.id} تغير من "${statusNames[oldStatus]}" إلى "${statusNames[newStatus]}"`,
      data: { url: `#orders/${order.id}` }
    });
  }

  function notifyDailyReport(stats) {
    return showLocalNotification("dailyReport", {
      body: `مبيعات اليوم: ${fmt(stats.sales)} - طلبات: ${stats.orders}`,
      data: { url: "#admin" }
    });
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPush().then(() => setupNotificationHandlers());
      setTimeout(() => subscribe(), 30000);
    });
  } else {
    initPush().then(() => setupNotificationHandlers());
    setTimeout(() => subscribe(), 30000);
  }

  window.BARBII_PUSH = {
    init: initPush,
    subscribe,
    unsubscribe,
    getSubscription,
    showLocalNotification,
    notifyNewOrder,
    notifyLowStock,
    notifyOrderStatusChange,
    notifyDailyReport,
    NOTIFICATION_CHANNELS
  };
})();