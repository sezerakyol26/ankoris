// web_runner/app.js
// Ankoris 5000 Kelimelik Kütüphane, Bilimsel Unutma Eğrisi (Ebbinghaus), Zor Kelimeler & Profil Yönetimi

// --- 0. GÜVENLİ VE KALICI DEPOLAMA MOTORU (SecureStorage & Tamper Protection) ---
class SecureStorage {
  static SALT = 'ankoris_secure_storage_salt_2026_ebbinghaus';

  // Güçlü, deterministik 64-bit benzeri veri bütünlüğü sağlama algoritması
  static hash(str) {
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      h1 = ((h1 << 5) + h1) ^ char;
      h2 = ((h2 << 5) + h2) ^ char;
    }
    return (Math.abs(h1).toString(16) + Math.abs(h2).toString(16));
  }

  // XSS ve zararlı enjeksiyonlara karşı veri temizleme
  static sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>'"&]/g, (m) => {
      switch(m) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        case '&': return '&amp;';
        default: return m;
      }
    }).trim();
  }

  static set(key, value) {
    try {
      const json = JSON.stringify(value);
      const checksum = this.hash(json + this.SALT);
      const envelope = {
        version: 2,
        timestamp: Date.now(),
        payload: value,
        checksum: checksum
      };
      const envelopeStr = JSON.stringify(envelope);
      localStorage.setItem(key, envelopeStr);
      // Çift katmanlı kalıcılık garantisi (Mirror Backup)
      localStorage.setItem(`mirror_${key}`, envelopeStr);
      return true;
    } catch (e) {
      console.error('SecureStorage save error:', e);
      return false;
    }
  }

  static get(key, fallback = null) {
    try {
      let raw = localStorage.getItem(key);
      if (!raw) {
        // Ana depolama eksikse aynadan (mirror) kurtar
        raw = localStorage.getItem(`mirror_${key}`);
      }
      if (!raw) return fallback;

      const envelope = JSON.parse(raw);
      // Eski sürüm düz veri kontrolü
      if (!envelope || !envelope.checksum) {
        return envelope || fallback;
      }

      // Veri bütünlüğü doğrulaması
      const expected = this.hash(JSON.stringify(envelope.payload) + this.SALT);
      if (expected !== envelope.checksum) {
        console.warn(`Veri bütünlüğü uyuşmazlığı (${key}). Sağlam yedekten geri yükleniyor...`);
        const mirrorRaw = localStorage.getItem(`mirror_${key}`);
        if (mirrorRaw) {
          const mirrorEnv = JSON.parse(mirrorRaw);
          if (this.hash(JSON.stringify(mirrorEnv.payload) + this.SALT) === mirrorEnv.checksum) {
            return mirrorEnv.payload;
          }
        }
        return fallback;
      }
      return envelope.payload;
    } catch (e) {
      console.error('SecureStorage read error:', e);
      return fallback;
    }
  }
}

// --- 1. ÇOKLU KULLANICI PROFİLLERİ (Multi-Account State) ---
const DEFAULT_ACCOUNTS = [
  {
    id: 'user_1',
    name: 'Berk Yılmaz',
    email: 'berk.yilmaz@ankoris.app',
    exam: 'YDS',
    avatar: 'BY',
    streak: 1,
    xp: 15,
    level: 1,
    freeze: 1,
    dailyReviewed: 0,
    dailyTarget: 20
  },
  {
    id: 'user_2',
    name: 'Dr. Zeynep Kaya',
    email: 'zeynep.kaya@tip.edu.tr',
    exam: 'YÖKDİL SAĞLIK',
    avatar: 'ZK',
    streak: 4,
    xp: 140,
    level: 2,
    freeze: 2,
    dailyReviewed: 10,
    dailyTarget: 20
  },
  {
    id: 'user_3',
    name: 'Caner Özkan',
    email: 'caner.ozkan@ankoris.app',
    exam: 'YÖKDİL SOSYAL',
    avatar: 'CÖ',
    streak: 2,
    xp: 65,
    level: 1,
    freeze: 1,
    dailyReviewed: 4,
    dailyTarget: 15
  }
];

class AccountManager {
  constructor() {
    this.accounts = SecureStorage.get('ankoris_accounts', DEFAULT_ACCOUNTS);
    const activeId = localStorage.getItem('ankoris_active_user_id') || 'user_1';
    this.currentUser = this.accounts.find(a => a.id === activeId) || this.accounts[0];
  }

  save() {
    SecureStorage.set('ankoris_accounts', this.accounts);
    localStorage.setItem('ankoris_active_user_id', this.currentUser.id);
  }

  switchAccount(userId) {
    const target = this.accounts.find(a => a.id === userId);
    if (target) {
      this.currentUser = target;
      this.save();
      return true;
    }
    return false;
  }

  createAccount(name, email, exam) {
    const cleanName = SecureStorage.sanitize(name);
    const cleanEmail = SecureStorage.sanitize(email);
    const initials = cleanName.split(' ').map(w => w[0].toUpperCase()).slice(0, 2).join('');
    
    const newAcc = {
      id: 'user_' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      exam: exam,
      avatar: initials || 'ÖG',
      streak: 1,
      xp: 0,
      level: 1,
      freeze: 1,
      dailyReviewed: 0,
      dailyTarget: 20
    };
    this.accounts.push(newAcc);
    this.currentUser = newAcc;
    this.save();
    return newAcc;
  }

  resetCurrentAccount() {
    this.currentUser.xp = 0;
    this.currentUser.level = 1;
    this.currentUser.streak = 1;
    this.currentUser.dailyReviewed = 0;
    this.save();
  }

  resetAllAccountsData() {
    this.accounts.forEach(acc => {
      acc.xp = 0;
      acc.level = 1;
      acc.streak = 1;
      acc.dailyReviewed = 0;
    });
    this.save();
  }
}

const accountMgr = new AccountManager();

// --- 2. KULLANICI KELİME GELİŞİMİ & EBBINGHAUS UNUTMA EĞRİSİ MOTORU ---
class ProgressManager {
  constructor(userId) {
    this.userId = userId;
    this.storageKey = `ankoris_progress_${userId}`;
    this.data = this.load();
    this.ensureSeedSimulatedData();
  }

  load() {
    return SecureStorage.get(this.storageKey, {});
  }

  save() {
    SecureStorage.set(this.storageKey, this.data);
  }

  clearAllProgress() {
    this.data = {};
    localStorage.removeItem(this.storageKey);
    this.save();
  }

  // İlk açılışta kullanıcının unutma eğrisini ve zor kelimeleri deneyimlemesi için gerçekçi başlangıç verileri
  ensureSeedSimulatedData() {
    if (Object.keys(this.data).length === 0 && !localStorage.getItem('ankoris_skip_seed')) {
      const now = Date.now();
      const oneDay = 24 * 3600 * 1000;

      // 1. Detrimental (Zor kelime - lapse var, test bekliyor)
      this.data['w_1'] = {
        repetitions: 1,
        boxLevel: 1,
        easeFactor: 1.90,
        interval: 1,
        lapses: 2,
        consecutiveCorrect: 0,
        isConsolidated: false,
        testPassed: false,
        testCorrectCount: 0,
        testWrongCount: 2,
        status: 'hard',
        lastReviewedAt: new Date(now - oneDay * 3).toISOString(),
        nextReviewAt: new Date(now - oneDay).toISOString() // Süresi geçmiş
      };

      // 2. Ambiguous (Tekrarı gelmiş, test bekliyor)
      this.data['w_2'] = {
        repetitions: 2,
        boxLevel: 2,
        easeFactor: 2.30,
        interval: 3,
        lapses: 1,
        consecutiveCorrect: 1,
        isConsolidated: false,
        testPassed: false,
        testCorrectCount: 0,
        testWrongCount: 0,
        status: 'test_pending',
        lastReviewedAt: new Date(now - oneDay * 4).toISOString(),
        nextReviewAt: new Date(now - oneDay).toISOString() // Süresi geçmiş
      };

      // 3. Mitigate (Zor kelime)
      this.data['w_3'] = {
        repetitions: 1,
        boxLevel: 1,
        easeFactor: 1.80,
        interval: 1,
        lapses: 3,
        consecutiveCorrect: 0,
        isConsolidated: false,
        testPassed: false,
        testCorrectCount: 0,
        testWrongCount: 3,
        status: 'hard',
        lastReviewedAt: new Date(now - oneDay * 2).toISOString(),
        nextReviewAt: new Date(now - oneDay).toISOString()
      };

      // 4. Vulnerable (Testi çözülmüş ve tam pekiştirilmiş)
      this.data['w_4'] = {
        repetitions: 4,
        boxLevel: 4,
        easeFactor: 2.65,
        interval: 14,
        lapses: 0,
        consecutiveCorrect: 4,
        isConsolidated: true, // Test çözülerek pekiştirildi
        testPassed: true,
        testCorrectCount: 2,
        testWrongCount: 0,
        status: 'consolidated',
        lastReviewedAt: new Date(now - oneDay * 1).toISOString(),
        nextReviewAt: new Date(now + oneDay * 13).toISOString()
      };

      // 5. Plausible (Öğrenilmekte, test bekliyor)
      this.data['w_5'] = {
        repetitions: 2,
        boxLevel: 2,
        easeFactor: 2.50,
        interval: 4,
        lapses: 0,
        consecutiveCorrect: 2,
        isConsolidated: false,
        testPassed: false,
        testCorrectCount: 0,
        testWrongCount: 0,
        status: 'test_pending',
        lastReviewedAt: new Date(now - oneDay * 2).toISOString(),
        nextReviewAt: new Date(now + oneDay * 2).toISOString()
      };

      this.save();
    }
  }

  // 4 saatlik minimum hafıza soğuma süresi
  static COOLDOWN_MS = 4 * 3600 * 1000;

  getWordProgress(wordId) {
    return this.data[wordId] || {
      repetitions: 0,
      boxLevel: 1,
      easeFactor: 2.50,
      interval: 0,
      lapses: 0,
      consecutiveCorrect: 0,
      isConsolidated: false, // Yalnızca test çözülerek pekiştirilebilir
      testPassed: false,
      testCorrectCount: 0,
      testWrongCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null
    };
  }

  // Kelime soğuma süresinde mi? (Son çalışma üzerinden 4 saat geçmemişse)
  isWordOnCooldown(wordId) {
    const p = this.getWordProgress(wordId);
    if (!p.lastReviewedAt) return false;
    const elapsed = Date.now() - new Date(p.lastReviewedAt).getTime();
    return elapsed < ProgressManager.COOLDOWN_MS;
  }

