# ⚓ Ankoris Mobile (Bilimsel Hafıza & Mnevo AI Destekli Kelime Öğrenme)

Ankoris; bilimsel hafıza teknikleri (**Aralıklı Tekrar / SRS - SM-2 Algoritması**, **Mnemonik Kodlama**) ve etkileşimli yapay zeka koçu (**Mnevo AI**) ile özellikle YDS, YÖKDİL, TOEFL ve akademik İngilizce kelimelerini zihne kalıcı olarak sabitleyen **çevrimdışı öncelikli (Offline-First)** bir mobil uygulamadır.

---

## 🛠️ Mimari ve Teknoloji Yığını

* **Mobil Çatı:** Flutter & Dart (Clean Architecture + Feature-First)
* **Durum Yönetimi (State Management):** Flutter Riverpod (`StateNotifierProvider`)
* **Çevrimdışı Veritabanı:** SQLite (`sqflite`) — Ağ bağlantısı olmasa bile tüm kartlar yerelden anında yüklenir ve çalışılır.
* **Bulut Senkronizasyonu & Güvenlik:** Supabase (PostgreSQL + RLS Güvenlik Politikaları + Otomatik Senkronizasyon Kuyruğu `sync_queue`)
* **Ses & Telaffuz:** Cihaz İçi Text-to-Speech (TTS - `flutter_tts`)
* **Haptik:** `HapticFeedback` mikro etkileşimleri

---

## 📁 Proje Dizin Yapısı

```text
lib/
├── app.dart                                # MaterialApp, Tema ve Arka Plan Sync Başlatıcı
├── main.dart                               # Veritabanı ve Supabase başlatıcı, ProviderScope
├── core/
│   ├── constants/
│   │   ├── app_colors.dart                 # OLED Siyahı, Neon Zümrüt & İndigo renk sistemi
│   │   └── app_constants.dart              # Supabase URL/Key ve anonim misafir ID tanımları
│   ├── database/
│   │   ├── database_helper.dart            # SQLite singleton yöneticisi & tohum kelimeler
│   │   └── tables.dart                     # words, user_word_progress, sync_queue DDL
│   ├── network/
│   │   └── supabase_client.dart            # SupabaseClient Riverpod provider
│   ├── services/
│   │   ├── audio_service.dart              # Cihaz içi TTS (en-US) servisi
│   │   ├── haptic_service.dart             # Haptic dokunma titreşim sarmalayıcısı
│   │   └── sync_service.dart               # İnternet gelince otomatik eşitleyen servis
│   └── theme/
│       └── app_theme.dart                  # Material 3 OLED Dark Mode teması
│
└── features/
    └── srs_study/                          # 🧠 Çekirdek SRS & Kelime Kartı Modülü
        ├── domain/
        │   ├── entities/
        │   │   ├── word_entity.dart
        │   │   └── user_progress_entity.dart
        │   ├── repositories/
        │   │   └── i_srs_repository.dart   # Depo arayüzü
        │   └── srs_algorithm.dart          # SM-2 algoritmasının saf matematiksel motoru
        ├── data/
        │   ├── datasources/
        │   │   ├── local_srs_datasource.dart       # SQLite sorguları & sync_queue ekleme
        │   │   └── remote_supabase_datasource.dart # Supabase REST istemcisi
        │   ├── models/
        │   │   ├── word_model.dart
        │   │   └── user_progress_model.dart
        │   └── repositories/
        │       └── srs_repository_impl.dart        # Çevrimdışı öncelikli eşitleme mantığı
        └── presentation/
            ├── providers/
            │   └── study_session_provider.dart     # Seans durumu & kart puanlama yöneticisi
            └── views/
                └── study_session_screen.dart       # 3D Flip, Swipe ve OLED kart ekranı
    │
    └── gamification/                       # 🏆 Oyunlaştırma, Ligler & Streak Modülü
        ├── domain/
        │   ├── entities/
        │   │   ├── league_tier.dart                # Bronz, Gümüş, Altın, Elmas lig tanımları
        │   │   ├── user_gamification_entity.dart   # Streak, XP, Seviye, Günlük Hedef
        │   │   └── leaderboard_entry.dart          # Liderlik sıralama satırı
        │   ├── repositories/
        │   │   └── i_gamification_repository.dart
        │   └── gamification_engine.dart            # XP ödül, seviye atlama & seri koruma motoru
        ├── data/
        │   ├── datasources/
        │   │   ├── local_gamification_datasource.dart
        │   │   └── remote_gamification_datasource.dart
        │   ├── models/
        │   │   └── user_gamification_model.dart
        │   └── repositories/
        │       └── gamification_repository_impl.dart
        └── presentation/
            ├── providers/
            │   └── gamification_provider.dart      # Profil ve lig liderlik tablosu provider'ları
            ├── views/
            │   └── leaderboard_screen.dart         # Haftalık podyumlu lig sıralama ekranı
            └── widgets/
                ├── confetti_celebration.dart       # Seviye ve hedef kutlama konfeti efekti
                └── streak_header_badge.dart        # AppBar canlı Streak, XP ve Seviye rozeti
```

