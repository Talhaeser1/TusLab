"""TuşLab yerel geliştirme sunucusu (önbelleksiz).

`python -m http.server` önbellek başlığı göndermez; tarayıcı (ör. Brave) eski
JS/CSS dosyalarını saklayıp yeni değişiklikleri göstermeyebilir. Bu sunucu her
yanıta `Cache-Control: no-store` ekler.

Kullanım (proje kökünden):
    python scripts/dev-server.py            # http://127.0.0.1:5176/
    python scripts/dev-server.py 8080
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".wav": "audio/wav",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main():
    # Öncelik: komut satırı > PORT ortam değişkeni (önizleme araçları bunu verir) > 5176
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "5176"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"TuşLab geliştirme sunucusu: http://127.0.0.1:{port}/  (önbellek kapalı, durdurmak için Ctrl+C)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
