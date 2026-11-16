#!/usr/bin/env python3
"""خادم التطوير المحلي لباربي — خادم ثابت بسيط بترويسات صحيحة.

الاستخدام:
    python3 serve.py            # المنفذ 8000 افتراضياً
    python3 serve.py 8080       # منفذ آخر
    PORT=9000 python3 serve.py  # عبر متغير بيئة

لماذا لا نستخدم `python3 -m http.server`؟
  • يضمن MIME صحيح لـ .webmanifest و .js و .svg (لازم لتثبيت PWA).
  • يمنع تخزين الصفحات وملفات التطبيق في الكاش، فلا تظهر نسخة قديمة
    من الموقع داخل المعاينة بعد أي تعديل.
  • يعمل على 0.0.0.0 حتى تصل إليه معاينة المتصفح في السحابة.
"""

import os
import posixpath
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))

EXTRA_TYPES = {
    ".webmanifest": "application/manifest+json",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}

# ملفات يجب ألا تُخزَّن مؤقتاً إطلاقاً (حتى لا تعلق نسخة قديمة).
NO_STORE = (".html", ".webmanifest", "/sw.js")


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **EXTRA_TYPES}

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path == "/" or path in ("/sw.js", "/manifest.webmanifest") or path.endswith(".html"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        else:
            self.send_header("Cache-Control", "no-cache")
        self.send_header("Service-Worker-Allowed", "/")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def translate_path(self, path):
        # نمنع الخروج من مجلد المشروع عبر ../ أو مسارات مطلقة غريبة.
        clean = posixpath.normpath(path.split("?", 1)[0].split("#", 1)[0])
        clean = clean.lstrip("/")
        resolved = os.path.normpath(os.path.join(ROOT, clean))
        if not resolved.startswith(ROOT):
            return os.path.join(ROOT, "index.html")
        return resolved

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


def main():
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), partial(Handler, directory=ROOT))
    print(f"🎀 باربي — خادم التطوير يعمل على http://0.0.0.0:{port}  (المجلد: {ROOT})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