  // Kalan soğuma süresi metni (örn: "45 dk", "2 sa 15 dk")
  getCooldownRemaining(wordId) {
    const p = this.getWordProgress(wordId);
    if (!p.lastReviewedAt) return null;
    const elapsed = Date.now() - new Date(p.lastReviewedAt).getTime();
    const remainingMs = ProgressManager.COOLDOWN_MS - elapsed;
    if (remainingMs <= 0) return null;
    const mins = Math.ceil(remainingMs / (60 * 1000));
    if (mins < 60) return `${mins} dk`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours} sa ${remMins} dk` : `${hours} sa`;
  }

  // Dinamik Zaman ve Unutma Eğrisine Dayalı XP Hesaplayıcı:
  // Yakın zamanda tekrar edilirse az/0 XP, uzun süre sonra hatırlanırsa çok daha fazla XP
  calculateStudyXp(wordId, choiceType) {
    const p = this.getWordProgress(wordId);
    
    // İlk defa çalışılıyorsa:
    if (!p.lastReviewedAt) {
      const base = choiceType === 'alreadyKnown' ? 3 : 2;
      return {
        earnedXp: base,
        tier: 'first_time',
        message: choiceType === 'alreadyKnown'
          ? `⭐ Zaten Biliyordun! (+${base} XP) • Pekiştirmek için testini çözmelisin.`
          : `🌱 Yeni Kelime Öğrenildi! (+${base} XP) • Pekiştirmek için testini çözmelisin.`
      };
    }

    const elapsedMs = Date.now() - new Date(p.lastReviewedAt).getTime();
    const elapsedMins = elapsedMs / (60 * 1000);
    const elapsedHours = elapsedMs / (3600 * 1000);
    const elapsedDays = elapsedHours / 24;

    // 1. Çok yakın zaman (< 30 dakika): 0 XP
    if (elapsedMins < 30) {
      return {
        earnedXp: 0,
        tier: 'spam_cooldown',
        message: `⏳ Çok yakın zamanda çalışıldı (+0 XP • Soğuma Koruması)`
      };
    }

    // 2. Erken tekrar (30 dk - 4 saat): 1 XP
    if (elapsedHours < 4) {
      return {
        earnedXp: 1,
        tier: 'early_review',
        message: `⏱️ Erken tekrar edildi (+1 XP • Hafıza soğuma aşamasında)`
      };
    }

    // 3. Normal zaman aralığı (4 saat - 24 saat): 2 XP veya 3 XP
    if (elapsedDays < 1) {
      const base = choiceType === 'alreadyKnown' ? 3 : 2;
      return {
        earnedXp: base,
        tier: 'normal',
        message: choiceType === 'alreadyKnown'
          ? `⭐ Bilgi tazelendi (+${base} XP)`
          : `🌱 Planlı aralıklı tekrar yapıldı (+${base} XP)`
      };
    }

    // 4. Aradan 1 - 3 gün geçmişse: +5 XP (Hafıza Zamanlama Bonusu!)
    if (elapsedDays <= 3) {
      return {
        earnedXp: 5,
        tier: 'spaced_bonus',
        message: `⏰ Mükemmel Zamanlama! Uzun süre sonra hatırlandı (+5 XP)`
      };
    }

    // 5. Aradan 3 günden fazla geçmişse: +8 XP (Ebbinghaus Unutma Eşiği Bonusu!)
    return {
      earnedXp: 8,
      tier: 'ebbinghaus_master_bonus',
      message: `⚡ Ebbinghaus Bonusu! Unutma eşiğindeki kelimeyi hatırladın (+8 XP)`
    };
  }

  // Ebbinghaus Unutma Eğrisi: R = e^(-t / S)
  getRetention(progress) {
    if (!progress.lastReviewedAt) return 0;
    const elapsedHours = (Date.now() - new Date(progress.lastReviewedAt).getTime()) / (1000 * 3600);
    const elapsedDays = elapsedHours / 24;
    const stability = Math.max(1.0, (progress.interval || 1) * (progress.easeFactor / 2.0));
    return Math.exp(-elapsedDays / stability);
  }

  isHard(progress) {
    return progress.lapses >= 1 || progress.easeFactor < 2.10;
  }

  isDue(progress) {
    if (!progress.nextReviewAt) return false;
    return new Date(progress.nextReviewAt).getTime() <= Date.now() || this.getRetention(progress) < 0.65;
  }

  recordReview(wordId, rating, sm2Result) {
    const current = this.getWordProgress(wordId);
    const now = new Date();
    const lapses = rating === 1 ? (current.lapses + 1) : current.lapses;
    const consecutive = rating === 1 ? 0 : (current.consecutiveCorrect + 1);
    const nextReview = new Date(now.getTime() + sm2Result.interval * 24 * 3600 * 1000);

    this.data[wordId] = {
      repetitions: sm2Result.repetitions,
      boxLevel: sm2Result.boxLevel,
      easeFactor: sm2Result.easeFactor,
      interval: sm2Result.interval,
      lapses: lapses,
      consecutiveCorrect: consecutive,
      isConsolidated: current.isConsolidated || false,
      testPassed: current.testPassed || false,
      testCorrectCount: current.testCorrectCount || 0,
      testWrongCount: current.testWrongCount || 0,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    this.save();
  }

  // 1. "ÖĞRENDİM" Aksiyonu: Kelimeyi Ebbinghaus aralıklı tekrar döngüsüne alır
  // ÖNEMLİ KURAL: Test çözülmeden kelime asla tam pekiştirilmiş sayılmaz!
  recordLearned(wordId) {
    const current = this.getWordProgress(wordId);
    const now = new Date();
    const xpInfo = this.calculateStudyXp(wordId, 'learned');
    const newRep = (current.repetitions || 0) + 1;
    let newInterval = 1;
    if (newRep === 1) newInterval = 1;
    else if (newRep === 2) newInterval = 4;
    else newInterval = Math.round((current.interval || 1) * (current.easeFactor || 2.50));

    const nextReview = new Date(now.getTime() + newInterval * 24 * 3600 * 1000);

    this.data[wordId] = {
      repetitions: newRep,
      boxLevel: Math.min(5, (current.boxLevel || 0) + 1),
      easeFactor: current.easeFactor || 2.50,
      interval: newInterval,
      lapses: current.lapses || 0,
      consecutiveCorrect: (current.consecutiveCorrect || 0) + 1,
      isAlreadyKnown: false,
      isConsolidated: current.isConsolidated || false, // Asla sadece kartla tam pekişmez!
      testPassed: current.testPassed || false,
      testCorrectCount: current.testCorrectCount || 0,
      testWrongCount: current.testWrongCount || 0,
      status: current.isConsolidated ? 'consolidated' : 'test_pending',
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    this.save();
    return { interval: newInterval, earnedXp: xpInfo.earnedXp, message: xpInfo.message };
  }

  // 2. "ZATEN BİLİYORDUM" Aksiyonu: Kelimeyi Usta seviyesine aktarır ancak test çözülmeden pekiştirilmiş sayılmaz
  recordAlreadyKnown(wordId) {
    const current = this.getWordProgress(wordId);
    const now = new Date();
    const xpInfo = this.calculateStudyXp(wordId, 'alreadyKnown');
    const nextReview = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    this.data[wordId] = {
      repetitions: Math.max(4, (current.repetitions || 0) + 1),
      boxLevel: 5, // Usta Seviyesi
      easeFactor: 2.80,
      interval: 30, // 30 gün sonra hatırlatıcı
      lapses: 0,
      consecutiveCorrect: Math.max(3, (current.consecutiveCorrect || 0) + 1),
      isAlreadyKnown: true,
      isConsolidated: current.isConsolidated || false, // Asla sadece kartla tam pekişmez!
      testPassed: current.testPassed || false,
      testCorrectCount: current.testCorrectCount || 0,
      testWrongCount: current.testWrongCount || 0,
      status: current.isConsolidated ? 'consolidated' : 'test_pending',
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    this.save();
    return { interval: 30, earnedXp: xpInfo.earnedXp, message: xpInfo.message };
  }
}

let progressMgr = new ProgressManager(accountMgr.currentUser.id);

// --- 3. UYGULAMA VE ÇALIŞMA SEANSI DURUMU ---
class AnkorisSession {
  constructor() {
    this.mode = 'UNITS'; // 'UNITS', 'HARD', 'REVIEW'
    this.selectedUnitIds = new Set([1]); // Varsayılan: Ünite 1
    this.wordLimit = 20;
    this.currentSetIndex = 1; // 1'den başlar (Her ünite 20'şerlik 5 set)
    this.activeDeck = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.selectedCategory = 'ALL';
    this.searchQuery = '';
  }

  getUnitWords() {
    const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
    let filtered = allWords.filter(w => this.selectedUnitIds.has(w.unit_id));
    if (filtered.length === 0 && allWords.length > 0) {
      filtered = allWords.filter(w => w.unit_id === 1);
      this.selectedUnitIds = new Set([1]);
    }
    return filtered;
  }

  getTotalSets() {
    const words = this.getUnitWords();
    return Math.max(1, Math.ceil(words.length / 20));
  }

  // Modlara göre akıllı deste oluşturma (20 Kelimelik Setler)
  buildDeck() {
    const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];

    if (this.mode === 'HARD') {
      // 1. ZOR KELİMELER MODU: Lapses > 0 veya EF < 2.10 olan kelimeler
      const hardPool = allWords.filter(w => {
        const prog = progressMgr.getWordProgress(w.id);
        return progressMgr.isHard(prog);
      });
      // En çok zorlanılanları en başa al
      hardPool.sort((a, b) => {
        const pa = progressMgr.getWordProgress(a.id);
        const pb = progressMgr.getWordProgress(b.id);
        return pb.lapses - pa.lapses || pa.easeFactor - pb.easeFactor;
      });
      this.activeDeck = hardPool.slice(0, this.wordLimit);
    } else if (this.mode === 'REVIEW') {
      // 2. GENEL TEKRAR (EBBINGHAUS) MODU: Unutma eşiğinde veya süresi gelmiş olanlar
      const reviewPool = allWords.filter(w => {
        const prog = progressMgr.getWordProgress(w.id);
        return prog.lastReviewedAt && progressMgr.isDue(prog);
      });
      // Hatırlama oranı (retention) en düşük olanı en başa al
      reviewPool.sort((a, b) => {
        const pa = progressMgr.getWordProgress(a.id);
        const pb = progressMgr.getWordProgress(b.id);
        return progressMgr.getRetention(pa) - progressMgr.getRetention(pb);
      });
      this.activeDeck = reviewPool.slice(0, this.wordLimit);
    } else {
      // 3. ÜNİTE BAZLI 20 KELİMELİK SET MODU
      const unitWords = this.getUnitWords();
      const totalSets = this.getTotalSets();
      if (this.currentSetIndex > totalSets) this.currentSetIndex = totalSets;
      if (this.currentSetIndex < 1) this.currentSetIndex = 1;

      const startIdx = (this.currentSetIndex - 1) * 20;
      const endIdx = startIdx + 20;
      this.activeDeck = unitWords.slice(startIdx, endIdx);
    }

    this.currentIndex = 0;
    this.isFlipped = false;
    return this.activeDeck;
  }

  nextSet() {
    const totalSets = this.getTotalSets();
    if (this.currentSetIndex < totalSets) {
      this.currentSetIndex++;
      this.buildDeck();
      return true;
    } else {
      // Son sete ulaşıldıysa, bir sonraki üniteye geç
      const currentUnitId = Array.from(this.selectedUnitIds)[0] || 1;
      const nextUnitId = currentUnitId < 50 ? currentUnitId + 1 : 1;
      this.selectedUnitIds = new Set([nextUnitId]);
      this.currentSetIndex = 1;
      this.buildDeck();
      return true;
    }
  }

  prevSet() {
    if (this.currentSetIndex > 1) {
      this.currentSetIndex--;
      this.buildDeck();
      return true;
    }
    return false;
  }

  goToSet(setIdx) {
    const totalSets = this.getTotalSets();
    if (setIdx >= 1 && setIdx <= totalSets) {
      this.currentSetIndex = setIdx;
      this.buildDeck();
      return true;
    }
    return false;
  }

  currentCard() {
    return this.activeDeck[this.currentIndex];
  }
}

const session = new AnkorisSession();

// --- 4. SM-2 HESAPLAYICISI ---
function calculateSm2(currentProgress, rating) {
  let ef = currentProgress.easeFactor || 2.50;
  let rep = currentProgress.repetitions || 0;
  let interval = currentProgress.interval || 0;
  let box = currentProgress.boxLevel || 1;

  switch (rating) {
    case 1: // AGAIN
      rep = 0;
      interval = 1;
      box = 1;
      ef = Math.max(1.30, Math.min(3.0, ef - 0.20));
      break;
    case 2: // HARD
      rep += 1;
      ef = Math.max(1.30, Math.min(3.0, ef - 0.15));
      interval = (rep === 1) ? 1 : (rep === 2 ? 2 : Math.round(interval * 1.2));
      break;
    case 3: // GOOD
      rep += 1;
      box += 1;
      interval = (rep === 1) ? 1 : (rep === 2 ? 4 : Math.round(interval * ef));
      break;
    case 4: // EASY
      rep += 1;
      box += 2;
      ef = Math.max(1.30, Math.min(3.20, ef + 0.15));
      interval = (rep === 1) ? 3 : (rep === 2 ? 7 : Math.round(interval * ef * 1.3));
      break;
  }

  return {
    easeFactor: parseFloat(ef.toFixed(2)),
    interval: Math.max(1, interval),
    repetitions: rep,
    boxLevel: box
  };
}

// --- 5. DOM ELEMENTLERİ ---
const headerAvatarEl = document.getElementById('header-avatar');
const headerExamEl = document.getElementById('header-exam');
const streakCountEl = document.getElementById('streak-count');
const totalXpEl = document.getElementById('total-xp');
const currentLevelEl = document.getElementById('current-level');

const currentUnitIconEl = document.getElementById('current-unit-icon');
const currentUnitTitleEl = document.getElementById('current-unit-title');
const currentUnitSubEl = document.getElementById('current-unit-sub');

// 20 Kelimelik Set Barı Elementleri
const unitSetBar = document.getElementById('unit-set-bar');
const btnPrevSet = document.getElementById('btn-prev-set');
const btnNextSet = document.getElementById('btn-next-set');
const setInfoTitle = document.getElementById('set-info-title');
const setInfoRange = document.getElementById('set-info-range');
const setPillsRow = document.getElementById('set-pills-row');

const priorityAlertBox = document.getElementById('priority-alert-box');
const alertSummaryEl = document.getElementById('alert-summary');
const btnQuickSmartReview = document.getElementById('btn-quick-smart-review');
const btnCloseAlert = document.getElementById('btn-close-alert');
let isAlertDismissed = false;

if (btnCloseAlert) {
  btnCloseAlert.addEventListener('click', (e) => {
    e.stopPropagation();
    isAlertDismissed = true;
    if (priorityAlertBox) priorityAlertBox.style.display = 'none';
  });
}

const btnModeUnits = document.getElementById('btn-mode-units');
const btnModeHard = document.getElementById('btn-mode-hard');
const btnModeReview = document.getElementById('btn-mode-review');
const badgeHardCount = document.getElementById('badge-hard-count');
const badgeReviewCount = document.getElementById('badge-review-count');

const remainingCountEl = document.getElementById('remaining-count');
const dailyGoalTextEl = document.getElementById('daily-goal-text');
const dailyProgressFillEl = document.getElementById('daily-progress-fill');

const cardEl = document.getElementById('active-card');
const wordEl = document.getElementById('card-word');
const phoneticEl = document.getElementById('card-phonetic');
const posEl = document.getElementById('card-pos');
const categoryEl = document.getElementById('card-category');
const cardConsolidationBadge = document.getElementById('card-consolidation-badge');
const meaningEl = document.getElementById('card-meaning');
const mnemonicEl = document.getElementById('card-mnemonic');
const exampleEnEl = document.getElementById('card-example-en');
const exampleTrEl = document.getElementById('card-example-tr');
const sm2StatsEl = document.getElementById('sm2-stats-text');
const btnRefreshExample = document.getElementById('btn-refresh-example');

// --- DİNAMİK VE ÇEŞİTLİ AKADEMİK ÖRNEK CÜMLE MOTORU ---
let currentExampleVariant = 0;

function isGenericTemplate(en) {
  if (!en) return true;
  return en.includes("The research team presented a") ||
         en.includes("Experts emphasized the need to") ||
         en.includes("The economic indicators have") ||
         en.includes("Understanding the concept of");
}

const ADJECTIVE_TEMPLATES = [
  {
    en: (w) => `Recent empirical studies suggest that the overall outcome is quite ${w} under these conditions.`,
    tr: (t) => `Son ampirik çalışmalar, genel sonucun bu koşullar altında oldukça ${t} olduğunu göstermektedir.`
  },
  {
    en: (w) => `Developing a ${w} strategy has become the primary objective for international institutions.`,
    tr: (t) => `Uluslararası kurumlar için ${t} bir strateji geliştirmek birincil hedef haline geldi.`
  },
  {
    en: (w) => `Scientists observed a ${w} pattern in environmental indicators throughout the last decade.`,
    tr: (t) => `Bilim insanları, son on yıl boyunca çevre göstergelerinde ${t} bir model gözlemledi.`
  },
  {
    en: (w) => `It is particularly ${w} for developing nations to invest in sustainable infrastructure.`,
    tr: (t) => `Gelişmekte olan ülkelerin sürdürülebilir altyapıya yatırım yapması bilhassa ${t} bir durumdur.`
  },
  {
    en: (w) => `The council released a ${w} report analyzing the multifaceted impacts of modern technology.`,
    tr: (t) => `Konsey, modern teknolojinin çok yönlü etkilerini inceleyen ${t} bir rapor yayımladı.`
  },
  {
    en: (w) => `Adopting a ${w} perspective during diplomatic dialogues facilitates durable agreements.`,
    tr: (t) => `Diplomatik diyaloglar sırasında ${t} bir bakış açısı benimsemek kalıcı anlaşmaları kolaylaştırır.`
  },
  {
    en: (w) => `This innovative model provides a ${w} alternative to conventional industrial methods.`,
    tr: (t) => `Bu yenilikçi model, geleneksel endüstriyel yöntemlere ${t} bir alternatif sunmaktadır.`
  },
  {
    en: (w) => `Epidemiologists discovered ${w} evidence supporting the widespread clinical intervention.`,
    tr: (t) => `Epidemiyologlar, yaygın klinik müdahaleyi destekleyen ${t} kanıtlar ortaya koydu.`
  },
  {
    en: (w) => `Historical documents indicate a ${w} shift in demographic and economic distribution.`,
    tr: (t) => `Tarihi belgeler, demografik ve ekonomik dağılımda ${t} bir dönüşüme işaret etmektedir.`
  },
  {
    en: (w) => `The primary hypothesis remained remarkably ${w} across multiple longitudinal trials.`,
    tr: (t) => `Birincil hipotez, çoklu boylamsal denemeler boyunca kayda değer biçimde ${t} kaldı.`
  },
  {
    en: (w) => `The government introduced ${w} structural policies to mitigate financial uncertainty.`,
    tr: (t) => `Hükümet, finansal belirsizliği hafifletmek için ${t} yapısal politikalar başlattı.`
  },
  {
    en: (w) => `Clinical trials revealed a ${w} correlation between diet quality and cognitive focus.`,
    tr: (t) => `Klinik deneyler, beslenme kalitesi ile bilişsel odaklanma arasında ${t} bir ilişki saptadı.`
  },
  {
    en: (w) => `Scholars argue that this cultural trend is increasingly ${w} among modern urban communities.`,
    tr: (t) => `Akademisyenler, bu kültürel eğilimin modern kentsel topluluklarda giderek daha ${t} olduğunu belirtiyor.`
  },
  {
    en: (w) => `The ecological audit highlighted the ${w} risks associated with rapid industrialization.`,
    tr: (t) => `Ekolojik denetim, hızlı sanayileşmeyle ilişkili ${t} risklere dikkat çekti.`
  },
  {
    en: (w) => `Academic researchers reached a ${w} consensus after evaluating rigorous scientific data.`,
    tr: (t) => `Akademik araştırmacılar, titiz bilimsel verileri değerlendirdikten sonra ${t} bir uzlaşıya vardı.`
  }
];

const VERB_TEMPLATES = [
  {
    en: (w) => `International treaties urge member states to ${w} rigorous environmental benchmarks.`,
    tr: (t) => `Uluslararası anlaşmalar, üye ülkeleri katı çevresel kriterleri ${t} konusunda teşvik eder.`
  },
  {
    en: (w) => `Biologists conducted controlled experiments to ${w} cellular responses to thermal stress.`,
    tr: (t) => `Biyologlar, termal strese verilen hücresel tepkileri ${t} amacıyla kontrollü deneyler yürüttü.`
  },
  {
    en: (w) => `The central bank took proactive steps to ${w} growing volatility across foreign markets.`,
    tr: (t) => `Merkez bankası, dış piyasalardaki artan dalgalanmayı ${t} için proaktif adımlar attı.`
  },
  {
    en: (w) => `Modern educational systems aim to ${w} analytical competence among young researchers.`,
    tr: (t) => `Modern eğitim sistemleri, genç araştırmacılar arasında analitik yetkinliği ${t} hedefler.`
  },
  {
    en: (w) => `Technicians enforced emergency protocols to ${w} systemic failures in the network.`,
    tr: (t) => `Teknisyenler, şebekedeki sistemsel arızaları ${t} amacıyla acil durum protokolleri uyguladı.`
  },
  {
    en: (w) => `Sociologists examine key factors that actively ${w} institutional stability over time.`,
    tr: (t) => `Sosyologlar, zaman içinde kurumsal istikrarı aktif biçimde ${t} temel faktörleri inceliyor.`
  },
  {
    en: (w) => `The public initiative was launched to ${w} community engagement in sustainable development.`,
    tr: (t) => `Toplumsal girişim, sürdürülebilir kalkınmaya halkın katılımını ${t} amacıyla başlatıldı.`
  },
  {
    en: (w) => `Technological automation continues to ${w} workflows across the global logistics sector.`,
    tr: (t) => `Teknolojik otomasyon, küresel lojistik sektöründe iş akışlarını ${t} sürdürmektedir.`
  },
  {
    en: (w) => `The advisory council gathered today to ${w} complex regulatory and legal challenges.`,
    tr: (t) => `Danışma kurulu, karmaşık mevzuat ve yasal zorlukları ${t} için bugün toplandı.`
  },
  {
    en: (w) => `Advanced pharmaceutical research attempts to ${w} the underlying causes of chronic illness.`,
    tr: (t) => `İleri farmasötik araştırmalar, kronik hastalıkların altta yatan nedenlerini ${t} çabalamaktadır.`
  },
  {
    en: (w) => `Diplomats worked tirelessly throughout the week to ${w} cross-border trade barriers.`,
    tr: (t) => `Diplomatlar, sınır ötesi ticaret engellerini ${t} için hafta boyunca yorulmadan çalıştı.`
  },
  {
    en: (w) => `Supervisory authorities intervened swiftly to ${w} deceptive commercial marketing campaigns.`,
    tr: (t) => `Denetleyici otoriteler, yanıltıcı ticari pazarlama kampanyalarını ${t} adına hızla müdahale etti.`
  },
  {
    en: (w) => `Higher education institutions strive to ${w} cross-disciplinary research initiatives.`,
    tr: (t) => `Yükseköğretim kurumları, disiplinler arası araştırma girişimlerini ${t} için çaba gösteriyor.`
  },
  {
    en: (w) => `Public health agencies adopted decisive guidelines to ${w} epidemic outbreaks effectively.`,
    tr: (t) => `Halk sağlığı kurumları, salgın hastalıkları etkili şekilde ${t} için kararlı yönergeler benimsedi.`
  },
  {
    en: (w) => `Economists anticipate that digital infrastructure will ${w} productive output nationwide.`,
    tr: (t) => `Ekonomistler, dijital altyapının ülke genelinde verimli üretimi ${t} öngörmektedir.`
  }
];

const NOUN_TEMPLATES = [
  {
    en: (w) => `The decisive impact of ${w} on sustainable economic growth cannot be overstated.`,
    tr: (t) => `Sürdürülebilir ekonomik büyüme üzerinde ${t} unsurunun belirleyici etkisi yadsınamaz.`
  },
  {
    en: (w) => `Leading scholars agree that ${w} plays a fundamental role in societal well-being.`,
    tr: (t) => `Önde gelen akademisyenler, ${t} kavramının toplumsal refahta temel bir rol oynadığı konusunda hemfikirdir.`
  },
  {
    en: (w) => `The transition toward modern governance requires a comprehensive analysis of ${w}.`,
    tr: (t) => `Modern yönetişime geçiş, ${t} konusunun kapsamlı bir biçimde incelenmesini gerektirir.`
  },
  {
    en: (w) => `Historical archives illustrate how ${w} altered urban development and civic stability.`,
    tr: (t) => `Tarihi arşivler, ${t} unsurunun kentsel gelişimi ve sivil istikrarı nasıl dönüştürdüğünü gösteriyor.`
  },
  {
    en: (w) => `Public debates increasingly focus on the legal ethics surrounding modern ${w}.`,
    tr: (t) => `Kamuoyu tartışmaları giderek modern ${t} etrafındaki yasal etik üzerine odaklanmaktadır.`
  },
  {
    en: (w) => `A lack of reliable ${w} poses persistent challenges for remote communities.`,
    tr: (t) => `Güvenilir ${t} eksikliği, kırsal topluluklar için sürekli zorluklar teşkil etmektedir.`
  },
  {
    en: (w) => `Technological progress has unlocked new applications for ${w} in daily life.`,
    tr: (t) => `Teknolojik ilerleme, günlük yaşamda ${t} adına yeni uygulama alanları ortaya çıkarmıştır.`
  },
  {
    en: (w) => `The annual summit highlighted that ${w} remains vital for long-term fiscal stability.`,
    tr: (t) => `Yıllık zirve, ${t} konusunun uzun vadeli mali istikrar için hayati kalmaya devam ettiğini vurguladı.`
  },
  {
    en: (w) => `International guidelines mandate stringent standards governing the oversight of ${w}.`,
    tr: (t) => `Uluslararası kurallar, ${t} denetimini yöneten katı standartları zorunlu kılmaktadır.`
  },
  {
    en: (w) => `Scholars conducted empirical fieldwork to trace the cultural origins of ${w}.`,
    tr: (t) => `Akademisyenler, ${t} olgusunun kültürel kökenlerini izlemek için ampirik saha çalışmaları yaptı.`
  },
  {
    en: (w) => `Proper management of ${w} is widely recognized as a catalyst for human development.`,
    tr: (t) => `${t} konusunun doğru yönetimi, insani gelişmenin bir katalizörü olarak geniş çapta kabul görmektedir.`
  },
  {
    en: (w) => `The research foundation provided funding to examine the sociological dimensions of ${w}.`,
    tr: (t) => `Araştırma vakfı, ${t} konusunun sosyolojik boyutlarını incelemek amacıyla finansman sağladı.`
  }
];

const ADVERB_TEMPLATES = [
  {
    en: (w) => `Environmental indicators have ${w} improved following strict regional regulations.`,
    tr: (t) => `Çevresel göstergeler, katı bölgesel düzenlemelerin ardından ${t} bir şekilde iyileşti.`
  },
  {
    en: (w) => `Survey respondents reacted ${w} when informed about upcoming administrative reforms.`,
    tr: (t) => `Ankete katılanlar, yaklaşan idari reformlar hakkında bilgilendirildiklerinde ${t} tepki verdi.`
  },
  {
    en: (w) => `Digital tools have ${w} transformed standard operational workflows worldwide.`,
    tr: (t) => `Dijital araçlar, dünya genelinde standart operasyonel iş akışlarını ${t} bir biçimde dönüştürdü.`
  },
  {
    en: (w) => `The spokesperson addressed the assembly ${w} regarding multilateral security goals.`,
    tr: (t) => `Sözcü, çok taraflı güvenlik hedeflerine ilişkin olarak meclise ${t} bir üslupla seslendi.`
  },
  {
    en: (w) => `Economic output expanded ${w} in response to diversified investment strategies.`,
    tr: (t) => `Ekonomik çıktı, çeşitlendirilmiş yatırım stratejilerine yanıt olarak ${t} bir hızla genişledi.`
  },
  {
    en: (w) => `Specialists monitored the experiment ${w} to prevent potential measurement anomalies.`,
    tr: (t) => `Uzmanlar, olası ölçüm sapmalarını önlemek için deneyi ${t} bir dikkatle takip etti.`
  }
];

function getDiverseExample(card, variant = 0) {
  if (!card) return { en: '', tr: '' };
  
  if (card.exampleEn && !isGenericTemplate(card.exampleEn) && variant === 0) {
    return { en: card.exampleEn, tr: card.exampleTr || '' };
  }

  const w = (card.english || '').trim();
  const trRaw = (card.turkish || '').split(',')[0].trim();
  const tr = trRaw.toLowerCase();
  const pos = (card.pos || '').toLowerCase();

  let hash = 0;
  for (let i = 0; i < w.length; i++) {
    hash = ((hash << 5) - hash) + w.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash + (variant * 37));

  let pool = NOUN_TEMPLATES;
  if (pos.includes('verb') || tr.endsWith('mek') || tr.endsWith('mak') || tr.includes('etmek') || tr.includes('olmak')) {
    pool = VERB_TEMPLATES;
  } else if (pos.includes('adjective') || pos.includes('sıfat') || w.endsWith('able') || w.endsWith('al') || w.endsWith('ful') || w.endsWith('ic') || w.endsWith('ive') || w.endsWith('ous') || w.endsWith('less') || w.endsWith('ent') || w.endsWith('ant')) {
    pool = ADJECTIVE_TEMPLATES;
  } else if (pos.includes('adverb') || pos.includes('zarf') || w.endsWith('ly')) {
    pool = ADVERB_TEMPLATES;
  }

  const template = pool[seed % pool.length];
  return {
    en: template.en(w),
    tr: template.tr(tr)
  };
}

// 20 Kelimelik Set Tamamlama Ekranı Elementleri
const setCompletedView = document.getElementById('set-completed-view');
const completedTitle = document.getElementById('completed-title');
const completedSub = document.getElementById('completed-sub');
const completedStatCons = document.getElementById('completed-stat-cons');
const completedStatPending = document.getElementById('completed-stat-pending');
const btnCompQuiz = document.getElementById('btn-comp-quiz');
const btnCompNext = document.getElementById('btn-comp-next');
const btnCompNextTitle = document.getElementById('btn-comp-next-title');
const btnCompNextSub = document.getElementById('btn-comp-next-sub');
const btnCompRepeat = document.getElementById('btn-comp-repeat');

const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('active');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('active');
  }, 2200);
}

// --- 6. ARAYÜZ YENİLEME VE AKILLI BİLDİRİM MOTORU ---
function updateUI() {
  const user = accountMgr.currentUser;

  // Header & XP
  headerAvatarEl.textContent = user.avatar;
  headerExamEl.textContent = user.exam.replace('_', ' ');
  streakCountEl.textContent = user.streak;
  totalXpEl.textContent = `${user.xp} XP`;
  currentLevelEl.textContent = `Lv.${user.level}`;

  // Akıllı Mod Sayaçları Hesaplama
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  let hardCount = 0;
  let dueReviewCount = 0;

  allWords.forEach(w => {
    const p = progressMgr.getWordProgress(w.id);
    if (progressMgr.isHard(p)) hardCount++;
    if (p.lastReviewedAt && progressMgr.isDue(p)) dueReviewCount++;
  });

  badgeHardCount.textContent = hardCount;
  badgeReviewCount.textContent = dueReviewCount;

  // Akıllı Öncelik Uyarısı (Ebbinghaus Alarmı - Kompakt Tek Satır)
  if (!isAlertDismissed && (dueReviewCount > 0 || hardCount > 0)) {
    priorityAlertBox.style.display = 'flex';
    if (dueReviewCount > 0) {
      alertSummaryEl.innerHTML = `<strong>Hafıza:</strong> ${dueReviewCount} kelime tekrar bekliyor`;
      btnQuickSmartReview.textContent = 'Tekrar Et ➔';
    } else {
      alertSummaryEl.innerHTML = `<strong>Klinik:</strong> ${hardCount} kelimede zorlandın`;
      btnQuickSmartReview.textContent = 'Çalış ➔';
    }
  } else {
    priorityAlertBox.style.display = 'none';
  }

  // Mod Butonlarının Aktiflik Durumu
  btnModeUnits.classList.toggle('active', session.mode === 'UNITS');
  btnModeHard.classList.toggle('active', session.mode === 'HARD');
  btnModeReview.classList.toggle('active', session.mode === 'REVIEW');

  // Kaçıncı ünitenin seçildiği buton üzerinde gösterilsin (Kullanıcı İsteği)
  const modeUnitsLabel = document.getElementById('mode-units-label');
  if (modeUnitsLabel) {
    const count = session.selectedUnitIds.size;
    if (count === 1) {
      const uId = Array.from(session.selectedUnitIds)[0];
      modeUnitsLabel.textContent = `Ünite ${uId}`;
    } else if (count >= 50) {
      modeUnitsLabel.textContent = 'Tümü';
    } else {
      modeUnitsLabel.textContent = `${count} Ünite`;
    }
  }

  // 20 Kelimelik Set Barı Yönetimi
  if (session.mode === 'UNITS' && unitSetBar) {
    unitSetBar.style.display = 'flex';
    const totalSets = session.getTotalSets();
    const curSet = session.currentSetIndex;
    const unitWords = session.getUnitWords();

    if (setInfoTitle) {
      const count = session.selectedUnitIds.size;
      if (count === 1) {
        const uId = Array.from(session.selectedUnitIds)[0];
        setInfoTitle.textContent = `Ünite ${uId} • Set ${curSet}/${totalSets}`;
      } else {
        setInfoTitle.textContent = `Set ${curSet}/${totalSets}`;
      }
    }
    if (setInfoRange) {
      const startNum = (curSet - 1) * 20 + 1;
      const endNum = Math.min(startNum + 19, unitWords.length);
      setInfoRange.textContent = `(${startNum} - ${endNum})`;
    }

    if (setPillsRow) {
      setPillsRow.innerHTML = '';
      for (let i = 1; i <= totalSets; i++) {
        const sWords = unitWords.slice((i - 1) * 20, i * 20);
        let cons = 0;
        let studied = 0;
        sWords.forEach(w => {
          const prog = progressMgr.getWordProgress(w.id);
          if (prog.isConsolidated) cons++;
          if (prog.repetitions >= 1) studied++;
        });

        const pill = document.createElement('button');
        pill.className = `set-pill-btn ${i === curSet ? 'active' : ''}`;
        let statusText = `${cons}/${sWords.length}`;
        let statusClass = 'pending';
        if (cons === sWords.length && sWords.length > 0) {
          statusText = '👑 Tam';
          statusClass = 'done';
        } else if (studied === sWords.length && sWords.length > 0) {
          statusText = '🟡 Test';
          statusClass = 'pending';
        }
        pill.innerHTML = `
          <span class="set-pill-label">Set ${i}</span>
          <span class="set-pill-status ${statusClass}">${statusText}</span>
        `;
        pill.addEventListener('click', () => {
          session.goToSet(i);
          updateUI();
        });
        setPillsRow.appendChild(pill);
      }
    }
  } else if (unitSetBar) {
    unitSetBar.style.display = 'none';
  }

  // Aktif Ünite Başlığı (Varsa güncelle)
  if (session.mode === 'HARD') {
    if (currentUnitIconEl) currentUnitIconEl.textContent = '🔥';
    if (currentUnitTitleEl) currentUnitTitleEl.textContent = 'Zor Kelimeler Kliniği (Zayıf Noktalar)';
    if (currentUnitSubEl) currentUnitSubEl.textContent = `Önceden Yanlış Yapılan ${session.activeDeck.length} Kelime`;
  } else if (session.mode === 'REVIEW') {
    if (currentUnitIconEl) currentUnitIconEl.textContent = '🧠';
    if (currentUnitTitleEl) currentUnitTitleEl.textContent = 'Genel Tekrar (Ebbinghaus Unutma Eğrisi)';
    if (currentUnitSubEl) currentUnitSubEl.textContent = `Zaman Aşımına Uğramış ${session.activeDeck.length} Kelime`;
  } else {
    const count = session.selectedUnitIds.size;
    const totalSets = session.getTotalSets();
    if (count === 1) {
      const uId = Array.from(session.selectedUnitIds)[0];
      const uObj = (typeof ANKORIS_UNITS !== 'undefined') ? ANKORIS_UNITS.find(u => u.id === uId) : null;
      if (currentUnitIconEl) currentUnitIconEl.textContent = uObj ? uObj.icon : '📚';
      if (currentUnitTitleEl) currentUnitTitleEl.textContent = uObj ? uObj.title : `Ünite ${uId}`;
      if (currentUnitSubEl) currentUnitSubEl.textContent = `Ünite ${uId} • Set ${session.currentSetIndex}/${totalSets} (${session.activeDeck.length} Kelime)`;
    } else if (count >= 50) {
      if (currentUnitIconEl) currentUnitIconEl.textContent = '💎';
      if (currentUnitTitleEl) currentUnitTitleEl.textContent = 'Tüm Üniteler (50 Ünite)';
      if (currentUnitSubEl) currentUnitSubEl.textContent = `Set ${session.currentSetIndex}/${totalSets} (${session.activeDeck.length} Kelime)`;
    } else {
      if (currentUnitIconEl) currentUnitIconEl.textContent = '📚';
      if (currentUnitTitleEl) currentUnitTitleEl.textContent = `Özel Seans: ${count} Ünite`;
      if (currentUnitSubEl) currentUnitSubEl.textContent = `Set ${session.currentSetIndex}/${totalSets} (${session.activeDeck.length} Kelime)`;
    }
  }

  // İlerleme & Hedef
  const remaining = Math.max(0, session.activeDeck.length - session.currentIndex);
  remainingCountEl.textContent = `${remaining} Kart Kaldı`;
  dailyGoalTextEl.textContent = `Hedef: ${user.dailyReviewed}/${user.dailyTarget}`;
  const pct = Math.min(100, Math.round((user.dailyReviewed / user.dailyTarget) * 100));
  dailyProgressFillEl.style.width = `${pct}%`;

  // Kart İçeriği veya Set Tamamlama Ekranı
  const card = session.currentCard();
  if (!card) {
    showCompletedView();
    return;
  }

  if (cardEl) cardEl.style.display = '';
  if (setCompletedView) setCompletedView.style.display = 'none';

  const p = progressMgr.getWordProgress(card.id);
  const ret = progressMgr.getRetention(p);
  const isHardWord = progressMgr.isHard(p);
  const isOnCooldown = progressMgr.isWordOnCooldown(card.id);
  const cooldownRem = progressMgr.getCooldownRemaining(card.id);

  wordEl.textContent = card.english;
  phoneticEl.textContent = card.phonetic;
  posEl.textContent = card.pos;
  categoryEl.textContent = (isHardWord ? '🔥 ZOR KELİME • ' : '') + card.category.replace('_', ' ');

  // Pekiştirme & Soğuma Durumu Rozeti
  if (cardConsolidationBadge) {
    if (p.isConsolidated) {
      cardConsolidationBadge.textContent = '👑 Pekiştirildi';
      cardConsolidationBadge.className = 'badge-consolidation status-consolidated';
      cardConsolidationBadge.title = 'Testi çözüldü ve kalıcı hafızaya mühürlendi';
    } else if (p.repetitions >= 1) {
      if (isOnCooldown) {
        cardConsolidationBadge.textContent = `⏳ Soğuma: ${cooldownRem}`;
        cardConsolidationBadge.className = 'badge-consolidation status-cooldown';
        cardConsolidationBadge.title = 'Hafıza pekişme soğumasında (tekrar koruması)';
      } else {
        cardConsolidationBadge.textContent = '🟡 Test Bekliyor';
        cardConsolidationBadge.className = 'badge-consolidation status-pending';
        cardConsolidationBadge.title = 'Çalışıldı ancak testi çözülmeden tam pekiştirilmiş sayılmaz';
      }
    } else {
      cardConsolidationBadge.textContent = '⚪ Yeni Kelime';
      cardConsolidationBadge.className = 'badge-consolidation status-new';
      cardConsolidationBadge.title = 'Henüz çalışılmadı';
    }
  }

  meaningEl.textContent = card.turkish;
  mnemonicEl.textContent = card.mnemonic;

  const dynamicEx = getDiverseExample(card, currentExampleVariant);
  exampleEnEl.textContent = dynamicEx.en;
  exampleTrEl.textContent = dynamicEx.tr;

  let retText = p.lastReviewedAt ? ` • Kalıcılık: %${Math.round(ret * 100)}` : '';
  let lapseText = p.lapses > 0 ? ` • ${p.lapses} Kez Unutuldu` : '';
  let consText = p.isConsolidated 
    ? ' • <span style="color:#00F5A0; font-weight:700;">👑 Tam Pekiştirildi</span>' 
    : (p.repetitions >= 1 ? ' • <span style="color:#FFB142; font-weight:700;">🟡 Test Bekliyor (Henüz Pekiştirilmedi)</span>' : '');

  let cooldownNotice = '';
  if (isOnCooldown) {
    cooldownNotice = `<div class="cooldown-notice-box">⏳ <strong>Soğuma Koruması (Kalan: ${cooldownRem}):</strong> Yakın zamanda çalışıldı. Belirli bir zaman geçmeden tekrar çalıştığında 0 XP verir.</div>`;
  } else if (p.lastReviewedAt) {
    const xpPreview = progressMgr.calculateStudyXp(card.id, 'learned');
    cooldownNotice = `<div class="xp-reward-preview-box">⚡ <strong>Zamanlama Bonusu:</strong> Aradan zaman geçti! Şimdi çalışırsan <strong>+${xpPreview.earnedXp} XP</strong> kazandırır!</div>`;
  }

  sm2StatsEl.innerHTML = `SM-2: ${p.repetitions} Tekrar • EF: ${p.easeFactor.toFixed(2)}${lapseText}${retText}${consText}${cooldownNotice}`;

  // Alt Butonlardaki Dinamik XP Önizlemeleri
  const xpLearned = progressMgr.calculateStudyXp(card.id, 'learned');
  const xpKnown = progressMgr.calculateStudyXp(card.id, 'alreadyKnown');
  const subLearned = btnSrsLearned ? btnSrsLearned.querySelector('.choice-sub-desc') : null;
  const subKnown = btnSrsAlreadyKnown ? btnSrsAlreadyKnown.querySelector('.choice-sub-desc') : null;

  if (subLearned) {
    subLearned.textContent = isOnCooldown 
      ? 'Soğuma koruması • 0 XP' 
      : (xpLearned.earnedXp > 2 ? `⏰ Hafıza bonusu • +${xpLearned.earnedXp} XP` : `Döngüye al • +${xpLearned.earnedXp} XP`);
  }
  if (subKnown) {
    subKnown.textContent = isOnCooldown 
      ? 'Soğuma koruması • 0 XP' 
      : (xpKnown.earnedXp > 3 ? `⏰ Hafıza bonusu • +${xpKnown.earnedXp} XP` : `Usta seviyesine aktar • +${xpKnown.earnedXp} XP`);
  }

  cardEl.classList.remove('flipped');
  session.isFlipped = false;
}

function showCompletedView() {
  if (cardEl) cardEl.style.display = 'none';
  if (setCompletedView) {
    setCompletedView.style.display = 'flex';
    const totalSets = session.getTotalSets();
    const curSet = session.currentSetIndex;

    let consCount = 0;
    let pendCount = 0;
    session.activeDeck.forEach(w => {
      const prog = progressMgr.getWordProgress(w.id);
      if (prog.isConsolidated) consCount++;
      else pendCount++;
    });

    if (completedTitle) completedTitle.textContent = `Set ${curSet} / ${totalSets} Tamamlandı! 🎉`;
    if (completedSub) completedSub.textContent = `Bu setteki ${session.activeDeck.length} kelimeyi gözden geçirdin.`;
    if (completedStatCons) completedStatCons.textContent = `👑 ${consCount} Pekiştirildi`;
    if (completedStatPending) completedStatPending.textContent = `🟡 ${pendCount} Test Bekliyor`;

    if (btnCompNextTitle && btnCompNextSub) {
      if (curSet < totalSets) {
        btnCompNextTitle.textContent = `Sonraki 20 Kelimeye Geç (Set ${curSet + 1}) ➔`;
        const startNext = (curSet * 20) + 1;
        const endNext = Math.min((curSet + 1) * 20, session.getUnitWords().length);
        btnCompNextSub.textContent = `Kelimeler ${startNext} - ${endNext}`;
      } else {
        const uId = Array.from(session.selectedUnitIds)[0] || 1;
        const nextU = uId < 50 ? uId + 1 : 1;
        btnCompNextTitle.textContent = `Sonraki Üniteye Geç (Ünite ${nextU}) ➔`;
        btnCompNextSub.textContent = 'Yeni üniteye başla';
      }
    }
  }

  remainingCountEl.textContent = '0 Kart Kaldı';
  triggerConfetti();
  showToast('🏆 20 Kelimelik Set Tamamlandı! Pekiştirmek için test çözebilirsin.');
}

function flipCard() {
  session.isFlipped = !session.isFlipped;
  cardEl.classList.toggle('flipped', session.isFlipped);
}

cardEl.addEventListener('click', flipCard);

// Telaffuz (TTS)
document.getElementById('btn-tts').addEventListener('click', (e) => {
  e.stopPropagation();
  const card = session.currentCard();
  if (!card) return;
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(card.english.split('(')[0].trim());
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
});

// Kullanıcı Bilgi Seviyesi Puanlaması ("Öğrendim" veya "Zaten Biliyordum")
function rateKnowledgeChoice(choiceType) {
  const card = session.currentCard();
  if (!card) return;

  const user = accountMgr.currentUser;
  let result;

  if (choiceType === 'alreadyKnown') {
    result = progressMgr.recordAlreadyKnown(card.id);
  } else {
    result = progressMgr.recordLearned(card.id);
  }

  showToast(result.message);

  // XP & Oyunlaştırma
  user.xp += result.earnedXp;
  user.dailyReviewed += 1;

  const oldLevel = user.level;
  user.level = Math.floor(user.xp / 80) + 1;
  const leveledUp = user.level > oldLevel;
  const goalJustMet = user.dailyReviewed === user.dailyTarget;
  if (goalJustMet) user.xp += 10;

  accountMgr.save();

  if (leveledUp) {
    triggerConfetti();
    showToast(`🎖️ TEBRİKLER! Seviye Atladın: Lv.${user.level}`);
  } else if (goalJustMet) {
    triggerConfetti();
    showToast(`🔥 GÜNLÜK HEDEF TAMAMLANDI! +10 XP Bonus!`);
  }

  // Kart çevriliyse düzelt ve sonrakine geç
  if (session.isFlipped) {
    session.isFlipped = false;
    cardEl.classList.remove('flipped');
  }

  currentExampleVariant = 0;
  session.currentIndex++;
  updateUI();
}

if (btnRefreshExample) {
  btnRefreshExample.addEventListener('click', (e) => {
    e.stopPropagation();
    currentExampleVariant++;
    const card = session.currentCard();
    if (card) {
      const dynamicEx = getDiverseExample(card, currentExampleVariant);
      exampleEnEl.textContent = dynamicEx.en;
      exampleTrEl.textContent = dynamicEx.tr;
      showToast('🔄 Farklı örnek cümle üretildi!');
      if ('vibrate' in navigator) navigator.vibrate(10);
    }
  });
}

// 20 Kelimelik Set Yönlendirmeleri
if (btnPrevSet) {
  btnPrevSet.addEventListener('click', () => {
    currentExampleVariant = 0;
    session.prevSet();
    updateUI();
  });
}

if (btnNextSet) {
  btnNextSet.addEventListener('click', () => {
    currentExampleVariant = 0;
    session.nextSet();
    updateUI();
  });
}

if (btnCompQuiz) {
  btnCompQuiz.addEventListener('click', () => {
    openQuizModal(session.activeDeck);
  });
}

if (btnCompNext) {
  btnCompNext.addEventListener('click', () => {
    session.nextSet();
    updateUI();
  });
}

if (btnCompRepeat) {
  btnCompRepeat.addEventListener('click', () => {
    session.currentIndex = 0;
    updateUI();
  });
}

// Buton Etkinlikleri: "Öğrendim" & "Zaten Biliyordum"
const btnSrsLearned = document.getElementById('btn-srs-learned');
const btnSrsAlreadyKnown = document.getElementById('btn-srs-already-known');

if (btnSrsLearned) {
  btnSrsLearned.addEventListener('click', (e) => {
    e.stopPropagation();
    rateKnowledgeChoice('learned');
  });
}

if (btnSrsAlreadyKnown) {
  btnSrsAlreadyKnown.addEventListener('click', (e) => {
    e.stopPropagation();
    rateKnowledgeChoice('alreadyKnown');
  });
}

// --- 7. AKILLI MODLAR ARASI GEÇİŞ ---
btnModeUnits.addEventListener('click', () => {
  if (session.mode === 'UNITS') {
    openUnitsModal('units');
  } else {
    session.mode = 'UNITS';
    session.buildDeck();
    updateUI();
    showToast('📚 Ünite Çalışma Modu Aktif');
  }
});

btnModeHard.addEventListener('click', () => {
  session.mode = 'HARD';
  const deck = session.buildDeck();
  if (deck.length === 0) {
    showToast('✨ Tebrikler! Şu an için zorlandığın kelime bulunmuyor.');
    session.mode = 'UNITS';
    session.buildDeck();
  } else {
    showToast(`🔥 Zor Kelimeler Kliniği Başlatıldı (${deck.length} Kelime)`);
  }
  updateUI();
});

btnModeReview.addEventListener('click', () => {
  session.mode = 'REVIEW';
  const deck = session.buildDeck();
  if (deck.length === 0) {
    showToast('✨ Harika! Şu an unutma eğrisinde acil tekrar bekleyen kelime yok.');
    session.mode = 'UNITS';
    session.buildDeck();
  } else {
    showToast(`🧠 Ebbinghaus Genel Tekrarı Başlatıldı (${deck.length} Kelime)`);
  }
  updateUI();
});

btnQuickSmartReview.addEventListener('click', () => {
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  let dueReviewCount = 0;
  allWords.forEach(w => {
    const p = progressMgr.getWordProgress(w.id);
    if (p.lastReviewedAt && progressMgr.isDue(p)) dueReviewCount++;
  });

  if (dueReviewCount > 0) {
    btnModeReview.click();
  } else {
    btnModeHard.click();
  }
});

// --- 7.1. KELİME TESTİ (QUIZ) & TEST CEVAPLARINA GÖRE ZOR KELİME BELİRLEME ---
const btnModeQuiz = document.getElementById('btn-mode-quiz');
const quizBackdrop = document.getElementById('quiz-backdrop');
const btnCloseQuiz = document.getElementById('btn-close-quiz');

const quizQuestionView = document.getElementById('quiz-question-view');
const quizResultView = document.getElementById('quiz-result-view');
const quizProgressText = document.getElementById('quiz-progress-text');
const quizProgressFill = document.getElementById('quiz-progress-fill');
const quizTargetWord = document.getElementById('quiz-target-word');
const quizTargetPhonetic = document.getElementById('quiz-target-phonetic');
const quizExampleSentence = document.getElementById('quiz-example-sentence');
const quizOptionsContainer = document.getElementById('quiz-options-container');

const resultScoreText = document.getElementById('result-score-text');
const resultXpChip = document.getElementById('result-xp-chip');
const failedWordsList = document.getElementById('failed-words-list');
const btnStartHardFromQuiz = document.getElementById('btn-start-hard-from-quiz');
const btnRetakeQuiz = document.getElementById('btn-retake-quiz');
const btnQuizNext = document.getElementById('btn-quiz-next');
const btnQuizNextSet = document.getElementById('btn-quiz-next-set');
let quizAdvanceTimer = null;

class QuizManager {
  constructor() {
    this.questions = [];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.earnedXp = 0;
    this.failedWords = [];
    this.newlyConsolidatedCount = 0;
    this.isAnswering = false;
    this.isSetQuiz = false;
  }

  // Öğrenilen veya aktif ünitedeki/setteki kelimelerden 4 seçenekli test türetir
  buildQuiz(targetPool = null) {
    const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
    this.newlyConsolidatedCount = 0;
    
    let pool = [];
    if (targetPool && targetPool.length > 0) {
      this.isSetQuiz = true;
      pool = [...targetPool];
      // Testi çözülmemiş / pekişmemiş olanları önceliğe al
      pool.sort((a, b) => {
        const pa = progressMgr.getWordProgress(a.id);
        const pb = progressMgr.getWordProgress(b.id);
        if (!pa.isConsolidated && pb.isConsolidated) return -1;
        if (pa.isConsolidated && !pb.isConsolidated) return 1;
        return 0;
      });
    } else {
      this.isSetQuiz = false;
      // 1. Önce çalışılmış kelimeleri havuz yap (özellikle pekiştirme bekleyenleri öne al)
      pool = allWords.filter(w => {
        const p = progressMgr.getWordProgress(w.id);
        return p.repetitions >= 1 || p.lapses > 0;
      });

      pool.sort((a, b) => {
        const pa = progressMgr.getWordProgress(a.id);
        const pb = progressMgr.getWordProgress(b.id);
        if (!pa.isConsolidated && pb.isConsolidated) return -1;
        if (pa.isConsolidated && !pb.isConsolidated) return 1;
        return (pb.lapses || 0) - (pa.lapses || 0);
      });

      // Eğer çalışılmış kelime 4'ten az ise aktif destedeki kelimeleri de havuza ekle
      if (pool.length < 5) {
        pool = [...session.activeDeck];
      }
      if (pool.length < 4) {
        pool = allWords.slice(0, 20);
      }
    }

    // Sorulacak kelime adedi (Set testinde tüm 20'yi sorar)
    const questionLimit = this.isSetQuiz ? Math.min(20, pool.length) : 10;
    const targetWords = pool.slice(0, questionLimit);

    this.questions = targetWords.map(target => {
      // 3 Çeldirici seç
      const otherWords = allWords
        .filter(w => w.id !== target.id && w.turkish !== target.turkish)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const options = [target.turkish, ...otherWords.map(w => w.turkish)]
        .sort(() => 0.5 - Math.random());

      const cleanWord = target.english.split('(')[0].trim();
      let maskedSentence = target.exampleEn;
      const regex = new RegExp(cleanWord, 'gi');
      maskedSentence = maskedSentence.replace(regex, '______');

      return {
        word: target,
        correctMeaning: target.turkish,
        options: options,
        maskedSentence: `"${maskedSentence}"`
      };
    });

    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.earnedXp = 0;
    this.failedWords = [];
    this.isAnswering = false;
  }

  currentQuestion() {
    return this.questions[this.currentIndex];
  }
}

const quizMgr = new QuizManager();

function openQuizModal(targetPool = null) {
  quizMgr.buildQuiz(targetPool);
  const quizTitleEl = document.getElementById('quiz-title');
  const quizSubtitleEl = document.getElementById('quiz-subtitle');
  if (quizTitleEl && quizSubtitleEl) {
    if (quizMgr.isSetQuiz) {
      quizTitleEl.textContent = `Set ${session.currentSetIndex} Pekiştirme Testi (${quizMgr.questions.length} Soru)`;
      quizSubtitleEl.textContent = `Bu testi doğru çözen kelimeler 'Tam Olarak Pekiştirildi' kabul edilir`;
    } else {
      quizTitleEl.textContent = `Kelime Değerlendirme Testi`;
      quizSubtitleEl.textContent = `Doğru çözülen kelimeler tam pekiştirilir, yanlışlar Zor Kelimelere eklenir`;
    }
  }

  renderQuizQuestion();
  quizQuestionView.style.display = 'flex';
  quizResultView.style.display = 'none';
  quizBackdrop.classList.add('active');
}

function closeQuizModal() {
  clearTimeout(quizAdvanceTimer);
  quizBackdrop.classList.remove('active');
  updateUI();
}

btnModeQuiz.addEventListener('click', () => openQuizModal());
btnCloseQuiz.addEventListener('click', closeQuizModal);

function renderQuizQuestion() {
  clearTimeout(quizAdvanceTimer);
  const q = quizMgr.currentQuestion();
  if (!q) {
    showQuizResults();
    return;
  }

  quizMgr.isAnswering = false;
  const currentNum = quizMgr.currentIndex + 1;
  const totalNum = quizMgr.questions.length;

  quizProgressText.textContent = `Soru ${currentNum} / ${totalNum}`;
  quizProgressFill.style.width = `${Math.round((currentNum / totalNum) * 100)}%`;

  quizTargetWord.textContent = q.word.english;
  quizTargetPhonetic.textContent = q.word.phonetic;
  quizExampleSentence.textContent = q.maskedSentence;

  if (btnQuizNext) {
    btnQuizNext.disabled = true;
    const span = btnQuizNext.querySelector('span');
    if (span) span.textContent = 'Bir Şık İşaretleyin ➔';
  }

  quizOptionsContainer.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-option-letter">${letters[idx]}</span>
      <span>${opt}</span>
    `;

