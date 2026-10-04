# serve.py
# Ankoris Yerel Web Sunucusu ve Mobil Ağ Yayını

import http.server
import socketserver
import webbrowser
import os
import sys
import socket

PORT = 5173
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_runner")

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

def generate_qr(url):
    try:
        import qrcode
        import qrcode.image.svg
        factory = qrcode.image.svg.SvgPathImage
        img = qrcode.make(url, image_factory=factory)
        qr_path = os.path.join(DIRECTORY, "qr_mobile.svg")
        with open(qr_path, "wb") as f:
            img.save(f)
    except Exception as e:
        pass

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Mobil tarayıcılar ve PWA için Service Worker / Manifest CORS başlıkları
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

def start_server():
    os.chdir(DIRECTORY)
    lan_ip = get_lan_ip()
    local_url = f"http://localhost:{PORT}"
    mobile_url = f"http://{lan_ip}:{PORT}"

    generate_qr(mobile_url)

    # 0.0.0.0 ile hem yerel hem de yerel ağdaki (Wi-Fi) tüm mobil cihazlara izin ver
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        print("\n=======================================================")
        print("  ANKORIS - Zihinsel Kelime Capasi & Mnevo AI Calisiyor")
        print("=======================================================")
        print(f"  [PC / Masaustu]  : {local_url}")
        print(f"  [MOBIL TELEFON]  : {mobile_url}")
        print("-------------------------------------------------------")
        print("  * Cep telefonunuzdan ayni Wi-Fi agina baglanarak")
        print(f"    yukaridaki mobil adresi ({mobile_url}) tarayiciya girin.")
        print("  * Veya uygulamadaki 'Mobil QR' butonundan QR kodu taratin.")
        print("  * Standalone PWA: Safari/Chrome'da 'Ana Ekrana Ekle' yapin.")
        print("=======================================================\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nSunucu kapatildi.")

if __name__ == "__main__":
    start_server()
