/* باربي Barbii — إدارة صور المنتجات */
(function () {
  "use strict";

  const IMAGES_KEY = "barbii_images_v1";
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function validateImage(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: "نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP" };
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: "حجم الملف كبير جداً. الحد الأقصى 2 ميجابايت" };
    }
    return { valid: true };
  }

  function compressImage(base64, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = base64;
    });
  }

  function loadImages() {
    try {
      const raw = localStorage.getItem(IMAGES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveImages(images) {
    try {
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
    } catch (e) {
      console.warn("Failed to save images:", e);
    }
  }

  function getImage(productId) {
    const images = loadImages();
    return images[productId] || null;
  }

  function setImage(productId, base64) {
    const images = loadImages();
    images[productId] = base64;
    saveImages(images);
  }

  function deleteImage(productId) {
    const images = loadImages();
    delete images[productId];
    saveImages(images);
  }

  function createImageUploader(productId, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = "image-uploader";
    const existingImage = getImage(productId);
    wrapper.innerHTML = `
      <div class="image-preview" id="preview-${productId}">
        ${existingImage ? `<img src="${existingImage}" alt="صورة المنتج">` : `<span class="placeholder">📷</span>`}
        ${existingImage ? `<button type="button" class="btn btn-ghost btn-sm delete-btn" data-delete="${productId}">🗑️ حذف</button>` : ""}
      </div>
      <label class="file-input-label">
        <input type="file" id="file-${productId}" accept="image/jpeg,image/png,image/webp" hidden>
        <span class="btn btn-pink">${existingImage ? "🔄 تغيير" : "📤 رفع صورة"}</span>
      </label>
      <p class="image-hint">JPG, PNG, WebP • حتى 2MB • سيتم ضغطها تلقائياً</p>
    `;

    const fileInput = wrapper.querySelector(`#file-${productId}`);
    const preview = wrapper.querySelector(`#preview-${productId}`);
    const deleteBtn = wrapper.querySelector(`[data-delete="${productId}"]`);

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const validation = validateImage(file);
      if (!validation.valid) {
        alert("❌ " + validation.error);
        fileInput.value = "";
        return;
      }

      try {
        let base64 = await fileToBase64(file);
        base64 = await compressImage(base64);
        setImage(productId, base64);
        preview.innerHTML = `<img src="${base64}" alt="صورة المنتج"><button type="button" class="btn btn-ghost btn-sm delete-btn" data-delete="${productId}">🗑️ حذف</button>`;
        wrapper.querySelector(`[data-delete="${productId}"]`).addEventListener("click", handleDelete);
        if (onChange) onChange(base64);
      } catch (err) {
        alert("❌ فشل معالجة الصورة: " + err.message);
      }
      fileInput.value = "";
    });

    function handleDelete() {
      deleteImage(productId);
      preview.innerHTML = `<span class="placeholder">📷</span>`;
      if (onChange) onChange(null);
    }

    if (deleteBtn) deleteBtn.addEventListener("click", handleDelete);

    return wrapper;
  }

  function getProductImageHTML(productId, size = "medium") {
    const image = getImage(productId);
    const sizes = {
      small: "width:40px;height:40px",
      medium: "width:120px;height:120px",
      large: "width:100%;height:200px"
    };
    if (!image) {
      return `<div class="image-placeholder" style="${sizes[size]};display:flex;align-items:center;justify-content:center;background:#f3d9e8;border-radius:12px;font-size:${size === 'large' ? '64px' : size === 'medium' ? '48px' : '24px'}">🎁</div>`;
    }
    return `<img src="${image}" alt="" style="${sizes[size]};object-fit:cover;border-radius:12px">`;
  }

  const style = document.createElement("style");
  style.textContent = `
    .image-uploader { display: flex; flex-direction: column; gap: 8px; }
    .image-preview { position: relative; width: 120px; height: 120px; border: 2px dashed #f3d9e8; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; }
    .image-preview img { width: 100%; height: 100%; object-fit: cover; }
    .image-preview .placeholder { font-size: 48px; color: #f3d9e8; }
    .image-preview .delete-btn { position: absolute; top: 4px; inset-inline-end: 4px; padding: 4px 8px; font-size: 11px; background: rgba(220,38,38,.9); color: white; border-radius: 6px; }
    .file-input-label { cursor: pointer; }
    .file-input-label .btn { width: 120px; text-align: center; }
    .image-hint { margin: 0; font-size: 12px; color: #6b7280; }
    .btn-sm { padding: 6px 10px; font-size: 12px; }
    @media (max-width: 480px) {
      .image-preview { width: 100px; height: 100px; }
      .file-input-label .btn { width: 100px; }
    }
  `;
  document.head.appendChild(style);

  window.BARBII_IMAGES = {
    loadImages,
    saveImages,
    getImage,
    setImage,
    deleteImage,
    createImageUploader,
    getProductImageHTML,
    validateImage,
    compressImage,
    fileToBase64
  };
})();