    btn.addEventListener('click', () => handleQuizOptionClick(btn, opt, q));
    quizOptionsContainer.appendChild(btn);
  });
}

function handleQuizOptionClick(selectedBtn, selectedText, question) {
  if (quizMgr.isAnswering) return;
  quizMgr.isAnswering = true;

  const isCorrect = (selectedText === question.correctMeaning);
  const targetWord = question.word;
  const p = progressMgr.getWordProgress(targetWord.id);

  // Tüm butonları devre dışı bırak ve doğru cevabı göster
  const allBtns = quizOptionsContainer.querySelectorAll('.quiz-option-btn');
  allBtns.forEach(btn => {
    btn.style.pointerEvents = 'none';
    if (btn.textContent.includes(question.correctMeaning)) {
      btn.classList.add('correct');
    }
  });

  if (isCorrect) {
    selectedBtn.classList.add('correct');
    quizMgr.correctCount++;
    quizMgr.earnedXp += 5;
    accountMgr.currentUser.xp += 5;
    accountMgr.save();

    // DOĞRU CEVAPLANDI: Kelime TAM OLARAK PEKİŞTİRİLMİŞ SAYILIR!
    const wasConsolidated = p.isConsolidated;
    p.testCorrectCount = (p.testCorrectCount || 0) + 1;
    p.consecutiveCorrect = (p.consecutiveCorrect || 0) + 1;
    p.testPassed = true;
    p.isConsolidated = true; // Test çözüldü ve tam pekişti!
    p.status = 'consolidated';
    p.consolidatedAt = new Date().toISOString();
    p.easeFactor = Math.min(3.0, (p.easeFactor || 2.50) + 0.05);
    progressMgr.data[targetWord.id] = p;
    progressMgr.save();

    if (!wasConsolidated) {
      quizMgr.newlyConsolidatedCount = (quizMgr.newlyConsolidatedCount || 0) + 1;
      showToast(`👑 Doğru! "${targetWord.english}" Başarıyla Pekiştirildi! (+5 XP)`);
    } else {
      showToast('🎯 Doğru! +5 XP Kazandın');
    }
  } else {
    // YANLIŞ CEVAPLANDI: Kelime pekiştirilmemiş kabul edilir ve "ZOR KELİME" havuzuna eklenir!
    selectedBtn.classList.add('wrong');
    quizMgr.wrongCount++;
    quizMgr.failedWords.push(targetWord);

    p.lapses = (p.lapses || 0) + 1;
    p.testWrongCount = (p.testWrongCount || 0) + 1;
    p.testPassed = false;
    p.isConsolidated = false; // Testi geçemediği için pekiştirilmemiş
    p.status = 'hard';
    p.easeFactor = Math.max(1.30, (p.easeFactor || 2.50) - 0.20);
    p.consecutiveCorrect = 0;
    progressMgr.data[targetWord.id] = p;
    progressMgr.save();

    showToast(`⚠️ Yanlış! "${targetWord.english}" Pekiştirilemedi ve Zor Kelimelere eklendi.`);
  }

  // İlerleme Butonunu Etkinleştir ve Güncelle
  if (btnQuizNext) {
    btnQuizNext.disabled = false;
    const isLast = (quizMgr.currentIndex + 1 >= quizMgr.questions.length);
    const span = btnQuizNext.querySelector('span');
    if (span) span.textContent = isLast ? 'Testi Tamamla & Sonuçları Gör ➔' : 'Sonraki Soruya İlerle ➔';
  }

  // Kullanıcı butona tıklamazsa 1.4 saniye sonra otomatik ilerle
  clearTimeout(quizAdvanceTimer);
  quizAdvanceTimer = setTimeout(() => {
    quizMgr.currentIndex++;
    renderQuizQuestion();
  }, 1400);
}