---

## ⚡ Temel Modüllerin Çalışma Mantığı

### 1. Çevrimdışı Öncelikli (Offline-First) SRS Akışı:
* Cihazda internet olmasa dahi yerel SQLite veritabanı devreye girer.
* Kullanıcı kartları puanladığında (`Again`, `Hard`, `Good`, `Easy`):
  * `SrsEngine` anında yeni `Ease Factor`, `Interval (Gün)` ve `Next Review Date` değerlerini hesaplar.
  * Yerel SQLite tablosuna (`user_word_progress`) ve senkronizasyon kuyruğuna (`sync_queue`) yazılır.

    │
    ├── auth/                               # 👤 Çoklu Kullanıcı Profil & Hesap Yönetimi
    │   ├── domain/entities/user_profile_entity.dart
    │   └── presentation/providers/auth_provider.dart
    │
    ├── vocabulary_hub/                     # 📚 5000 Kelimelik Kütüphane & 50 Ünite
    │   ├── domain/entities/study_unit_entity.dart
    │   └── presentation/providers/unit_selector_provider.dart
    │
    └── mnevo_ai/                           # 🤖 Mnevo AI Kişisel Dil Koçu
        ├── domain/entities/mnevo_response_entity.dart
        ├── data/datasources/mnevo_ai_service.dart
        └── presentation/
            ├── providers/mnevo_coach_provider.dart
            └── widgets/mnevo_bottom_sheet.dart
```

---

## ⚡ Temel Modüller ve Yeni Özellikler

### 1. 5000 Kelimelik YDS & YÖKDİL Kütüphanesi (50 Tematik Ünite):
* [**`assets/seed/yds_yokdil_5000.json`**](file:///c:/Users/PC/Desktop/Ankoris/assets/seed/yds_yokdil_5000.json) ve [**`web_runner/words_library.js`**](file:///c:/Users/PC/Desktop/Ankoris/web_runner/words_library.js) içine 5000 otantik sınav kelimesi eklendi.
* **Ünite Kategorileri:**
  * **Ünite 1 - 10:** YDS En Kritik Sıfatlar (1000 Kelime)
  * **Ünite 11 - 20:** YDS & YÖKDİL Temel & İleri Fiiller (1000 Kelime)
  * **Ünite 21 - 25:** YÖKDİL Sağlık Bilimleri (500 Kelime)
  * **Ünite 26 - 30:** YÖKDİL Sosyal Bilimler (500 Kelime)
  * **Ünite 31 - 35:** YÖKDİL Fen Bilimleri (500 Kelime)
  * **Ünite 36 - 40:** Sınavlarda En Çok Çıkan Phrasal Verbs (500 Kelime)
  * **Ünite 41 - 45:** Akademik Kelime Listesi (AWL) (500 Kelime)
  * **Ünite 46 - 50:** İleri Düzey İsimler, Zarflar ve Bağlaçlar (500 Kelime)

### 2. İstenen Üniteyi ve Kelime Sayısını Seçip Çalışabilme:
* Kullanıcı **"Değiştir ➔"** veya kitap simgesine tıklayarak 50 üniteyi kategoriye göre filtreleyebilir veya arayabilir.
* Birden fazla ünite aynı anda seçilebilir (örn: *Ünite 1 + Ünite 21 + Ünite 36*).
* Kelime çalışma limiti serbestçe belirlenebilir: **10**, **20**, **50**, **100** veya **Tümü**.
* *"🎯 Seansı Başlat"* butonuna tıklandığında anında dinamik deste kurulur ve çalışma başlar.

### 3. Çoklu Kullanıcı Profil & Hesap Yönetim Sistemi:
* Sol üstteki avatar simgesinden profil paneli açılır.
* Farklı öğrenciler veya profiller arasında anında geçiş yapılabilir (*Berk Yılmaz (YDS)*, *Dr. Zeynep Kaya (YÖKDİL Sağlık)*, vb.).
* Her kullanıcının kendi serisi (**Streak**), **XP puanı**, **Seviyesi** ve çalıştığı kelimeler bağımsız olarak saklanır.
* Yeni öğrenci hesabı ekleme formu ile anında yeni hesap açılabilir.


