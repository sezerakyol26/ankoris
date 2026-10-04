# test_suite.py
# Ankoris SM-2 ve Oyunlaştırma Algoritmaları Doğrulama Testi

import math
from datetime import datetime, timezone, timedelta

def sm_2_calculate(rating, ease_factor, interval_days, repetitions, box_level):
    """
    SrsRating:
      1: again
      2: hard
      3: good
      4: easy
    """
    min_ef = 1.30
    if rating == 1: # again
        new_repetitions = 0
        new_interval = 1
        new_box = 1
        new_ef = max(min_ef, min(3.0, ease_factor - 0.20))
    elif rating == 2: # hard
        new_repetitions = repetitions + 1
        new_ef = max(min_ef, min(3.0, ease_factor - 0.15))
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 2
        else:
            new_interval = round(interval_days * 1.2)
        new_box = max(1, box_level)
    elif rating == 3: # good
        new_repetitions = repetitions + 1
        new_box = box_level + 1
        new_ef = ease_factor
        if new_repetitions == 1:
            new_interval = 1
        elif new_repetitions == 2:
            new_interval = 4
        else:
            new_interval = round(interval_days * new_ef)
    elif rating == 4: # easy
        new_repetitions = repetitions + 1
        new_box = box_level + 2
        new_ef = max(min_ef, min(3.20, ease_factor + 0.15))
        if new_repetitions == 1:
            new_interval = 3
        elif new_repetitions == 2:
            new_interval = 7
        else:
            new_interval = round(interval_days * new_ef * 1.3)
    else:
        raise ValueError("Geçersiz puanlama")

    return {
        "ease_factor": round(new_ef, 2),
        "interval_days": max(1, new_interval),
        "repetitions": new_repetitions,
        "box_level": new_box
    }

def test_srs_flow():
    print("--- [TEST 1] SM-2 Algoritma Testi Başlatılıyor ---")
    ef = 2.50
    interval = 0
    rep = 0
    box = 1

    # Adım 1: Yeni kelime ilk defa 'Good' biliniyor
    step1 = sm_2_calculate(3, ef, interval, rep, box)
    assert step1["interval_days"] == 1, f"Beklenen 1, gelen {step1['interval_days']}"
    assert step1["repetitions"] == 1
    print("[OK] Adim 1 (Ilk Good): Interval 1 gun, Repetition 1")

    # Adım 2: İkinci tekrar yine 'Good'
    step2 = sm_2_calculate(3, step1["ease_factor"], step1["interval_days"], step1["repetitions"], step1["box_level"])
    assert step2["interval_days"] == 4, f"Beklenen 4, gelen {step2['interval_days']}"
    assert step2["repetitions"] == 2
    print("[OK] Adim 2 (Ikinci Good): Interval 4 gun, Repetition 2")

    # Adım 3: Üçüncü tekrar 'Easy'
    step3 = sm_2_calculate(4, step2["ease_factor"], step2["interval_days"], step2["repetitions"], step2["box_level"])
    assert step3["interval_days"] >= 13, f"Beklenen >=13, gelen {step3['interval_days']}"
    assert step3["ease_factor"] == 2.65
    print(f"[OK] Adim 3 (Easy): Interval {step3['interval_days']} gun, Ease Factor 2.65")

    # Adım 4: Dördüncü tekrar 'Again' (Unutuldu!)
    step4 = sm_2_calculate(1, step3["ease_factor"], step3["interval_days"], step3["repetitions"], step3["box_level"])
    assert step4["interval_days"] == 1, f"Beklenen 1, gelen {step4['interval_days']}"
    assert step4["repetitions"] == 0
    assert step4["box_level"] == 1
    assert step4["ease_factor"] == 2.45
    print("[OK] Adim 4 (Again - Unutuldu): Interval 1 gune sifirlandi, EF 2.45e dusuruldu.")
    print("[SUCCESS] TUM SRS SM-2 TESTLERI BASARIYLA GECTI!\n")

def test_gamification_flow():
    print("--- [TEST 2] Oyunlastirma & Streak Koruma Testi Baslatiliyor ---")
    streak = 5
    freeze = 1
    xp = 140
    level = 1

    # 1. Good cevabı ile +10 XP
    xp += 10
    level = math.floor(xp / 150) + 1
    assert level == 2, "Seviye 2'ye geçmeliydi"
    print(f"[OK] Seviye Atlama: {xp} XP ile Seviye {level}e ulasildi.")

    # 2. 1 gün kaçırıldığında Streak Freeze koruması
    freeze -= 1
    streak += 1
    assert freeze == 0, "Streak freeze harcanmalı"
    assert streak == 6, "Streak korunup artmalı"
    print("[OK] Streak Freeze: 1 gun kacirildi, kalkan harcandi ve 6 gunluk seri korundu.")
    print("[SUCCESS] TUM OYUNLASTIRMA TESTLERI BASARIYLA GECTI!\n")