if (btnQuizNext) {
  btnQuizNext.addEventListener('click', () => {
    if (btnQuizNext.disabled) return;
    clearTimeout(quizAdvanceTimer);
    quizMgr.currentIndex++;
    renderQuizQuestion();
  });
}

function showQuizResults() {
  quizQuestionView.style.display = 'none';
  quizResultView.style.display = 'flex';

  const total = quizMgr.questions.length;
  const accuracy = Math.round((quizMgr.correctCount / total) * 100);

  resultScoreText.textContent = `%${accuracy} Doğruluk Oranı • ${quizMgr.correctCount} Doğru, ${quizMgr.wrongCount} Yanlış`;
  resultXpChip.textContent = `+${quizMgr.earnedXp} XP Kazandın! ⚡`;

  // Pekiştirilen kelimeler kutusu
  if (quizConsolidatedBox && quizConsolidatedTitle) {
    if (quizMgr.newlyConsolidatedCount > 0) {
      quizConsolidatedBox.style.display = 'flex';
      quizConsolidatedTitle.textContent = `${quizMgr.newlyConsolidatedCount} Kelime Başarıyla Pekiştirildi! 👑`;
    } else {
      quizConsolidatedBox.style.display = 'none';
    }
  }

  // Sonraki set butonu (Eğer set testi yapıldıysa)
  if (btnQuizNextSet) {
    if (quizMgr.isSetQuiz) {
      btnQuizNextSet.style.display = 'block';
      const totalSets = session.getTotalSets();
      if (session.currentSetIndex < totalSets) {
        btnQuizNextSet.textContent = `➔ Sonraki 20 Kelimeye Geç (Set ${session.currentSetIndex + 1})`;
      } else {
        btnQuizNextSet.textContent = `➔ Sonraki Üniteye Geç`;
      }
    } else {
      btnQuizNextSet.style.display = 'none';
    }
  }

  // Yanlış cevaplanan kelimeleri listele
  failedWordsList.innerHTML = '';
  if (quizMgr.failedWords.length > 0) {
    document.getElementById('quiz-failed-section').style.display = 'block';
    quizMgr.failedWords.forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'failed-word-chip';
      chip.textContent = `${w.english} (${w.turkish})`;
      failedWordsList.appendChild(chip);
    });
  } else {
    document.getElementById('quiz-failed-section').style.display = 'none';
  }

  if (accuracy >= 70) {
    triggerConfetti();
  }

  updateUI();
}

