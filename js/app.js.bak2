/* باربي Barbii — منطق التطبيق: متجر + POS + إدارة + PWA */
(function () {
  "use strict";
  const DB_KEY = "barbii_db_v1";
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const fmt = (n) => Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
  const uid = (p) => p + "-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- قاعدة البيانات المحلية ---------- */
  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* تجاهل */ }
    const db = JSON.parse(JSON.stringify(window.BARBII_SEED));
    saveDB(db);
    return db;
  }
  function saveDB(db) { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* تجاهل */ } }
  let db = loadDB();

  /* ---------- الحالة ---------- */
  const state = {
    view: "store",
    cart: [],          // سلة المتجر
    posCart: [],       // سلة الكاشير
    posDiscount: 0,
    cat: "all", q: "", sort: "popular", age: "all",
    adminTab: "dashboard",
    editingId: null,
  };
  try { state.cart = JSON.parse(localStorage.getItem("barbii_cart") || "[]"); } catch (e) { state.cart = []; }
  const saveCart = () => { try { localStorage.setItem("barbii_cart", JSON.stringify(state.cart)); } catch (e) {} };

  const productById = (id) => db.products.find((p) => p.id === id);
  const catName = (id) => (db.categories.find((c) => c.id === id) || {}).name || id;

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------- التنقل ---------- */
  function showView(v) {
    state.view = v;
    $$(".view").forEach((el) => el.classList.toggle("hidden", el.id !== "view-" + v));
    $$("[data-nav]").forEach((b) => b.classList.toggle("active", b.dataset.nav === v));
    if (v === "store") renderStore();
    if (v === "pos") renderPOS();
    if (v === "admin") renderAdmin();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  window.showView = showView;

  /* ---------- المتجر ---------- */
  function filteredProducts() {
    let list = db.products.slice();
    if (state.cat !== "all") list = list.filter((p) => p.category === state.cat);
    if (state.q) {
      const q = state.q.trim().toLowerCase();
      list = list.filter((p) => (p.name + " " + p.desc + " " + p.sku).toLowerCase().includes(q));
    }
    if (state.age !== "all") list = list.filter((p) => (p.age || "").includes(state.age));
    if (state.sort === "cheap") list.sort((a, b) => a.price - b.price);
    else if (state.sort === "expensive") list.sort((a, b) => b.price - a.price);
    else if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return list;
  }

  function renderStore() {
    $("#cats").innerHTML = db.categories.map((c) =>
      `<button class="cat ${state.cat === c.id ? "active" : ""}" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join("");
    $$("#cats .cat").forEach((b) => b.onclick = () => { state.cat = b.dataset.cat; renderStore(); });

    const list = filteredProducts();
    const grid = $("#productGrid");
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="e">🔍</div><p>لا توجد منتجات مطابقة لبحثك</p></div>`;
    } else {
      grid.innerHTML = list.map((p) => {
        const off = p.oldPrice > p.price;
        const badgeCls = p.badge === "جديد" ? "new" : (p.badge === "الأكثر مبيعاً" ? "hot" : "");
        return `<article class="card">
          <div class="thumb">${p.badge ? `<span class="badge ${badgeCls}">${esc(p.badge)}</span>` : ""}${esc(p.emoji || "🎁")}</div>
          <div class="body">
            <h3>${esc(p.name)}</h3>
            <div class="meta">${catName(p.category)} • ${esc(p.age || "")} • ${esc(p.sku)}</div>
            <div class="desc">${esc(p.desc || "")}</div>
            <div class="price-row"><span class="price">${fmt(p.price)}</span>${off ? `<span class="old">${fmt(p.oldPrice)}</span>` : ""}</div>
            <div class="${p.stock <= 5 ? "stock-low" : "stock-ok"}">${p.stock <= 0 ? "نفد من المخزون" : (p.stock <= 5 ? `⚠️ باقي ${p.stock} فقط` : `✓ متوفر (${p.stock})`)}</div>
            <button class="btn btn-pink btn-block" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>🛒 أضف إلى السلة</button>
          </div></article>`;
      }).join("");
      $$("[data-add]", grid).forEach((b) => b.onclick = () => addToCart(b.dataset.add));
    }
    updateCartBadge();
  }

  function addToCart(id, qty) {
    const p = productById(id); if (!p) return;
    const line = state.cart.find((l) => l.id === id);
    const next = (line ? line.qty : 0) + (qty || 1);
    if (next > p.stock) { toast("⚠️ الكمية المتاحة أقل من المطلوب"); return; }
    if (line) line.qty = next; else state.cart.push({ id, qty: qty || 1 });
    saveCart(); updateCartBadge(); toast("✅ تمت الإضافة إلى السلة");
  }
  window.addToCart = addToCart;

  function cartTotals(cart) {
    const subtotal = cart.reduce((s, l) => { const p = productById(l.id); return s + (p ? p.price * l.qty : 0); }, 0);
    const delivery = subtotal === 0 ? 0 : (subtotal >= db.settings.freeAbove ? 0 : db.settings.deliveryFee);
    return { subtotal, delivery, total: subtotal + delivery };
  }

  function updateCartBadge() {
    const n = state.cart.reduce((s, l) => s + l.qty, 0);
    const el = $("#cartCount"); if (el) el.textContent = n;
  }

  /* ---------- درج السلة ---------- */
  function openCart() { renderCartDrawer(); $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("show"); }
  function closeCart() { $("#cartDrawer").classList.remove("open"); $("#overlay").classList.remove("show"); }
  window.openCart = openCart; window.closeCart = closeCart;

  function renderCartDrawer() {
    const box = $("#cartItems");
    if (!state.cart.length) {
      box.innerHTML = `<div class="empty"><div class="e">🛒</div><p>سلتك فارغة</p><button class="btn btn-pink" onclick="closeCart();showView('store')">تصفح المنتجات</button></div>`;
    } else {
      box.innerHTML = state.cart.map((l) => {
        const p = productById(l.id); if (!p) return "";
        return `<div class="cart-item"><div class="e">${esc(p.emoji || "🎁")}</div>
          <div style="flex:1"><b>${esc(p.name)}</b><div class="meta">${fmt(p.price)}</div>
          <div class="qty"><button data-dec="${p.id}">−</button><span>${l.qty}</span><button data-inc="${p.id}">+</button></div></div>
          <div><b>${fmt(p.price * l.qty)}</b><br><button class="btn btn-ghost" style="padding:4px 10px" data-del="${p.id}">حذف</button></div></div>`;
      }).join("");
      $$("[data-inc]", box).forEach((b) => b.onclick = () => { addToCart(b.dataset.inc); renderCartDrawer(); });
      $$("[data-dec]", box).forEach((b) => b.onclick = () => {
        const l = state.cart.find((x) => x.id === b.dataset.dec);
        if (l) { l.qty--; if (l.qty <= 0) state.cart = state.cart.filter((x) => x.id !== l.id); }
        saveCart(); renderCartDrawer(); updateCartBadge();
      });
      $$("[data-del]", box).forEach((b) => b.onclick = () => {
        state.cart = state.cart.filter((x) => x.id !== b.dataset.del); saveCart(); renderCartDrawer(); updateCartBadge();
      });
    }
    const t = cartTotals(state.cart);
    $("#cartSubtotal").textContent = fmt(t.subtotal);
    $("#cartDelivery").textContent = t.delivery === 0 && t.subtotal > 0 ? "مجاني 🎉" : fmt(t.delivery);
    $("#cartTotal").textContent = fmt(t.total);
    $("#checkoutBtn").disabled = !state.cart.length;
  }

  /* ---------- إتمام الطلب ---------- */
  function openCheckout() {
    if (!state.cart.length) return;
    closeCart();
    $("#checkoutForm").reset();
    const t = cartTotals(state.cart);
    $("#coSummary").innerHTML = state.cart.map((l) => {
      const p = productById(l.id);
      return p ? `<div class="total-row"><span>${esc(p.emoji)} ${esc(p.name)} × ${l.qty}</span><span>${fmt(p.price * l.qty)}</span></div>` : "";
    }).join("") + `<div class="total-row"><span>التوصيل</span><span>${t.delivery === 0 ? "مجاني" : fmt(t.delivery)}</span></div><div class="total-row grand"><span>الإجمالي</span><span>${fmt(t.total)}</span></div>`;
    $("#checkoutModal").classList.add("show");
  }
  window.openCheckout = openCheckout;
  function closeCheckout() { $("#checkoutModal").classList.remove("show"); }
  window.closeCheckout = closeCheckout;

  function submitCheckout(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const address = String(fd.get("address") || "").trim();
    if (!name || !phone || !address) { toast("⚠️ املأ الاسم والهاتف والعنوان"); return; }
    const t = cartTotals(state.cart);
    const order = {
      id: uid("ORD"), customer: name, phone, address: city + " - " + address,
      items: state.cart.map((l) => { const p = productById(l.id); return { id: l.id, name: p.name, price: p.price, qty: l.qty }; }),
      subtotal: t.subtotal, delivery: t.delivery, total: t.total,
      status: "pending", channel: "online", date: new Date().toISOString(),
    };
    state.cart.forEach((l) => { const p = productById(l.id); if (p) p.stock = Math.max(0, p.stock - l.qty); });
    db.orders.unshift(order); saveDB(db);
    state.cart = []; saveCart(); updateCartBadge();
    closeCheckout();
    $("#successText").innerHTML = `شكراً <b>${esc(name)}</b>! تم استلام طلبك بنجاح.<br>رقم الطلب: <b>${esc(order.id)}</b><br>الإجمالي: <b>${fmt(order.total)}</b> — الدفع عند الاستلام.`;
    $("#successModal").classList.add("show");
  }
  window.submitCheckout = submitCheckout;
  function closeSuccess() { $("#successModal").classList.remove("show"); }
  window.closeSuccess = closeSuccess;

  /* ---------- نقاط البيع POS ---------- */
  function posTotals() {
    const subtotal = state.posCart.reduce((s, l) => { const p = productById(l.id); return s + (p ? p.price * l.qty : 0); }, 0);
    const discount = Math.round(subtotal * (state.posDiscount / 100));
    return { subtotal, discount, total: subtotal - discount };
  }
  function renderPOS() {
    const grid = $("#posGrid");
    grid.innerHTML = db.products.map((p) =>
      `<button class="pos-item" data-pos="${p.id}" ${p.stock <= 0 ? "disabled" : ""}><div class="e">${esc(p.emoji || "🎁")}</div><b>${esc(p.name)}</b><span>${fmt(p.price)}</span><div class="meta">مخزون: ${p.stock}</div></button>`).join("");
    $$("[data-pos]", grid).forEach((b) => b.onclick = () => posAdd(b.dataset.pos));
    renderPOSCart();
    renderPOSDay();
  }
  function posAdd(id) {
    const p = productById(id); if (!p) return;
    const line = state.posCart.find((l) => l.id === id);
    const next = (line ? line.qty : 0) + 1;
    if (next > p.stock) { toast("⚠️ لا يوجد مخزون كافٍ"); return; }
    if (line) line.qty = next; else state.posCart.push({ id, qty: 1 });
    renderPOSCart();
  }
  function renderPOSCart() {
    const box = $("#posCartItems");
    if (!state.posCart.length) box.innerHTML = `<div class="empty"><div class="e">🧾</div><p>أضف منتجات للبدء بالبيع</p></div>`;
    else box.innerHTML = state.posCart.map((l) => {
      const p = productById(l.id); if (!p) return "";
      return `<div class="cart-item"><div class="e">${esc(p.emoji || "🎁")}</div>
        <div style="flex:1"><b>${esc(p.name)}</b><div class="meta">${fmt(p.price)}</div>
        <div class="qty"><button data-pdec="${p.id}">−</button><span>${l.qty}</span><button data-pinc="${p.id}">+</button></div></div>
        <div><b>${fmt(p.price * l.qty)}</b><br><button class="btn btn-ghost" style="padding:4px 10px" data-pdel="${p.id}">حذف</button></div></div>`;
    }).join("");
    $$("[data-pinc]", box).forEach((b) => b.onclick = () => { posAdd(b.dataset.pinc); });
    $$("[data-pdec]", box).forEach((b) => b.onclick = () => {
      const l = state.posCart.find((x) => x.id === b.dataset.pdec);
      if (l) { l.qty--; if (l.qty <= 0) state.posCart = state.posCart.filter((x) => x.id !== l.id); }
      renderPOSCart();
    });
    $$("[data-pdel]", box).forEach((b) => b.onclick = () => { state.posCart = state.posCart.filter((x) => x.id !== b.dataset.pdel); renderPOSCart(); });
    const t = posTotals();
    $("#posSubtotal").textContent = fmt(t.subtotal);
    $("#posDiscountVal").textContent = fmt(t.discount);
    $("#posTotal").textContent = fmt(t.total);
    $("#posPayBtn").disabled = !state.posCart.length;
  }
  function renderPOSDay() {
    const today = new Date().toISOString().slice(0, 10);
    const day = db.orders.filter((o) => o.channel === "pos" && String(o.date).slice(0, 10) === today);
    const sales = day.reduce((s, o) => s + o.total, 0);
    const items = day.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    $("#posDaySales").textContent = fmt(sales);
    $("#posDayCount").textContent = day.length + " فاتورة • " + items + " قطعة";
  }
  function posBarcode() {
    const code = $("#barcodeInput").value.trim().toLowerCase();
    if (!code) return;
    const p = db.products.find((x) => x.sku.toLowerCase() === code || x.id.toLowerCase() === code || x.name.includes(code));
    if (p) { posAdd(p.id); toast("✅ " + p.name); $("#barcodeInput").value = ""; $("#barcodeInput").focus(); }
    else toast("❌ لم يتم العثور على المنتج");
  }
  window.posBarcode = posBarcode;
  function posClear() { state.posCart = []; state.posDiscount = 0; $("#posDiscount").value = 0; renderPOSCart(); }
  window.posClear = posClear;
  function posPay() {
    const t = posTotals();
    const paid = Number($("#posPaid").value || 0);
    if (paid < t.total) { toast("⚠️ المبلغ المدفوع أقل من الإجمالي"); return; }
    const order = {
      id: uid("POS"), customer: "زبون محل", phone: "-", address: "كاشير POS",
      items: state.posCart.map((l) => { const p = productById(l.id); return { id: l.id, name: p.name, price: p.price, qty: l.qty }; }),
      subtotal: t.subtotal, delivery: 0, total: t.total, discount: t.discount,
      status: "delivered", channel: "pos", date: new Date().toISOString(),
    };
    state.posCart.forEach((l) => { const p = productById(l.id); if (p) p.stock = Math.max(0, p.stock - l.qty); });
    db.orders.unshift(order); saveDB(db);
    const change = paid - t.total;
    $("#receiptText").textContent =
      `باربي Barbii\n${db.settings.phone}\n----------------\n` +
      order.items.map((i) => `${i.name} × ${i.qty} = ${i.price * i.qty}`).join("\n") +
      `\n----------------\nالمجموع: ${t.subtotal}\nالخصم: ${t.discount}\nالإجمالي: ${t.total}\nالمدفوع: ${paid}\nالباقي: ${change}\nرقم الفاتورة: ${order.id}\nشكراً لتسوقكم معنا 🌸`;
    $("#posModal").classList.add("show");
    state.posCart = []; state.posDiscount = 0; $("#posDiscount").value = 0; $("#posPaid").value = "";
    renderPOSCart(); renderPOSDay();
  }
  window.posPay = posPay;
  function closePOS() { $("#posModal").classList.remove("show"); }
  window.closePOS = closePOS;
  function printReceipt() { window.print(); }
  window.printReceipt = printReceipt;

  /* ---------- الإدارة ---------- */
  const STATUS_AR = { pending: "قيد الانتظار", shipped: "تم الشحن", delivered: "تم التوصيل", cancelled: "ملغي" };
  function renderAdmin() {
    $$("#adminTabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.adminTab));
    $$(".admin-pane").forEach((el) => el.classList.toggle("hidden", el.id !== "pane-" + state.adminTab));
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = db.orders.filter((o) => String(o.date).slice(0, 10) === today);
    const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
    const lowStock = db.products.filter((p) => p.stock <= 5);
    $("#stTodaySales").textContent = fmt(todaySales);
    $("#stTodayOrders").textContent = todayOrders.length;
    $("#stProducts").textContent = db.products.length;
    $("#stLowStock").textContent = lowStock.length;
    drawChart();
    renderAdminProducts();
    renderAdminOrders();
    renderAdminSettings();
  }
  function drawChart() {
    const c = $("#salesChart"); if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth || 600, H = 220;
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
    const vals = days.map((day) => db.orders.filter((o) => String(o.date).slice(0, 10) === day).reduce((s, o) => s + o.total, 0));
    const max = Math.max(...vals, 1);
    ctx.clearRect(0, 0, W, H);
    const bw = (W - 40) / days.length;
    vals.forEach((v, i) => {
      const h = (v / max) * (H - 60);
      const x = 20 + i * bw + bw * 0.2, y = H - 30 - h;
      const g = ctx.createLinearGradient(0, y, 0, H - 30);
      g.addColorStop(0, "#ec4899"); g.addColorStop(1, "#8b5cf6");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(x, y, bw * 0.6, h, 6); ctx.fill();
      ctx.fillStyle = "#6b7280"; ctx.font = "11px Tahoma"; ctx.textAlign = "center";
      ctx.fillText(days[i].slice(5), x + bw * 0.3, H - 10);
      if (v > 0) { ctx.fillStyle = "#be185d"; ctx.font = "bold 10px Tahoma"; ctx.fillText((v / 1000).toFixed(0) + "k", x + bw * 0.3, y - 6); }
    });
  }
  function renderAdminProducts() {
    const tb = $("#productsTable tbody");
    tb.innerHTML = db.products.map((p) =>
      `<tr><td>${esc(p.emoji || "")}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.sku)}</small></td><td>${catName(p.category)}</td><td>${fmt(p.price)}</td><td>${p.stock}</td><td>
      <button class="btn btn-ghost" data-edit="${p.id}" style="padding:5px 12px">تعديل</button>
      <button class="btn btn-red" data-delp="${p.id}" style="padding:5px 12px">حذف</button></td></tr>`).join("");
    $$("[data-edit]", tb).forEach((b) => b.onclick = () => openProductForm(b.dataset.edit));
    $$("[data-delp]", tb).forEach((b) => b.onclick = () => {
      if (!confirm("حذف هذا المنتج نهائياً؟")) return;
      db.products = db.products.filter((p) => p.id !== b.dataset.delp); saveDB(db); renderAdmin(); renderStore(); toast("🗑️ تم الحذف");
    });
  }
  function openProductForm(id) {
    state.editingId = id || null;
    const form = $("#productForm"); form.reset();
    const f = form.elements;
    $("#productModalTitle").textContent = id ? "تعديل منتج" : "إضافة منتج جديد";
    if (id) {
      const p = productById(id); if (!p) return;
      f.name.value = p.name; f.category.value = p.category; f.price.value = p.price;
      f.oldPrice.value = p.oldPrice || ""; f.stock.value = p.stock; f.emoji.value = p.emoji || "";
      f.age.value = p.age || ""; f.badge.value = p.badge || ""; f.desc.value = p.desc || "";
    }
    $("#productModal").classList.add("show");
  }
  window.openProductForm = openProductForm;
  function closeProductForm() { $("#productModal").classList.remove("show"); }
  window.closeProductForm = closeProductForm;
  function submitProduct(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: String(fd.get("name") || "").trim(), category: String(fd.get("category") || "clothes"),
      price: Number(fd.get("price") || 0), oldPrice: Number(fd.get("oldPrice") || 0),
      stock: Number(fd.get("stock") || 0), emoji: String(fd.get("emoji") || "🎁").trim(),
      age: String(fd.get("age") || "").trim(), badge: String(fd.get("badge") || "").trim(),
      desc: String(fd.get("desc") || "").trim(),
    };
    if (!data.name || data.price <= 0) { toast("⚠️ أدخل اسم وسعر صحيح"); return; }
    if (state.editingId) Object.assign(productById(state.editingId), data);
    else db.products.unshift({ id: uid("p"), sku: "BRB-" + String(db.products.length + 1).padStart(3, "0"), ...data });
    saveDB(db); closeProductForm(); renderAdmin(); renderStore(); toast("✅ تم الحفظ");
  }
  window.submitProduct = submitProduct;
  function renderAdminOrders() {
    const tb = $("#ordersTable tbody");
    if (!db.orders.length) { tb.innerHTML = `<tr><td colspan="6" class="empty">لا توجد طلبات بعد</td></tr>`; return; }
    tb.innerHTML = db.orders.map((o) =>
      `<tr><td><b>${esc(o.id)}</b><br><small>${esc(String(o.date).slice(0, 10))} • ${o.channel === "pos" ? "POS" : "متجر"}</small></td>
      <td>${esc(o.customer)}<br><small>${esc(o.phone)}</small></td>
      <td>${o.items.reduce((a, i) => a + i.qty, 0)} قطعة</td><td><b>${fmt(o.total)}</b></td>
      <td><span class="status ${o.status}">${STATUS_AR[o.status] || o.status}</span></td>
      <td><select data-status="${o.id}" class="input" style="padding:5px 8px">
        ${Object.keys(STATUS_AR).map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${STATUS_AR[s]}</option>`).join("")}
      </select></td></tr>`).join("");
    $$("[data-status]", tb).forEach((s) => s.onchange = () => {
      const o = db.orders.find((x) => x.id === s.dataset.status);
      if (o) {
        o.status = s.value; saveDB(db);
        const badge = s.closest("tr").querySelector(".status");
        if (badge) { badge.className = "status " + s.value; badge.textContent = STATUS_AR[s.value] || s.value; }
        toast("✅ تم تحديث حالة الطلب");
      }
    });
  }
  function renderAdminSettings() {
    const f = $("#settingsForm").elements;
    f.storeName.value = db.settings.storeName; f.phone.value = db.settings.phone;
    f.deliveryFee.value = db.settings.deliveryFee; f.freeAbove.value = db.settings.freeAbove;
  }
  function submitSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    db.settings.storeName = String(fd.get("storeName") || db.settings.storeName);
    db.settings.phone = String(fd.get("phone") || "");
    db.settings.deliveryFee = Number(fd.get("deliveryFee") || 0);
    db.settings.freeAbove = Number(fd.get("freeAbove") || 0);
    saveDB(db); toast("✅ تم حفظ الإعدادات");
  }
  window.submitSettings = submitSettings;
  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "barbii-data.json"; a.click();
    URL.revokeObjectURL(a.href);
  }
  window.exportData = exportData;
  function resetData() {
    if (!confirm("إعادة تعيين كل البيانات إلى الافتراضية؟")) return;
    localStorage.removeItem(DB_KEY); localStorage.removeItem("barbii_cart");
    db = loadDB(); state.cart = []; state.posCart = []; renderStore(); renderAdmin(); toast("🔄 تمت إعادة التعيين");
  }
  window.resetData = resetData;

  /* ---------- بحث وفلاتر ---------- */
  function bindFilters() {
    $("#searchInput").addEventListener("input", (e) => { state.q = e.target.value; renderStore(); });
    $("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderStore(); });
    $("#ageSelect").addEventListener("change", (e) => { state.age = e.target.value; renderStore(); });
    $("#checkoutForm").addEventListener("submit", submitCheckout);
    $("#productForm").addEventListener("submit", submitProduct);
    $("#settingsForm").addEventListener("submit", submitSettings);
    $("#posDiscount").addEventListener("input", (e) => { state.posDiscount = Number(e.target.value || 0); renderPOSCart(); });
    $$("#adminTabs button").forEach((b) => b.onclick = () => { state.adminTab = b.dataset.tab; renderAdmin(); });
    $("#overlay").addEventListener("click", closeCart);
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("show"); }));
  }

  /* ---------- PWA ---------- */
  let deferredPrompt = null;
  function initPWA() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault(); deferredPrompt = e;
      $("#installBar").classList.add("show");
    });
    $("#installBtn").addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null; $("#installBar").classList.remove("show");
    });
  }

  /* ---------- تشغيل ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    bindFilters(); initPWA(); renderStore(); updateCartBadge();
    const y = new Date().getFullYear();
    $("#year").textContent = y;
  });
})();
