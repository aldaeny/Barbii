/* باربي Barbii — تقارير متقدمة (PDF + Excel) */
(function () {
  "use strict";

  // تحميل المكتبات ديناميكياً
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensurePDF() {
    if (window.jspdf) return;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js");
  }

  async function ensureExcel() {
    if (window.XLSX) return;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
  }

  function getDateStr(date) {
    const d = new Date(date);
    return d.toLocaleDateString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function getDateTimeStr(date) {
    const d = new Date(date);
    return d.toLocaleString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // ========== تصدير Excel ==========
  async function exportOrdersToExcel(orders, filename = "barbii-orders") {
    await ensureExcel();

    const data = orders.map((o, i) => ({
      "#": i + 1,
      "رقم الطلب": o.id,
      "التاريخ": getDateTimeStr(o.date),
      "الزبون": o.customer,
      "الهاتف": o.phone,
      "العنوان": o.address,
      "القناة": o.channel === "pos" ? "نقاط البيع" : "المتجر الإلكتروني",
      "الحالة": { pending: "قيد الانتظار", shipped: "تم الشحن", delivered: "تم التوصيل", cancelled: "ملغي" }[o.status] || o.status,
      "عدد القطع": o.items.reduce((s, i) => s + i.qty, 0),
      "المجموع الفرعي": fmt(o.subtotal),
      "التوصيل": fmt(o.delivery || 0),
      "الخصم": fmt(o.discount || 0),
      "الإجمالي": fmt(o.total),
      "المنتجات": o.items.map(i => `${i.name} (${i.qty}×${fmt(i.price)})`).join(" | ")
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلبات");

    const cols = [
      { wch: 5 },   // #
      { wch: 20 },  // رقم الطلب
      { wch: 22 },  // التاريخ
      { wch: 20 },  // الزبون
      { wch: 18 },  // الهاتف
      { wch: 30 },  // العنوان
      { wch: 18 },  // القناة
      { wch: 15 },  // الحالة
      { wch: 12 },  // عدد القطع
      { wch: 18 },  // المجموع الفرعي
      { wch: 15 },  // التوصيل
      { wch: 15 },  // الخصم
      { wch: 18 },  // الإجمالي
      { wch: 50 }   // المنتجات
    ];
    ws["!cols"] = cols;

    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportProductsToExcel(products, filename = "barbii-products") {
    await ensureExcel();

    const data = products.map((p, i) => ({
      "#": i + 1,
      "المنتج": p.name,
      "الرمز (SKU)": p.sku,
      "الفئة": { clothes: "ملابس", toys: "ألعاب", shoes: "أحذية", school: "مدرسة", accessories: "إكسسوارات", baby: "أطفال صغار" }[p.category] || p.category,
      "السعر": fmt(p.price),
      "السعر قبل الخصم": p.oldPrice ? fmt(p.oldPrice) : "-",
      "المخزون": p.stock,
      "الحالة": p.stock <= 0 ? "نفد" : (p.stock <= 5 ? "منخفض" : "متوفر"),
      "العمر": p.age || "-",
      "الشارة": p.badge || "-",
      "الوصف": p.desc || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المنتجات");

    const cols = [
      { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 30 }
    ];
    ws["!cols"] = cols;

    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportDailySalesToExcel(orders, filename = "barbii-daily-sales") {
    await ensureExcel();

    const daily = {};
    orders.forEach(o => {
      const day = o.date.slice(0, 10);
      if (!daily[day]) daily[day] = { orders: 0, items: 0, sales: 0, online: 0, pos: 0 };
      daily[day].orders++;
      daily[day].items += o.items.reduce((s, i) => s + i.qty, 0);
      daily[day].sales += o.total;
      if (o.channel === "pos") daily[day].pos += o.total;
      else daily[day].online += o.total;
    });

    const data = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, stats], i) => ({
        "#": i + 1,
        "التاريخ": day,
        "عدد الطلبات": stats.orders,
        "عدد القطع": stats.items,
        "مبيعات المتجر": fmt(stats.online),
        "مبيعات POS": fmt(stats.pos),
        "إجمالي المبيعات": fmt(stats.sales)
      }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مبيعات يومية");

    ws["!cols"] = [
      { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
    ];

    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ========== تصدير PDF ==========
  async function exportOrdersToPDF(orders, title = "تقرير الطلبات") {
    await ensurePDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.addFont("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/fonts/Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(236, 72, 153);
    doc.text("باربي Barbii", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(10);
    doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString("ar-IQ")}`, pageWidth / 2, y, { align: "center" });
    doc.text(`عدد الطلبات: ${orders.length}`, pageWidth / 2, y + 5, { align: "center" });
    y += 15;

    const headers = [["#", "رقم الطلب", "التاريخ", "الزبون", "الهاتف", "القناة", "الحالة", "القطع", "المجموع الفرعي", "التوصيل", "الخصم", "الإجمالي"]];
    const data = orders.map((o, i) => [
      String(i + 1),
      o.id,
      getDateTimeStr(o.date),
      o.customer,
      o.phone,
      o.channel === "pos" ? "POS" : "أونلاين",
      { pending: "قيد الانتظار", shipped: "تم الشحن", delivered: "تم التوصيل", cancelled: "ملغي" }[o.status] || o.status,
      String(o.items.reduce((s, i) => s + i.qty, 0)),
      fmt(o.subtotal),
      fmt(o.delivery || 0),
      fmt(o.discount || 0),
      fmt(o.total)
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: y,
      theme: "striped",
      headStyles: { fillColor: [236, 72, 153], font: "Amiri", fontSize: 9 },
      bodyStyles: { font: "Amiri", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 25 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 25 },
        5: { cellWidth: 18 },
        6: { cellWidth: 20 },
        7: { cellWidth: 12 },
        8: { cellWidth: 22 },
        9: { cellWidth: 20 },
        10: { cellWidth: 20 },
        11: { cellWidth: 22 }
      },
      margin: { left: margin, right: margin },
      styles: { halign: "center" },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } }
    });

    y = doc.lastAutoTable.finalY + 10;
    const totalSales = orders.reduce((s, o) => s + o.total, 0);
    const totalItems = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    doc.setFontSize(12);
    doc.setTextColor(236, 72, 153);
    doc.text(`إجمالي المبيعات: ${fmt(totalSales)}`, margin, y);
    doc.text(`إجمالي القطع: ${totalItems}`, pageWidth - margin, y, { align: "right" });

    doc.save(`${title.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function exportProductsToPDF(products, title = "تقرير المنتجات") {
    await ensurePDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.addFont("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/fonts/Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(236, 72, 153);
    doc.text("باربي Barbii", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(10);
    doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString("ar-IQ")}`, pageWidth / 2, y, { align: "center" });
    doc.text(`عدد المنتجات: ${products.length}`, pageWidth / 2, y + 5, { align: "center" });
    y += 15;

    const catNames = { clothes: "ملابس", toys: "ألعاب", shoes: "أحذية", school: "مدرسة", accessories: "إكسسوارات", baby: "أطفال صغار" };

    const headers = [["#", "المنتج", "الرمز", "الفئة", "السعر", "سعر سابق", "المخزون", "الحالة", "العمر", "الشارة"]];
    const data = products.map((p, i) => [
      String(i + 1),
      p.name,
      p.sku,
      catNames[p.category] || p.category,
      fmt(p.price),
      p.oldPrice ? fmt(p.oldPrice) : "-",
      String(p.stock),
      p.stock <= 0 ? "نفد" : (p.stock <= 5 ? "منخفض" : "متوفر"),
      p.age || "-",
      p.badge || "-"
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: y,
      theme: "striped",
      headStyles: { fillColor: [236, 72, 153], font: "Amiri", fontSize: 9 },
      bodyStyles: { font: "Amiri", fontSize: 8 },
      margin: { left: margin, right: margin },
      styles: { halign: "center" }
    });

    doc.save(`${title.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ========== دوال مساعدة للطباعة ==========
  function printReceipt(order, settings) {
    const receipt = `
باربي Barbii
${settings?.phone || "0770 000 0000"}
----------------
${order.items.map(i => `${i.name} × ${i.qty} = ${fmt(i.price * i.qty)}`).join("\n")}
----------------
المجموع: ${fmt(order.subtotal)}
${order.discount ? `الخصم: ${fmt(order.discount)}` : ""}
${order.delivery ? `التوصيل: ${fmt(order.delivery)}` : ""}
الإجمالي: ${fmt(order.total)}
${order.paid ? `المدفوع: ${fmt(order.paid)}\nالباقي: ${fmt(order.paid - order.total)}` : ""}
رقم الفاتورة: ${order.id}
${order.customer ? `الزبون: ${order.customer}` : ""}
${order.phone ? `الهاتف: ${order.phone}` : ""}
----------------
شكراً لتسوقكم معنا 🌸
    `.trim();

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html dir="rtl"><head><title>إيصال ${order.id}</title>
      <style>
        body { font-family: monospace; padding: 20px; direction: rtl; }
        @media print { body { margin: 0; } }
      </style></head>
      <body><pre>${receipt}</pre></body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  // ========== API عام ==========
  window.BARBII_REPORTS = {
    exportOrdersToExcel,
    exportProductsToExcel,
    exportDailySalesToExcel,
    exportOrdersToPDF,
    exportProductsToPDF,
    printReceipt
  };
})();