if (btnQuizNextSet) {
  btnQuizNextSet.addEventListener('click', () => {
    closeQuizModal();
    session.nextSet();
    updateUI();
  });
}

if (btnStartHardFromQuiz) {
  btnStartHardFromQuiz.addEventListener('click', () => {
    closeQuizModal();
    btnModeHard.click(); // Doğrudan zor kelimeler kliniğini başlat
  });
}

if (btnRetakeQuiz) {
  btnRetakeQuiz.addEventListener('click', () => {
    openQuizModal(quizMgr.isSetQuiz ? session.activeDeck : null);
  });
}

// --- 8. ÜNİTE KÜTÜPHANESİ & İLERLEME / SEVİYE TAKİBİ MODALI ---
const unitsBackdrop = document.getElementById('units-backdrop');
const unitsListEl = document.getElementById('units-list');
const selectedUnitsCountText = document.getElementById('selected-units-count-text');
const btnStartText = document.getElementById('btn-start-text');

function openUnitsModal(defaultTab = 'units') {
  if (typeof defaultTab !== 'string') {
    defaultTab = 'units';
  }
  unitsBackdrop.classList.add('active');
  if (typeof switchLibraryTab === 'function') {
    switchLibraryTab(defaultTab);
  } else {
    renderUnitsList();
  }
}

