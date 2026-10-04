# 🚀 Ankoris - GitHub Pages ile 7/24 Kesintisiz Mobil Kurulum Kılavuzu

Bu yöntem sayesinde **bilgisayarınız tamamen kapalıyken bile** Ankoris cep telefonunuzdan 7/24, dünyanın her yerinden kesintisiz olarak çalışır.

---

## 🌟 Neden GitHub Pages?

1. **Bilgisayardan Bağımsız:** Bilgisayarınız kapalıyken veya evde değilken telefonunuzdan erişebilirsiniz.
2. **Ücretsiz & 7/24:** GitHub sunucularında ömür boyu ücretsiz barındırılır.
3. **HTTPS Güvenliği & PWA:** Safari ve Chrome'un aradığı tüm HTTPS güvenlik sertifikalarına sahiptir; telefonunuza tek dokunuşla yerel uygulama gibi kurulur ("Ana Ekrana Ekle").
4. **Çevrimdışı (Offline-First):** Telefonunuza bir kez yüklendikten sonra metroda, uçakta, internetiniz olmasa bile 5.000 kelime ve testler eksiksiz çalışır.

---

## 🛠️ 3 Adımda Kolay Kurulum

### Adım 1: GitHub'da Yeni Depo (Repository) Açın
1. [github.com](https://github.com/) adresine girip hesabınıza giriş yapın.
2. Sağ üstteki **+** simgesine tıklayıp **"New repository"** seçin.
3. **Repository name** kısmına `ankoris` yazın.
4. **Public** seçili olsun (GitHub Pages ücretsiz çalışması için).
5. "Add a README file" kutucuğunu **işaretlemeyin** (boş kalsın).
6. **"Create repository"** butonuna basın.
7. Sayfadaki HTTPS linkini kopyalayın (Örn: `https://github.com/KULLANICI_ADINIZ/ankoris.git`).

---

### Adım 2: Tek Tıkla GitHub'a Yükleyin
Proje klasörünüzdeki **`deploy_to_github.bat`** dosyasına çift tıklayın:
1. Sizden GitHub repo linkini isteyecektir. Kopyaladığınız linki yapıştırıp **Enter**'a basın.
2. Açılan pencerede GitHub hesabınızı onaylayın (Windows Credential Manager).
3. Tüm dosyalar ve 5000 kelimelik kütüphane saniyeler içinde GitHub'a aktarılacaktır.

*(Alternatif olarak terminalden çalıştırmak isterseniz):*
```powershell
git remote add origin https://github.com/KULLANICI_ADINIZ/ankoris.git
git push -u origin main
```

---

### Adım 3: GitHub Pages'i Aktif Edin (Sadece 10 Saniye)
1. GitHub reponuzda üst menüden **Settings** sekmesine tıklayın.
2. Sol menüden **Pages** seçeneğine tıklayın.
3. **Build and deployment** başlığı altındaki **Source** açılır kutusundan:
   * **Seçenek A (Otomatik GitHub Actions):** `GitHub Actions` seçin. Hazırladığımız iş akışı 1 dakika içinde otomatik yayına alır.
   * **Seçenek B (Klasik /docs):** `Deploy from a branch` seçip dalı `main` ve klasörü `/docs` yapıp **Save**'e tıklayın.

---

## 📱 Cep Telefonundan Açma & Yükleme

Yayın tamamlandığında (1-2 dakika sürer) GitHub size özel bir adres verir:
```text
https://KULLANICI_ADINIZ.github.io/ankoris/
```

1. Bu adresi cep telefonunuzun tarayıcısında (Safari veya Chrome) açın.
2. **iPhone (Safari):** Alttaki Paylaş butonuna dokunun -> **"Ana Ekrana Ekle"** deyin.
3. **Android (Chrome):** Sağ üstteki menüden -> **"Uygulamayı Yükle"** deyin.

Artık Ankoris cep telefonunuzun ana ekranında bağımsız bir mobil uygulama olarak yer alacak, **bilgisayarınız kapalıyken de** dilediğiniz zaman kelime çalışabileceksiniz!
