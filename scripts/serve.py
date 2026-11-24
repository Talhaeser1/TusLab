"""TuşLab yerel sunucu — yeniden doğrulamalı önbellek (no-cache, must-revalidate).

`python -m http.server` önbellek başlığı göndermez; tarayıcı (ör. Brave) eski
JS/CSS dosyalarını saklayıp yeni değişiklikleri göstermeyebilir. Bu sunucu her
yanıta `Cache-Control: no-cache, must-revalidate` ekler: tarayıcı kaynağı her
istekte yeniden doğrular — dosya değişmediyse http.server'ın hazır 304 akışıyla
ucuz gelir, değiştiyse gövde yeniden indirilir. Üretim tarafında kök `_headers`
dosyası aynı politikayı uygular.

Kullanım (proje kökünden):
    python scripts/serve.py             # http://127.0.0.1:5176/
    PORT=8080 python scripts/serve.py   # PORT ortam değişkeni desteklenir
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
        # no-cache: tarayıcı kaynağı her istekte yeniden doğrular (304 akışı http.server'da hazır).
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


def main():
    # Öncelik: komut satırı > PORT ortam değişkeni (önizleme araçları bunu verir) > 5176
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "5176"))
    # Lobi ~150 isteği birden atar; varsayılan kuyruk (5) dolunca bağlantı reddediliyordu (docs/20).
    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"TuşLab sunucusu: http://127.0.0.1:{port}/  (no-cache, must-revalidate; 304 destekli — durdurmak için Ctrl+C)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