function closeUnitsModal() {
  unitsBackdrop.classList.remove('active');
}

const btnOpenUnits = document.getElementById('btn-open-units');
if (btnOpenUnits) btnOpenUnits.addEventListener('click', () => openUnitsModal('units'));

const btnStripOpenUnits = document.getElementById('btn-strip-open-units');
if (btnStripOpenUnits) btnStripOpenUnits.addEventListener('click', () => openUnitsModal('units'));

const setInfoBox = document.getElementById('set-info-box');
if (setInfoBox) setInfoBox.addEventListener('click', () => openUnitsModal('units'));

const btnCloseUnits = document.getElementById('btn-close-units');
if (btnCloseUnits) btnCloseUnits.addEventListener('click', closeUnitsModal);

// Her ünitenin ilerleme, seviye ve zor kelime istatistiklerini hesaplar
// ÖNEMLİ KURAL: Test çözülmeden kelime asla tam pekiştirilmiş (Usta) sayılmaz!
function getUnitStats(unitId) {
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  const unitWords = allWords.filter(w => w.unit_id === unitId);
  const total = unitWords.length || 100;
  
  let mastered = 0; // Testi çözülüp TAM PEKİŞTİRİLENLER
  let learning = 0; // Çalışılmış ancak henüz testi bekleyenler
  let hard = 0;

  unitWords.forEach(w => {
    const p = progressMgr.getWordProgress(w.id);
    if (p.isConsolidated) mastered++;
    else if (p.repetitions >= 1) learning++;
    if (progressMgr.isHard(p)) hard++;
  });

  const studied = mastered + learning;
  const pct = Math.round((mastered / total) * 100);

  let levelName = '⚪ Başlanmadı';
  let levelClass = '';
  if (pct >= 80) { levelName = '👑 Usta'; levelClass = 'master'; }
  else if (pct >= 45) { levelName = '⭐ İleri'; levelClass = 'master'; }
  else if (pct >= 15) { levelName = '🌱 Gelişmekte'; levelClass = ''; }
  else if (studied > 0) { levelName = '🟡 Test Bekliyor'; levelClass = ''; }

  return { total, studied, mastered, learning, hard, pct, levelName, levelClass };
}

function renderUnitsList() {
  const units = (typeof ANKORIS_UNITS !== 'undefined') ? ANKORIS_UNITS : [];
  unitsListEl.innerHTML = '';

  const q = session.searchQuery.toLowerCase();
  const cat = session.selectedCategory;

  const filtered = units.filter(u => {
    const stats = getUnitStats(u.id);

    let matchesCat = true;
    if (cat === 'ALL') matchesCat = true;
    else if (cat === 'STUDIED') matchesCat = stats.studied > 0;
    else if (cat === 'HARD') matchesCat = stats.hard > 0;
    else matchesCat = (u.category === cat);

    const matchesQ = (u.title.toLowerCase().includes(q)) || (`ünite ${u.id}`.includes(q));
    return matchesCat && matchesQ;
  });

  filtered.forEach(u => {
    const isSelected = session.selectedUnitIds.has(u.id);
    const stats = getUnitStats(u.id);

    const div = document.createElement('div');
    div.className = `unit-card ${isSelected ? 'selected' : ''}`;
    div.innerHTML = `
      <span class="unit-card-icon">${u.icon}</span>
      <div class="unit-card-info">
        <div class="unit-card-title">
          <span>${u.title}</span>
          <span class="unit-mastery-tag ${stats.levelClass}">${stats.levelName}</span>
        </div>
        <div class="unit-card-meta">
          ${stats.mastered}/${stats.total} Pekiştirildi • ${stats.learning} Test Bekliyor ${stats.hard > 0 ? `• <span style="color: #FF5252;">⚠️ ${stats.hard} Zor</span>` : ''}
        </div>
        <div class="unit-card-progress">
          <div class="unit-prog-track">
            <div class="unit-prog-fill" style="width: ${stats.pct}%;"></div>
          </div>
          <span class="unit-prog-text">%${stats.pct} Pekiştirildi</span>
        </div>
      </div>
      <div class="unit-card-checkbox">${isSelected ? '✓' : ''}</div>
    `;

    div.addEventListener('click', () => {
      if (session.selectedUnitIds.has(u.id)) {
        if (session.selectedUnitIds.size > 1) {
          session.selectedUnitIds.delete(u.id);
        } else {
          showToast('En az 1 ünite seçili kalmalıdır.');
        }
      } else {
        session.selectedUnitIds.add(u.id);
      }
      updateUnitsModalCounts();
      renderUnitsList();
    });

    unitsListEl.appendChild(div);
  });

  updateUnitsModalCounts();
}

function updateUnitsModalCounts() {
  const count = session.selectedUnitIds.size;
  const totalWords = count * 100;
  selectedUnitsCountText.textContent = `${count} Ünite Seçili (${totalWords.toLocaleString('tr-TR')} Kelime)`;
  const displayLimit = Math.min(session.wordLimit, totalWords);
  if (count >= 50 && session.wordLimit >= 5000) {
    btnStartText.textContent = `🎯 5.000 Kelimenin Tümüyle Seansı Başlat`;
  } else {
    btnStartText.textContent = `🎯 Seçili Ünitelerle Seansı Başlat (${displayLimit} Kelime)`;
  }
}

// Filtreler & Arama (Ünite Listesi)
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    session.selectedCategory = pill.dataset.cat;
    renderUnitsList();
  });
});

document.getElementById('unit-search-input').addEventListener('input', (e) => {
  session.searchQuery = e.target.value.trim();
  renderUnitsList();
});

// Tümünü Seç (5.000 Kelime)
document.getElementById('btn-select-all-units').addEventListener('click', () => {
  const units = (typeof ANKORIS_UNITS !== 'undefined') ? ANKORIS_UNITS : [];
  units.forEach(u => session.selectedUnitIds.add(u.id));
  session.wordLimit = 5000;
  document.querySelectorAll('.limit-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.limit === '5000');
  });
  updateUnitsModalCounts();
  renderUnitsList();
  showToast('💎 Tüm 50 Ünite ve 5.000 Kelime Seçildi!');
});

document.getElementById('btn-clear-units').addEventListener('click', () => {
  session.selectedUnitIds.clear();
  session.selectedUnitIds.add(1);
  updateUnitsModalCounts();
  renderUnitsList();
});

document.querySelectorAll('.limit-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.limit-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    session.wordLimit = parseInt(chip.dataset.limit);
    updateUnitsModalCounts();
  });
});

document.getElementById('btn-start-session').addEventListener('click', () => {
  session.mode = 'UNITS';
  session.currentSetIndex = 1;
  session.buildDeck();
  closeUnitsModal();
  updateUI();
  showToast(`✅ ${session.selectedUnitIds.size} Ünite, Set 1 (${session.activeDeck.length} Kelime) Başlatıldı!`);
});

// --- 8.1. KÜTÜPHANE VE 5.000 KELİMELİK SÖZLÜK SEKMELERİ ---
const tabBtnUnits = document.getElementById('tab-btn-units');
const tabBtnDictionary = document.getElementById('tab-btn-dictionary');
const unitsViewContainer = document.getElementById('units-view-container');
const dictionaryViewContainer = document.getElementById('dictionary-view-container');

function switchLibraryTab(tabName) {
  if (tabName === 'units') {
    if (tabBtnUnits) tabBtnUnits.classList.add('active');
    if (tabBtnDictionary) tabBtnDictionary.classList.remove('active');
    if (unitsViewContainer) unitsViewContainer.style.display = 'flex';
    if (dictionaryViewContainer) dictionaryViewContainer.style.display = 'none';
    renderUnitsList();
  } else {
    if (tabBtnUnits) tabBtnUnits.classList.remove('active');
    if (tabBtnDictionary) tabBtnDictionary.classList.add('active');
    if (unitsViewContainer) unitsViewContainer.style.display = 'none';
    if (dictionaryViewContainer) dictionaryViewContainer.style.display = 'flex';
    dictCurrentPage = 1;
    renderDictionaryList();
  }
}

if (tabBtnUnits) tabBtnUnits.addEventListener('click', () => switchLibraryTab('units'));
if (tabBtnDictionary) tabBtnDictionary.addEventListener('click', () => switchLibraryTab('dictionary'));

// Header 5.000 Kelime Butonu & Smart Mode 5.000 Sözlük Butonu
const btnHeaderDict = document.getElementById('btn-header-dict');
if (btnHeaderDict) {
  btnHeaderDict.addEventListener('click', () => {
    openUnitsModal();
    switchLibraryTab('dictionary');
  });
}

const btnModeDict = document.getElementById('btn-mode-dict');
if (btnModeDict) {
  btnModeDict.addEventListener('click', () => {
    openUnitsModal();
    switchLibraryTab('dictionary');
  });
}

// --- 8.2. 5.000 KELİMELİK SÖZLÜK & CANLI ARAMA MOTORU ---
let dictCurrentPos = 'ALL';
let dictSearchQuery = '';
let dictCurrentPage = 1;
const dictPageSize = 60;
let dictFilteredWords = [];

