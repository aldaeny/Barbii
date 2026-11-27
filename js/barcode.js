/* باربي Barbii — مسح الباركود بالكاميرا */
(function () {
  "use strict";

  let videoElement = null;
  let stream = null;
  let scanning = false;
  let scanInterval = null;
  let barcodeDetector = null;
  let onScanCallback = null;

  const hasBarcodeDetector = "BarcodeDetector" in window;
  const supportedFormats = hasBarcodeDetector ? ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] : [];

  async function initBarcodeScanner() {
    if (hasBarcodeDetector) {
      try {
        barcodeDetector = new BarcodeDetector({ formats: supportedFormats });
        console.log("BarcodeDetector API available, formats:", supportedFormats);
      } catch (e) {
        console.warn("BarcodeDetector init failed:", e);
      }
    } else {
      console.log("BarcodeDetector API not available, using fallback");
    }
    return hasBarcodeDetector;
  }

  async function startCamera(options = {}) {
    const { facingMode = "environment", width = 1280, height = 720 } = options;

    if (stream) {
      stopCamera();
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: width }, height: { ideal: height } },
        audio: false
      });

      if (!videoElement) {
        videoElement = document.createElement("video");
        videoElement.setAttribute("playsinline", "");
        videoElement.style.cssText = "width:100%;height:auto;max-width:100%;border-radius:12px;background:#000";
      }
      videoElement.srcObject = stream;
      await videoElement.play();

      return videoElement;
    } catch (e) {
      console.error("Camera access failed:", e);
      throw new Error("تعذر الوصول للكاميرا: " + e.message);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    scanning = false;
  }

  async function detectBarcode() {
    if (!videoElement || !scanning) return null;

    if (hasBarcodeDetector && barcodeDetector) {
      try {
        const barcodes = await barcodeDetector.detect(videoElement);
        if (barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      } catch (e) {
        console.warn("Barcode detection failed:", e);
      }
    }
    return null;
  }

  async function startContinuousScan(callback, intervalMs = 500) {
    if (scanning) return;
    if (!stream) await startCamera();

    scanning = true;
    onScanCallback = callback;

    scanInterval = setInterval(async () => {
      if (!scanning) return;
      const code = await detectBarcode();
      if (code && onScanCallback) {
        onScanCallback(code);
      }
    }, intervalMs);
  }

  function stopContinuousScan() {
    scanning = false;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    onScanCallback = null;
  }

  function createScannerUI(options = {}) {
    const {
      onScan,
      onClose,
      showTorch = true,
      showGallery = true
    } = options;

    const modal = document.createElement("div");
    modal.className = "modal barcode-scanner-modal";
    modal.style.cssText = "z-index: 100; padding: 0; background: rgba(0,0,0,0.95);";
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 100%; width: 100%; height: 100vh; margin: 0; border-radius: 0; padding: 0; background: #000;">
        <header style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.8);color:#fff;position:sticky;top:0;z-index:10">
          <h2 style="margin:0;font-size:16px">📷 مسح الباركود</h2>
          <div style="display:flex;gap:8px">
            ${showTorch ? `<button id="torchBtn" class="btn btn-ghost" style="padding:6px 12px">🔦 فلاش</button>` : ""}
            ${showGallery ? `<button id="galleryBtn" class="btn btn-ghost" style="padding:6px 12px">🖼️ المعرض</button>` : ""}
            <button id="closeScanner" class="btn btn-red" style="padding:6px 12px">✕ إغلاق</button>
          </div>
        </header>
        <div id="videoContainer" style="position:relative;width:100%;height:calc(100vh - 60px);overflow:hidden"></div>
        <div style="padding:16px;background:rgba(0,0,0,0.8);color:#fff;text-align:center">
          <p id="scanHint" style="margin:0 0 12px;color:#aaa">وجّه الكاميرا نحو الباركود...</p>
          <div class="scanner-overlay" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:100px;border:2px solid #ec4899;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,0.5);pointer-events:none"></div>
        </div>
        <input type="file" id="galleryInput" accept="image/*" capture="environment" hidden>
      </div>
    `;

    const videoContainer = modal.querySelector("#videoContainer");
    const closeBtn = modal.querySelector("#closeScanner");
    const torchBtn = modal.querySelector("#torchBtn");
    const galleryBtn = modal.querySelector("#galleryBtn");
    const galleryInput = modal.querySelector("#galleryInput");
    const hint = modal.querySelector("#scanHint");

    let torchOn = false;

    async function open() {
      document.body.appendChild(modal);
      modal.classList.add("show");

      try {
        await startCamera({ facingMode: "environment" });
        videoContainer.appendChild(videoElement);

        await startContinuousScan(async (code) => {
          hint.textContent = `✅ تم المسح: ${code}`;
          hint.style.color = "#16a34a";
          if (onScan) onScan(code);
          stopContinuousScan();
          setTimeout(() => close(), 1500);
        });
      } catch (e) {
        hint.textContent = `❌ ${e.message}`;
        hint.style.color = "#dc2626";
      }
    }

    function close() {
      stopCamera();
      stopContinuousScan();
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 200);
      if (onClose) onClose();
    }

    closeBtn?.addEventListener("click", close);

    if (torchBtn) {
      torchBtn.addEventListener("click", async () => {
        try {
          const track = stream?.getVideoTracks()[0];
          if (track) {
            const capabilities = track.getCapabilities();
            if (capabilities.torch) {
              torchOn = !torchOn;
              await track.applyConstraints({ advanced: [{ torch: torchOn }] });
              torchBtn.textContent = torchOn ? "🔦 إيقاف الفلاش" : "🔦 فلاش";
              torchBtn.classList.toggle("active", torchOn);
            } else {
              alert("الفلاش غير مدعوم على هذا الجهاز");
            }
          }
        } catch (e) {
          console.error("Torch error:", e);
        }
      });

    if (galleryBtn && galleryInput) {
      galleryBtn.addEventListener("click", () => galleryInput.click());
      galleryInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        hint.textContent = "🔄 جارٍ تحليل الصورة...";
        hint.style.color = "#8b5cf6";
        try {
          const code = await scanImageFile(file);
          if (code) {
            hint.textContent = `✅ تم المسح: ${code}`;
            hint.style.color = "#16a34a";
            if (onScan) onScan(code);
            setTimeout(() => close(), 1500);
          } else {
            hint.textContent = "❌ لم يتم العثور على باركود في الصورة";
            hint.style.color = "#dc2626";
          }
        } catch (e) {
          hint.textContent = `❌ ${e.message}`;
          hint.style.color = "#dc2626";
        }
        e.target.value = "";
      });
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    return { open, close, modal };
  }

  async function scanImageFile(file) {
    if (!hasBarcodeDetector || !barcodeDetector) {
      throw new Error("تحليل الصور غير مدعوم في هذا المتصفح");
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          const barcodes = await barcodeDetector.detect(img);
          URL.revokeObjectURL(url);
          if (barcodes.length > 0) {
            resolve(barcodes[0].rawValue);
          } else {
            resolve(null);
          }
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("فشل تحميل الصورة"));
      };
    });
  }

  async function scanFromVideo(video) {
    if (!hasBarcodeDetector || !barcodeDetector) return null;
    try {
      const barcodes = await barcodeDetector.detect(video);
      return barcodes.length > 0 ? barcodes[0].rawValue : null;
    } catch (e) {
      return null;
    }
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
  }

  function getSupportedFormats() {
    return supportedFormats;
  }

  function isSupported() {
    return hasBarcodeDetector;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBarcodeScanner);
  } else {
    initBarcodeScanner();
  }

  window.BARBII_BARCODE = {
    init: initBarcodeScanner,
    startCamera,
    stopCamera,
    startContinuousScan,
    stopContinuousScan,
    createScannerUI,
    scanImageFile,
    scanFromVideo,
    detectBarcode,
    getSupportedFormats,
    isSupported,
    fmt
  };
})();