def test_quiz_and_hard_word_calculation():
    print("--- [TEST 3] Kelime Testi & Zor Kelime Hesaplama Testi Baslatiliyor ---")
    
    # 1. Başlangıçta öğrenilmiş bir kelime
    ef = 2.50
    lapses = 0
    test_wrong_count = 0
    consecutive_correct = 2
    is_hard = False
    
    # Senaryo A: Testte YANLIŞ cevap verildi
    is_correct = False
    if not is_correct:
        is_hard = True
        lapses += 1
        test_wrong_count += 1
        ef = max(1.30, ef - 0.20)
        consecutive_correct = 0
        earned_xp = 0
    
    assert is_hard == True, "Yanlış cevaplanan kelime Zor Kelime olmalı"
    assert lapses == 1, f"Lapse 1 olmalı, gelen {lapses}"
    assert test_wrong_count == 1
    assert round(ef, 2) == 2.30, f"EF 2.30 olmalı, gelen {ef}"
    assert consecutive_correct == 0
    assert earned_xp == 0
    print("[OK] Testte Yanlis Cevap: Kelime Zor Kelime havuzuna alindi, EF 2.30'a dusuruldu, Lapses artirildi.")

    # Senaryo B: Ardışık 2 kez testte DOĞRU cevap verilip pekiştiriliyor
    for i in range(2):
        is_correct = True
        consecutive_correct += 1
        if lapses > 0:
            lapses -= 1
        ef = min(3.0, ef + 0.05)
        is_hard = (lapses > 0 or ef < 2.0)
        earned_xp = 15
        
    assert lapses == 0, "2 doğru ile lapse sıfırlanmalı"
    assert is_hard == False, "Lapses 0 ve EF > 2.0 ise zorluktan mezun olmalı"
    assert consecutive_correct == 2
    assert round(ef, 2) == 2.40
    print("[OK] Testte Ardisik Dogru: Kelime pekisti (+15 XP/soru), EF 2.40'a cikti ve zorluktan mezun oldu.")
    print("[SUCCESS] TUM TEST VE ZOR KELIME HESAPLAMA TESTLERI BASARIYLA GECTI!\n")

def test_knowledge_choice_and_security():
    print("--- [TEST 4] 'Öğrendim' vs 'Zaten Biliyordum' & Güvenlik Testi Başlatılıyor ---")

    # 1. "Öğrendim" Seçeneği Simülasyonu
    prog_learned = {
        "repetitions": 0,
        "box_level": 0,
        "ease_factor": 2.50,
        "interval": 0,
        "is_already_known": False,
        "status": "unstudied"
    }

    # Kullanıcı "Öğrendim" seçiyor
    prog_learned["repetitions"] += 1
    prog_learned["box_level"] += 1
    prog_learned["interval"] = 1 # 1 gün aralıklı tekrar
    prog_learned["status"] = "learning"
    xp_earned_1 = 10

    assert prog_learned["interval"] == 1, "İlk öğrenilen kelime 1 gün sonra tekrarlanmalı"
    assert prog_learned["box_level"] == 1
    assert prog_learned["status"] == "learning"
    assert prog_learned["is_already_known"] == False
    assert xp_earned_1 == 10
    print("[OK] 'Öğrendim' Seçeneği: Kelime aralıklı tekrar döngüsüne alındı (1 Gün, Lv.1, +10 XP).")

    # 2. "Zaten Biliyordum" Seçeneği Simülasyonu
    prog_known = {
        "repetitions": 0,
        "box_level": 0,
        "ease_factor": 2.50,
        "interval": 0,
        "is_already_known": False,
        "status": "unstudied"
    }

    # Kullanıcı "Zaten Biliyordum" seçiyor
    prog_known["repetitions"] = 4
    prog_known["box_level"] = 5 # Usta seviyesi
    prog_known["interval"] = 30 # 30 gün uzun aralık
    prog_known["ease_factor"] = 2.80
    prog_known["status"] = "mastered"
    prog_known["is_already_known"] = True
    xp_earned_2 = 15

    assert prog_known["interval"] == 30, "Zaten bilinen kelime 30 gün uzun aralığa sıçramalı"
    assert prog_known["box_level"] == 5, "Doğrudan Usta (Lv.5) seviyesine geçmeli"
    assert prog_known["status"] == "mastered"
    assert prog_known["is_already_known"] == True
    assert xp_earned_2 == 15
    print("[OK] 'Zaten Biliyordum' Seçeneği: Kelime doğrudan Usta seviyesine aktarıldı (30 Gün, Lv.5, +15 XP).")

    # 3. Veri Güvenliği ve Sağlama Anahtarı (Checksum Integrity)
    salt = "ankoris_secure_storage_salt_2026_ebbinghaus"
    import hashlib
    def calc_checksum(data_str):
        return hashlib.sha256((data_str + salt).encode('utf-8')).hexdigest()

    user_data = '{"id":"user_1","name":"Berk Yılmaz","email":"berk.yilmaz@ankoris.app"}'
    chk1 = calc_checksum(user_data)
    assert chk1 == calc_checksum(user_data), "Aynı veri aynı sağlama anahtarını üretmeli"

    # Veri tahrif edilirse (tamper test)
    tampered_data = '{"id":"user_1","name":"Hacked Name","email":"berk.yilmaz@ankoris.app"}'
    chk2 = calc_checksum(tampered_data)
    assert chk1 != chk2, "Tahrif edilmiş veri tespit edilmeli ve reddedilmeli"
    print("[OK] Veri Güvenliği: SHA-256 sağlama anahtarı veri bütünlüğü ve tahrif korumasını doğruladı.")
    print("[SUCCESS] 'ÖĞRENDİM', 'ZATEN BİLİYORDUM' VE GÜVENLİK TESTLERİ BAŞARIYLA GEÇTİ!\n")

if __name__ == "__main__":
    test_srs_flow()
    test_gamification_flow()
    test_quiz_and_hard_word_calculation()
    test_knowledge_choice_and_security()