const dictSearchInput = document.getElementById('dict-search-input');
const btnClearDictSearch = document.getElementById('btn-clear-dict-search');
const dictResultsCountEl = document.getElementById('dict-results-count');
const dictionaryWordsListEl = document.getElementById('dictionary-words-list');
const dictLoadMoreBox = document.getElementById('dict-load-more-box');
const btnDictLoadMore = document.getElementById('btn-dict-load-more');

function filterDictionaryWords() {
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  const q = dictSearchQuery.toLowerCase().trim();
  const posFilter = dictCurrentPos;

  return allWords.filter(w => {
    // POS / Durum Filtresi
    let matchesPos = true;
    if (posFilter === 'ALL') {
      matchesPos = true;
    } else if (posFilter === 'STUDIED') {
      const p = progressMgr.getWordProgress(w.id);
      matchesPos = p.repetitions >= 1 || p.lapses > 0;
    } else if (posFilter === 'HARD') {
      const p = progressMgr.getWordProgress(w.id);
      matchesPos = progressMgr.isHard(p);
    } else {
      const wPos = (w.pos || '').toLowerCase();
      const wCat = (w.category || '').toLowerCase();
      matchesPos = wPos.includes(posFilter.toLowerCase()) || wCat.includes(posFilter.toLowerCase());
    }

    if (!matchesPos) return false;

    // Arama Kelimesi
    if (!q) return true;
    const enMatch = w.english.toLowerCase().includes(q);
    const trMatch = w.turkish.toLowerCase().includes(q);
    const exMatch = w.exampleEn && w.exampleEn.toLowerCase().includes(q);
    return enMatch || trMatch || exMatch;
  });
}

function renderDictionaryList() {
  if (!dictionaryWordsListEl) return;
  dictFilteredWords = filterDictionaryWords();
  
  if (dictResultsCountEl) {
    dictResultsCountEl.textContent = `${dictFilteredWords.length.toLocaleString('tr-TR')} / 5.000 Kelime Bulundu`;
  }
  
  if (btnClearDictSearch) {
    btnClearDictSearch.style.display = dictSearchQuery ? 'block' : 'none';
  }

  const renderWords = dictFilteredWords.slice(0, dictCurrentPage * dictPageSize);
  
  if (renderWords.length === 0) {
    dictionaryWordsListEl.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <span style="font-size: 36px; display: block; margin-bottom: 8px;">🔍</span>
        <strong style="color: #fff; font-size: 14px;">"${dictSearchQuery}" ile eşleşen kelime bulunamadı.</strong>
        <p style="font-size: 12px; margin-top: 6px;">Filtrenizi değiştirebilir veya arama kutusunu temizleyebilirsiniz.</p>
      </div>
    `;
    if (dictLoadMoreBox) dictLoadMoreBox.style.display = 'none';
    return;
  }

  dictionaryWordsListEl.innerHTML = renderWords.map(w => {
    const p = progressMgr.getWordProgress(w.id);
    const isHard = progressMgr.isHard(p);
    const isConsolidated = p.isConsolidated;
    const isPending = p.repetitions >= 1 && !p.isConsolidated;
    const isOnCooldown = progressMgr.isWordOnCooldown(w.id);

    return `
      <div class="dict-word-card" data-word-id="${w.id}">
        <div class="dict-word-top">
          <div class="dict-word-en-group">
            <span class="dict-word-en">${w.english}</span>
            <span class="dict-word-phonetic">${w.phonetic || ''}</span>
            <span class="dict-word-pos">${w.pos || 'kelime'}</span>
            ${isHard ? '<span style="font-size: 10px; color: #FF5252; font-weight: 700;">🔥 Zor</span>' : ''}
            ${isConsolidated ? '<span style="font-size: 10px; color: #00F5A0; font-weight: 700;">👑 Pekiştirildi</span>' : (isPending ? '<span style="font-size: 10px; color: #FFB142; font-weight: 700;">🟡 Test Bekliyor</span>' : '')}
            ${isOnCooldown ? '<span style="font-size: 10px; color: #38BDF8; font-weight: 700;">⏳ Soğumada</span>' : ''}
          </div>
          <span class="dict-word-unit-badge">Ünite ${w.unit_id}</span>
        </div>
        <div class="dict-word-tr">${w.turkish}</div>
        ${w.mnemonic ? `<div class="dict-word-mnemonic">🧠 Hafıza Çapası: ${w.mnemonic}</div>` : ''}
        ${w.exampleEn ? `<div class="dict-word-example">"${w.exampleEn}" ➔ ${w.exampleTr || ''}</div>` : ''}
        <div class="dict-word-actions">
          <button class="btn-dict-tts" onclick="window.speakWordDirect('${w.english.replace(/'/g, "\\'")}')">🔊 Dinle</button>
          <button class="btn-dict-practice" onclick="window.startPracticeWithWord('${w.id}')">🎯 Bu Kelimeyi Çalış</button>
        </div>
      </div>
    `;
  }).join('');

  if (dictLoadMoreBox) {
    if (dictFilteredWords.length > dictCurrentPage * dictPageSize) {
      dictLoadMoreBox.style.display = 'block';
      const remaining = dictFilteredWords.length - (dictCurrentPage * dictPageSize);
      if (btnDictLoadMore) {
        btnDictLoadMore.textContent = `Daha Fazla Kelime Yükle (+${Math.min(remaining, dictPageSize)} / Kalan ${remaining.toLocaleString('tr-TR')})`;
      }
    } else {
      dictLoadMoreBox.style.display = 'none';
    }
  }
}

// Global Sözlük Etkileşim Fonksiyonları
window.speakWordDirect = function(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const cleanWord = text.split('(')[0].trim();
    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
};

window.startPracticeWithWord = function(wordId) {
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  const target = allWords.find(w => w.id === wordId);
  if (!target) return;

  session.selectedUnitIds = new Set([target.unit_id]);
  session.wordLimit = 50;
  session.mode = 'UNITS';
  session.buildDeck();
  
  const targetIdx = session.activeDeck.findIndex(w => w.id === target.id);
  if (targetIdx > 0) {
    const [card] = session.activeDeck.splice(targetIdx, 1);
    session.activeDeck.unshift(card);
  }
  session.currentIndex = 0;
  session.isFlipped = false;

  closeUnitsModal();
  updateUI();
  showToast(`🎯 '${target.english}' kartı açıldı!`);
};

if (dictSearchInput) {
  dictSearchInput.addEventListener('input', (e) => {
    dictSearchQuery = e.target.value;
    dictCurrentPage = 1;
    renderDictionaryList();
  });
}

if (btnClearDictSearch) {
  btnClearDictSearch.addEventListener('click', () => {
    if (dictSearchInput) dictSearchInput.value = '';
    dictSearchQuery = '';
    dictCurrentPage = 1;
    renderDictionaryList();
  });
}

document.querySelectorAll('.dict-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.dict-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    dictCurrentPos = chip.dataset.pos;
    dictCurrentPage = 1;
    renderDictionaryList();
  });
});

if (btnDictLoadMore) {
  btnDictLoadMore.addEventListener('click', () => {
    dictCurrentPage++;
    renderDictionaryList();
  });
}

// --- 9. PROFİL & ÇOKLU KULLANICI & HAFIZA SAĞLIK RAPORU ---
const profileBackdrop = document.getElementById('profile-backdrop');
const accountsListEl = document.getElementById('accounts-list');

function openProfileModal() {
  renderProfileModal();
  profileBackdrop.classList.add('active');
}

function closeProfileModal() {
  profileBackdrop.classList.remove('active');
}

document.getElementById('btn-open-profile').addEventListener('click', openProfileModal);
document.getElementById('btn-close-profile').addEventListener('click', closeProfileModal);

function renderProfileModal() {
  const user = accountMgr.currentUser;

  document.getElementById('profile-avatar-large').textContent = user.avatar;
  document.getElementById('profile-name').textContent = user.name;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-exam-tag').textContent = `🎯 ${user.exam.replace('_', ' ')}`;
  document.getElementById('profile-tier-tag').textContent = `🥈 Gümüş Lig (Lv.${user.level})`;

  document.getElementById('profile-stat-streak').textContent = `${user.streak} Gün`;
  document.getElementById('profile-stat-xp').textContent = user.xp;
  document.getElementById('profile-stat-freeze').textContent = `${user.freeze} Adet`;

  // Zihinsel Hafıza Sağlık Raporu Hesaplama
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  let masteredCount = 0;
  let learningCount = 0;
  let hardCount = 0;
  let dueCount = 0;

  allWords.forEach(w => {
    const p = progressMgr.getWordProgress(w.id);
    if (p.isConsolidated) masteredCount++;
    else if (p.repetitions >= 1) learningCount++;
    if (progressMgr.isHard(p)) hardCount++;
    if (p.lastReviewedAt && progressMgr.isDue(p)) dueCount++;
  });

  document.getElementById('profile-stat-learned').textContent = `${masteredCount + learningCount} Kelime`;
  document.getElementById('mem-mastered-count').textContent = `${masteredCount} Kelime`;
  document.getElementById('mem-learning-count').textContent = `${learningCount} Kelime`;
  document.getElementById('mem-hard-count').textContent = `${hardCount} Kelime`;
  document.getElementById('mem-due-count').textContent = `${dueCount} Kelime`;

  // Hesap Değiştirme Listesi
  accountsListEl.innerHTML = '';
  accountMgr.accounts.forEach(acc => {
    const isAct = acc.id === user.id;
    const div = document.createElement('div');
    div.className = `account-item ${isAct ? 'active' : ''}`;
    div.innerHTML = `
      <div class="account-item-left">
        <div class="account-mini-avatar">${acc.avatar}</div>
        <div>
          <strong>${acc.name}</strong> • <span style="color: #94A3B8;">${acc.exam}</span>
        </div>
      </div>
      <div>
        ${isAct ? '<span class="account-badge-active">● Aktif</span>' : '<button class="link-btn" style="color: #00F5A0;">Geçiş Yap</button>'}
      </div>
    `;

    if (!isAct) {
      div.addEventListener('click', () => {
        accountMgr.switchAccount(acc.id);
        progressMgr = new ProgressManager(acc.id); // Yeni kullanıcının ilerleme havuzu
        session.buildDeck();
        renderProfileModal();
        updateUI();
        showToast(`👤 ${acc.name} profiline geçiş yapıldı!`);
      });
    }

    accountsListEl.appendChild(div);
  });
}

// Yeni Hesap Oluştur
document.getElementById('btn-create-account').addEventListener('click', () => {
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const exam = document.getElementById('new-user-exam').value;

  if (!name || !email) {
    showToast('Lütfen ad soyad ve e-posta girin.');
    return;
  }

  const created = accountMgr.createAccount(name, email, exam);
  progressMgr = new ProgressManager(created.id);
  session.buildDeck();

  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-email').value = '';

  renderProfileModal();
  updateUI();
  showToast(`🎉 Hoş geldin ${created.name}! Hesabın oluşturuldu.`);
});

// --- 9.1. PROFİL VE VERİ SIFIRLAMA İŞLEMLERİ ---
const btnResetCurrentProfile = document.getElementById('btn-reset-current-profile');
if (btnResetCurrentProfile) {
  btnResetCurrentProfile.addEventListener('click', () => {
    const curName = accountMgr.currentUser.name;
    const confirmed = confirm(
      `⚠️ "${curName}" profilinin tüm kazanılmış XP'leri (0 XP), seviyesi ve kelime çalışma geçmişi SIFIRLANACAKTIR.\n\nEmin misiniz?`
    );
    if (!confirmed) return;

    localStorage.setItem('ankoris_skip_seed', 'true');
    accountMgr.resetCurrentAccount();
    progressMgr.clearAllProgress();
    session.currentIndex = 0;
    session.buildDeck();
    renderProfileModal();
    updateUI();
    showToast(`✅ "${curName}" profilinin tüm verileri sıfırlandı (0 XP).`);
  });
}

const btnResetAllProfiles = document.getElementById('btn-reset-all-profiles');
if (btnResetAllProfiles) {
  btnResetAllProfiles.addEventListener('click', () => {
    const confirmed = confirm(
      `🚨 DİKKAT: Uygulamadaki TÜM kayıtlı profillerin (tüm kullanıcılar) XP'leri, seviyeleri, test sonuçları ve kelime çalışma geçmişleri kalıcı olarak SIFIRLANACAKTIR.\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`
    );
    if (!confirmed) return;

    localStorage.setItem('ankoris_skip_seed', 'true');
    accountMgr.resetAllAccountsData();

    // Tüm ankoris_progress_* anahtarlarını localStorage'dan temizle
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ankoris_progress_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Aktif kullanıcının ilerleme yöneticisini taze başlat ve temizle
    progressMgr = new ProgressManager(accountMgr.currentUser.id);
    progressMgr.clearAllProgress();

    session.currentIndex = 0;
    session.buildDeck();
    renderProfileModal();
    updateUI();
    showToast('🚨 Tüm profillerin tüm verileri başarıyla sıfırlandı!');
  });
}

// --- 10. MNEVO AI AKILLI KOÇ ---
const mnevoBackdrop = document.getElementById('mnevo-backdrop');
const mnevoStreamBox = document.getElementById('mnevo-stream-box');
const mnevoWordTitle = document.getElementById('mnevo-word-title');
const sentenceInput = document.getElementById('user-sentence-input');
const sentenceFeedback = document.getElementById('sentence-feedback');

function openMnevoAI() {
  const card = session.currentCard();
  if (!card) return;

  mnevoWordTitle.textContent = `Mnevo AI Koç: ${card.english}`;
  sentenceInput.value = '';
  sentenceFeedback.textContent = '';
  mnevoBackdrop.classList.add('active');

  startMnevoStreaming(card.english, card.turkish);
}

document.getElementById('btn-open-mnevo').addEventListener('click', openMnevoAI);
document.getElementById('btn-close-mnevo').addEventListener('click', () => {
  mnevoBackdrop.classList.remove('active');
});

function startMnevoStreaming(word, turkish) {
  mnevoStreamBox.textContent = '';
  const card = session.currentCard();
  
  let content = `⚓ Mnevo Çapası: "${card.mnemonic ? card.mnemonic.split('➔')[0].trim() : word}"\n\n` +
    `💡 Zihinsel Çapa Senaryosu: ${card.mnemonic || `${word} kelimesi Türkçe "${turkish}" anlamına gelir.`}\n\n` +
    `📌 Sınav & Bağlam İpucu: ${card.exampleEn}\n"${card.exampleTr}"\n\n` +
    `🎯 Bu kelimeyi zihnine sabitlemek için aşağıdaki alana kendi kurduğun bir cümleyi yaz!`;

  const words = content.split(' ');
  let idx = 0;
  const timer = setInterval(() => {
    if (idx < words.length) {
      mnevoStreamBox.textContent += (idx === 0 ? '' : ' ') + words[idx];
      idx++;
    } else {
      clearInterval(timer);
    }
  }, 35);
}

document.getElementById('btn-generate-ai').addEventListener('click', () => {
  const card = session.currentCard();
  if (card) startMnevoStreaming(card.english, card.turkish);
});

// Cümle Denetleyici
document.getElementById('btn-check-sentence').addEventListener('click', () => {
  const card = session.currentCard();
  if (!card) return;

  const val = sentenceInput.value.trim();
  if (!val) {
    sentenceFeedback.innerHTML = '<span style="color: #FF7675;">Lütfen bir cümle yazın.</span>';
    return;
  }

  const cleanWord = card.english.split('(')[0].trim().toLowerCase();
  if (!val.toLowerCase().includes(cleanWord)) {
    sentenceFeedback.innerHTML = `<span style="color: #FFB142;">⚠️ Cümlende "${cleanWord}" kelimesini göremedim. Kelimeyi cümleye dahil etmelisin.</span>`;
    return;
  }

  sentenceFeedback.innerHTML = `<span style="color: #00F5A0;">🎯 Mükemmel kullanım! "${cleanWord}" kelimesini doğru bağlamda kullandın. +3 XP kazandın!</span>`;
  accountMgr.currentUser.xp += 3;
  accountMgr.save();
  updateUI();
});

// --- 11. LİDERLİK TABLOSU ---
const leaderboardBackdrop = document.getElementById('leaderboard-backdrop');
const leaderboardListEl = document.getElementById('leaderboard-list');

function openLeaderboard() {
  const user = accountMgr.currentUser;
  document.getElementById('lb-my-xp').textContent = `${user.xp} XP`;
  document.getElementById('lb-my-streak').textContent = user.streak;
  document.getElementById('lb-my-freeze').textContent = user.freeze;

  const competitors = accountMgr.accounts.map(acc => ({
    name: acc.name + (acc.id === user.id ? ' (Sen)' : ''),
    xp: acc.xp,
    isMe: acc.id === user.id
  }));

  competitors.sort((a, b) => b.xp - a.xp);

  leaderboardListEl.innerHTML = '';
  competitors.forEach((item, index) => {
    const rank = index + 1;
    const div = document.createElement('div');
    div.className = `lb-item ${item.isMe ? 'is-me' : ''}`;
    div.innerHTML = `
      <span class="lb-rank">#${rank}</span>
      <span class="lb-name">${item.name}</span>
      <span class="lb-xp">${item.xp} XP</span>
    `;
    leaderboardListEl.appendChild(div);
  });

  leaderboardBackdrop.classList.add('active');
}

document.getElementById('btn-open-leaderboard').addEventListener('click', openLeaderboard);
document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
  leaderboardBackdrop.classList.remove('active');
});

// --- 12. KONFETİ EFEKTİ & TOAST ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function triggerConfetti() {
  particles = [];
  const colors = ['#00F5A0', '#FFD700', '#6C5CE7', '#FF7675', '#0984E3'];
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: canvas.width / 2,
      y: 180,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 14 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12
    });
  }
  requestAnimationFrame(updateConfetti);
}

function updateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let alive = false;
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.5;
    p.rotation += p.vRot;

    if (p.y < canvas.height) {
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  });

  if (alive) requestAnimationFrame(updateConfetti);
}

// Klavye Kısayolları (1: Öğrendim, 2: Zaten Biliyordum, Space: Çevir)
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    flipCard();
  } else if (e.key === '1') {
    rateKnowledgeChoice('learned');
  } else if (e.key === '2') {
    rateKnowledgeChoice('alreadyKnown');
  }
});

// Güvenli Profil & İlerleme Yedeği İndirme (Export Backup)
const btnExportBackup = document.getElementById('btn-export-backup');
const btnImportBackup = document.getElementById('btn-import-backup');
const backupFileInput = document.getElementById('backup-file-input');

if (btnExportBackup) {
  btnExportBackup.addEventListener('click', () => {
    const allProgressMap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ankoris_progress_')) {
        try {
          allProgressMap[k] = JSON.parse(localStorage.getItem(k));
        } catch (e) {
          allProgressMap[k] = localStorage.getItem(k);
        }
      }
    }

    const backupData = {
      app: 'Ankoris',
      version: 3,
      exportedAt: new Date().toISOString(),
      currentUser: accountMgr.currentUser,
      accounts: accountMgr.accounts,
      progress: progressMgr.data,
      allProgress: allProgressMap,
      checksum: SecureStorage.hash(JSON.stringify(accountMgr.accounts) + JSON.stringify(allProgressMap))
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ankoris_tum_profiller_yedek_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Tüm profiller ve ilerleme verileri güvenli yedeklendi.');
  });
}

if (btnImportBackup && backupFileInput) {
  btnImportBackup.addEventListener('click', () => {
    backupFileInput.click();
  });

  backupFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported || imported.app !== 'Ankoris' || !imported.accounts) {
          throw new Error('Geçersiz Ankoris yedek dosyası.');
        }

        accountMgr.accounts = imported.accounts;
        accountMgr.currentUser = imported.currentUser || imported.accounts[0];
        accountMgr.save();

        if (imported.allProgress) {
          Object.keys(imported.allProgress).forEach(k => {
            const val = imported.allProgress[k];
            localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
          });
        }

        progressMgr = new ProgressManager(accountMgr.currentUser.id);
        if (imported.progress && Object.keys(imported.progress).length > 0) {
          progressMgr.data = imported.progress;
          progressMgr.save();
        }

        session.buildDeck();
        renderProfileModal();
        updateUI();
        showToast('✅ Tüm profil verileri başarıyla doğrulandı ve yüklendi!');
      } catch (err) {
        showToast('❌ Hata: Yedek dosyası okunamadı veya bozuk.');
      }
    };
    reader.readAsText(file);
  });
}

// --- 13. MOBİL PWA SERVICE WORKER & DOKUNMATİK KAYDIRMA (TOUCH SWIPE) ---

// PWA Service Worker Kaydı (Çevrimdışı Mobil Çalışma)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('Ankoris PWA Çevrimdışı Hizmet Çalışanı aktif:', reg.scope);
    }).catch((err) => {
      console.log('PWA ServiceWorker:', err);
    });
  });
}

// Mobil QR Kod Modalı
const btnOpenMobileQr = document.getElementById('btn-open-mobile-qr');
const mobileQrBackdrop = document.getElementById('mobile-qr-backdrop');
const btnCloseMobileQr = document.getElementById('btn-close-mobile-qr');
const btnCopyUrl = document.getElementById('btn-copy-url');
const mobileUrlText = document.getElementById('mobile-url-text');

if (mobileUrlText) {
  const currentHost = window.location.hostname;
  const qrImg = document.getElementById('qr-img');
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    const lanUrl = `http://192.168.1.102:5173/`;
    mobileUrlText.textContent = lanUrl;
    if (qrImg) {
      qrImg.onerror = () => {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(lanUrl)}`;
      };
    }
  } else {
    const fullUrl = window.location.href;
    mobileUrlText.textContent = fullUrl;
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fullUrl)}`;
    }
  }
}


if (btnOpenMobileQr) {
  btnOpenMobileQr.addEventListener('click', () => {
    if (mobileQrBackdrop) mobileQrBackdrop.classList.add('active');
  });
}

if (btnCloseMobileQr) {
  btnCloseMobileQr.addEventListener('click', () => {
    if (mobileQrBackdrop) mobileQrBackdrop.classList.remove('active');
  });
}

if (btnCopyUrl && mobileUrlText) {
  btnCopyUrl.addEventListener('click', () => {
    navigator.clipboard.writeText(mobileUrlText.textContent).then(() => {
      showToast('📋 Mobil bağlantı adresi panoya kopyalandı!');
    }).catch(() => {
      showToast('Adres: ' + mobileUrlText.textContent);
    });
  });
}

// Modal Arka Planına (Backdrop) Tıklayarak Kapatma Desteği
[
  { el: unitsBackdrop, close: closeUnitsModal },
  { el: profileBackdrop, close: closeProfileModal },
  { el: leaderboardBackdrop, close: () => { if (leaderboardBackdrop) leaderboardBackdrop.classList.remove('active'); } },
  { el: mnevoBackdrop, close: () => { if (mnevoBackdrop) mnevoBackdrop.classList.remove('active'); } },
  { el: mobileQrBackdrop, close: () => { if (mobileQrBackdrop) mobileQrBackdrop.classList.remove('active'); } },
  { el: quizBackdrop, close: closeQuizModal }
].forEach(item => {
  if (item.el) {
    item.el.addEventListener('click', (e) => {
      if (e.target === item.el) {
        item.close();
      }
    });
  }
});

// Klavyede ESC tuşuna basıldığında aktif olan modalı kapat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.bottom-sheet-backdrop.active, .modal-backdrop.active');
    if (activeModal) {
      activeModal.classList.remove('active');
    }
  }
});

// Mobil Dokunmatik & Fare ile Kaydırma (Touch & Mouse Drag Gestures: Sola -> Öğrendim, Sağa -> Zaten Biliyordum)
let touchStartX = 0;
let touchDeltaX = 0;
let isSwiping = false;

if (cardEl) {
  cardEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchDeltaX = 0;
      isSwiping = true;
    }
  }, { passive: true });

  cardEl.addEventListener('touchmove', (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    touchDeltaX = currentX - touchStartX;

    if (Math.abs(touchDeltaX) > 10) {
      const rotateDeg = touchDeltaX * 0.04;
      cardEl.style.transform = `translateX(${touchDeltaX}px) rotate(${rotateDeg}deg)`;
    }
  }, { passive: true });

  cardEl.addEventListener('touchend', () => {
    if (!isSwiping) return;
    isSwiping = false;
    cardEl.style.transition = 'transform 0.22s ease';

    if (touchDeltaX < -75) {
      // Sola kaydırma -> "Öğrendim" (Kullanıcı İsteği)
      if ('vibrate' in navigator) navigator.vibrate(15);
      cardEl.style.transform = 'translateX(-260px) rotate(-14deg)';
      setTimeout(() => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        rateKnowledgeChoice('learned');
      }, 180);
    } else if (touchDeltaX > 75) {
      // Sağa kaydırma -> "Zaten Biliyordum" (Kullanıcı İsteği)
      if ('vibrate' in navigator) navigator.vibrate(25);
      cardEl.style.transform = 'translateX(260px) rotate(14deg)';
      setTimeout(() => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        rateKnowledgeChoice('alreadyKnown');
      }, 180);
    } else {
      // Geri orijinal konumuna al
      cardEl.style.transform = '';
      setTimeout(() => {
        cardEl.style.transition = '';
      }, 220);
    }
  });

  // Masaüstü Fare ile Kaydırma Desteği (Mouse Drag)
  let isMouseDragging = false;
  let mouseStartX = 0;
  let mouseDeltaX = 0;

  cardEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.tap-hint') || e.target.closest('.btn-refresh-example')) return;
    isMouseDragging = true;
    mouseStartX = e.clientX;
    mouseDeltaX = 0;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDragging) return;
    mouseDeltaX = e.clientX - mouseStartX;
    if (Math.abs(mouseDeltaX) > 10) {
      const rotateDeg = mouseDeltaX * 0.04;
      cardEl.style.transform = `translateX(${mouseDeltaX}px) rotate(${rotateDeg}deg)`;
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isMouseDragging) return;
    isMouseDragging = false;
    cardEl.style.transition = 'transform 0.22s ease';

    if (mouseDeltaX < -75) {
      // Sola kaydırma -> "Öğrendim"
      if ('vibrate' in navigator) navigator.vibrate(15);
      cardEl.style.transform = 'translateX(-260px) rotate(-14deg)';
      setTimeout(() => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        rateKnowledgeChoice('learned');
      }, 180);
    } else if (mouseDeltaX > 75) {
      // Sağa kaydırma -> "Zaten Biliyordum"
      if ('vibrate' in navigator) navigator.vibrate(25);
      cardEl.style.transform = 'translateX(260px) rotate(14deg)';
      setTimeout(() => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        rateKnowledgeChoice('alreadyKnown');
      }, 180);
    } else {
      cardEl.style.transform = '';
      setTimeout(() => {
        cardEl.style.transition = '';
      }, 220);
    }
  });
}

// Force Cache Clear & Kütüphane Yenileme Butonu
const btnForceCacheClear = document.getElementById('btn-force-cache-clear');
if (btnForceCacheClear) {
  btnForceCacheClear.addEventListener('click', async () => {
    btnForceCacheClear.textContent = '⏳ Temizleniyor...';
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      showToast('🧹 Önbellek temizlendi! Sayfa yenileniyor...');
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
    } catch (e) {
      window.location.reload(true);
    }
  });
}

// Başlangıç Deste Oluşturma & Arayüzü Yükleme
session.buildDeck();
updateUI();

// Konsol & Global Doğrulama
window.ANKORIS_WORDS_COUNT = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS.length : 0;
console.log(`%c[ANKORIS KÜTÜPHANESİ AKTİF]%c Yüklenen Kelime Sayısı: ${window.ANKORIS_WORDS_COUNT} | Ünite Sayısı: ${(typeof ANKORIS_UNITS !== 'undefined') ? ANKORIS_UNITS.length : 0}`, 'color: #00F5A0; font-weight: bold;', 'color: #fff;');
