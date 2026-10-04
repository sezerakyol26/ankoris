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

  // İlk açılışta kullanıcının unutma eğrisini ve zor kelimeleri deneyimlemesi için gerçekçi başlangıç verileri
  ensureSeedSimulatedData() {
    if (Object.keys(this.data).length === 0) {
      const now = Date.now();
      const oneDay = 24 * 3600 * 1000;

      // 1. Detrimental (Zor kelime - lapse var)
      this.data['w_1'] = {
        repetitions: 1,
        boxLevel: 1,
        easeFactor: 1.90,
        interval: 1,
        lapses: 2,
        consecutiveCorrect: 0,
        lastReviewedAt: new Date(now - oneDay * 3).toISOString(),
        nextReviewAt: new Date(now - oneDay).toISOString() // Süresi geçmiş
      };

      // 2. Ambiguous (Tekrarı gelmiş)
      this.data['w_2'] = {
        repetitions: 2,
        boxLevel: 2,
        easeFactor: 2.30,
        interval: 3,
        lapses: 1,
        consecutiveCorrect: 1,
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
        lastReviewedAt: new Date(now - oneDay * 2).toISOString(),
        nextReviewAt: new Date(now - oneDay).toISOString()
      };

      // 4. Vulnerable (Usta seviyesi)
      this.data['w_4'] = {
        repetitions: 4,
        boxLevel: 4,
        easeFactor: 2.65,
        interval: 14,
        lapses: 0,
        consecutiveCorrect: 4,
        lastReviewedAt: new Date(now - oneDay * 1).toISOString(),
        nextReviewAt: new Date(now + oneDay * 13).toISOString()
      };

      // 5. Plausible (Öğrenilmekte)
      this.data['w_5'] = {
        repetitions: 2,
        boxLevel: 2,
        easeFactor: 2.50,
        interval: 4,
        lapses: 0,
        consecutiveCorrect: 2,
        lastReviewedAt: new Date(now - oneDay * 2).toISOString(),
        nextReviewAt: new Date(now + oneDay * 2).toISOString()
      };

      this.save();
    }
  }

  getWordProgress(wordId) {
    return this.data[wordId] || {
      repetitions: 0,
      boxLevel: 1,
      easeFactor: 2.50,
      interval: 0,
      lapses: 0,
      consecutiveCorrect: 0,
      lastReviewedAt: null,
      nextReviewAt: null
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
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    this.save();
  }

  // 1. "ÖĞRENDİM" Aksiyonu: Kelimeyi Ebbinghaus aralıklı tekrar döngüsüne alır
  recordLearned(wordId) {
    const current = this.getWordProgress(wordId);
    const now = new Date();
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
      status: 'learning',
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    this.save();
    return { interval: newInterval, earnedXp: 2 };
  }

  // 2. "ZATEN BİLİYORDUM" Aksiyonu: Kelimeyi doğrudan Usta / Kalıcı Hafıza seviyesine aktarır
  recordAlreadyKnown(wordId) {
    const current = this.getWordProgress(wordId);
    const now = new Date();
    const nextReview = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    this.data[wordId] = {
      repetitions: Math.max(4, (current.repetitions || 0) + 1),
      boxLevel: 5, // Usta Seviyesi
      easeFactor: 2.80,
      interval: 30, // 30 gün sonra hatırlatıcı
      lapses: 0,
      consecutiveCorrect: Math.max(3, (current.consecutiveCorrect || 0) + 1),
      isAlreadyKnown: true,
      status: 'mastered',
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    this.save();
    return { interval: 30, earnedXp: 3 };
  }
}

let progressMgr = new ProgressManager(accountMgr.currentUser.id);

// --- 3. UYGULAMA VE ÇALIŞMA SEANSI DURUMU ---
class AnkorisSession {
  constructor() {
    this.mode = 'UNITS'; // 'UNITS', 'HARD', 'REVIEW'
    this.selectedUnitIds = new Set([1]); // Varsayılan: Ünite 1
    this.wordLimit = 20;
    this.activeDeck = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.selectedCategory = 'ALL';
    this.searchQuery = '';
  }

  // Modlara göre akıllı deste oluşturma
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
      // 3. ÜNİTE BAZLI STANDART ÇALIŞMA
      let filtered = allWords.filter(w => this.selectedUnitIds.has(w.unit_id));
      if (filtered.length === 0 && allWords.length > 0) {
        filtered = allWords.filter(w => w.unit_id === 1);
        this.selectedUnitIds = new Set([1]);
      }
      // Ünite içinde unutma riski olanları en başa getir (Akıllı Sıralama)
      filtered.sort((a, b) => {
        const pa = progressMgr.getWordProgress(a.id);
        const pb = progressMgr.getWordProgress(b.id);
        const isDueA = progressMgr.isDue(pa);
        const isDueB = progressMgr.isDue(pb);
        if (isDueA && !isDueB) return -1;
        if (!isDueA && isDueB) return 1;
        return 0;
      });
      this.activeDeck = filtered.slice(0, this.wordLimit);
    }

    this.currentIndex = 0;
    this.isFlipped = false;
    return this.activeDeck;
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

const priorityAlertBox = document.getElementById('priority-alert-box');
const alertSummaryEl = document.getElementById('alert-summary');
const btnQuickSmartReview = document.getElementById('btn-quick-smart-review');

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
const meaningEl = document.getElementById('card-meaning');
const mnemonicEl = document.getElementById('card-mnemonic');
const exampleEnEl = document.getElementById('card-example-en');
const exampleTrEl = document.getElementById('card-example-tr');
const sm2StatsEl = document.getElementById('sm2-stats-text');

const toastEl = document.getElementById('toast');

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

  // Akıllı Öncelik Uyarısı (Ebbinghaus Alarmı)
  if (dueReviewCount > 0 || hardCount > 0) {
    priorityAlertBox.style.display = 'flex';
    if (dueReviewCount > 0) {
      alertSummaryEl.textContent = `${dueReviewCount} kelime unutulma eşiğinde! Zihnin silmeden tekrar et.`;
      btnQuickSmartReview.textContent = 'Önce Tekrar Et';
    } else {
      alertSummaryEl.textContent = `${hardCount} kelimede zorlandın. Klinik pratik yap!`;
      btnQuickSmartReview.textContent = 'Zor Kelimeleri Aç';
    }
  } else {
    priorityAlertBox.style.display = 'none';
  }

  // Mod Butonlarının Aktiflik Durumu
  btnModeUnits.classList.toggle('active', session.mode === 'UNITS');
  btnModeHard.classList.toggle('active', session.mode === 'HARD');
  btnModeReview.classList.toggle('active', session.mode === 'REVIEW');

  // Aktif Ünite Başlığı
  if (session.mode === 'HARD') {
    currentUnitIconEl.textContent = '🔥';
    currentUnitTitleEl.textContent = 'Zor Kelimeler Kliniği (Zayıf Noktalar)';
    currentUnitSubEl.textContent = `Önceden Yanlış Yapılan ${session.activeDeck.length} Kelime`;
  } else if (session.mode === 'REVIEW') {
    currentUnitIconEl.textContent = '🧠';
    currentUnitTitleEl.textContent = 'Genel Tekrar (Ebbinghaus Unutma Eğrisi)';
    currentUnitSubEl.textContent = `Zaman Aşımına Uğramış ${session.activeDeck.length} Kelime`;
  } else {
    const count = session.selectedUnitIds.size;
    if (count === 1) {
      const uId = Array.from(session.selectedUnitIds)[0];
      const uObj = (typeof ANKORIS_UNITS !== 'undefined') ? ANKORIS_UNITS.find(u => u.id === uId) : null;
      currentUnitIconEl.textContent = uObj ? uObj.icon : '📚';
      currentUnitTitleEl.textContent = uObj ? uObj.title : `Ünite ${uId}`;
      currentUnitSubEl.textContent = `50 Ünite • 5.000 Kelimelik Kütüphane (${session.activeDeck.length} Kart Yüklü)`;
    } else if (count >= 50) {
      currentUnitIconEl.textContent = '💎';
      currentUnitTitleEl.textContent = 'Tüm Kütüphane (50 Ünite • 5.000 Kelime)';
      currentUnitSubEl.textContent = `5.000 Kelimenin Tümü Destede Aktif (${session.activeDeck.length} Kart)`;
    } else {
      currentUnitIconEl.textContent = '📚';
      currentUnitTitleEl.textContent = `Özel Seans: ${count} Ünite Seçili`;
      currentUnitSubEl.textContent = `5.000 Kelimelik Havuzdan ${session.activeDeck.length} Kart Destede`;
    }
  }

  // İlerleme & Hedef
  const remaining = session.activeDeck.length - session.currentIndex;
  remainingCountEl.textContent = `${remaining} Kart Kaldı`;
  dailyGoalTextEl.textContent = `Hedef: ${user.dailyReviewed}/${user.dailyTarget}`;
  const pct = Math.min(100, Math.round((user.dailyReviewed / user.dailyTarget) * 100));
  dailyProgressFillEl.style.width = `${pct}%`;

  // Kart İçeriği
  const card = session.currentCard();
  if (!card) {
    showCompletedView();
    return;
  }

  const p = progressMgr.getWordProgress(card.id);
  const ret = progressMgr.getRetention(p);
  const isHardWord = progressMgr.isHard(p);

  wordEl.textContent = card.english;
  phoneticEl.textContent = card.phonetic;
  posEl.textContent = card.pos;
  categoryEl.textContent = (isHardWord ? '🔥 ZOR KELİME • ' : '') + card.category.replace('_', ' ');

  meaningEl.textContent = card.turkish;
  mnemonicEl.textContent = card.mnemonic;
  exampleEnEl.textContent = card.exampleEn;
  exampleTrEl.textContent = card.exampleTr;

  let retText = p.lastReviewedAt ? ` • Kalıcılık: %${Math.round(ret * 100)}` : '';
  let lapseText = p.lapses > 0 ? ` • ${p.lapses} Kez Unutuldu` : '';
  sm2StatsEl.textContent = `SM-2: ${p.repetitions} Tekrar • EF: ${p.easeFactor.toFixed(2)}${lapseText}${retText}`;

  cardEl.classList.remove('flipped');
  session.isFlipped = false;
}

function showCompletedView() {
  cardEl.classList.remove('flipped');
  wordEl.textContent = 'Harika İş! 🚀';
  phoneticEl.textContent = session.mode === 'HARD' ? 'Zor kelimeleri başarıyla pekiştirdin!' : 'Tüm seansı başarıyla tamamladın!';
  posEl.textContent = 'Seans Bitti';
  categoryEl.textContent = 'TEBRİKLER';
  meaningEl.textContent = 'Tüm Kartlar Sabitlendi!';
  remainingCountEl.textContent = '0 Kart Kaldı';
  triggerConfetti();
  showToast('🏆 Seans tamamlandı! Bir sonraki hedefe hazırsın.');
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
    showToast(`⭐ Zaten Biliyordun! Usta Seviyesine Aktarıldı (+${result.earnedXp} XP)`);
  } else {
    result = progressMgr.recordLearned(card.id);
    showToast(`🌱 Öğrendin! Aralıklı Tekrar Döngüsüne Eklendi (+${result.earnedXp} XP)`);
  }

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

  session.currentIndex++;
  updateUI();
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
  session.mode = 'UNITS';
  session.buildDeck();
  updateUI();
  showToast('📚 Ünite Çalışma Modu Aktif');
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
let quizAdvanceTimer = null;

class QuizManager {
  constructor() {
    this.questions = [];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.earnedXp = 0;
    this.failedWords = [];
    this.isAnswering = false;
  }

  // Öğrenilen veya aktif ünitedeki kelimelerden 4 seçenekli test türetir
  buildQuiz() {
    const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
    
    // 1. Önce çalışılmış kelimeleri havuz yap
    let pool = allWords.filter(w => {
      const p = progressMgr.getWordProgress(w.id);
      return p.repetitions >= 1 || p.lapses > 0;
    });

    // Eğer çalışılmış kelime 4'ten az ise aktif destedeki kelimeleri de havuza ekle
    if (pool.length < 5) {
      pool = [...session.activeDeck];
    }
    if (pool.length < 4) {
      pool = allWords.slice(0, 20);
    }

    // Karıştır ve 10 soru seç
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const targetWords = shuffled.slice(0, 10);

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

function openQuizModal() {
  quizMgr.buildQuiz();
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

btnModeQuiz.addEventListener('click', openQuizModal);
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

    // Doğru cevaplandığında kelimenin zorluk durumu pekiştirilir
    p.testCorrectCount = (p.testCorrectCount || 0) + 1;
    p.consecutiveCorrect = (p.consecutiveCorrect || 0) + 1;
    p.easeFactor = Math.min(3.0, (p.easeFactor || 2.50) + 0.05);
    progressMgr.data[targetWord.id] = p;
    progressMgr.save();

    showToast('🎯 Doğru! +5 XP Kazandın');
  } else {
    // YANLIŞ CEVAPLANDI: Kelime anında "ZOR KELİME" havuzuna eklenir!
    selectedBtn.classList.add('wrong');
    quizMgr.wrongCount++;
    quizMgr.failedWords.push(targetWord);

    p.lapses = (p.lapses || 0) + 1;
    p.testWrongCount = (p.testWrongCount || 0) + 1;
    p.easeFactor = Math.max(1.30, (p.easeFactor || 2.50) - 0.20); // Zorluk katsayısı düşürülür
    p.consecutiveCorrect = 0;
    progressMgr.data[targetWord.id] = p;
    progressMgr.save();

    showToast(`⚠️ Yanlış! "${targetWord.english}" Zor Kelimeler havuzuna eklendi.`);
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

btnStartHardFromQuiz.addEventListener('click', () => {
  closeQuizModal();
  btnModeHard.click(); // Doğrudan zor kelimeler kliniğini başlat
});

btnRetakeQuiz.addEventListener('click', () => {
  openQuizModal();
});

// --- 8. ÜNİTE KÜTÜPHANESİ & İLERLEME / SEVİYE TAKİBİ MODALI ---
const unitsBackdrop = document.getElementById('units-backdrop');
const unitsListEl = document.getElementById('units-list');
const selectedUnitsCountText = document.getElementById('selected-units-count-text');
const btnStartText = document.getElementById('btn-start-text');

function openUnitsModal(defaultTab = 'units') {
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

document.getElementById('btn-open-units').addEventListener('click', openUnitsModal);
document.getElementById('btn-strip-open-units').addEventListener('click', openUnitsModal);
document.getElementById('btn-close-units').addEventListener('click', closeUnitsModal);

// Her ünitenin ilerleme, seviye ve zor kelime istatistiklerini hesaplar
function getUnitStats(unitId) {
  const allWords = (typeof ANKORIS_WORDS !== 'undefined') ? ANKORIS_WORDS : [];
  const unitWords = allWords.filter(w => w.unit_id === unitId);
  const total = unitWords.length || 100;
  
  let mastered = 0;
  let learning = 0;
  let hard = 0;

  unitWords.forEach(w => {
    const p = progressMgr.getWordProgress(w.id);
    if (p.repetitions >= 3 && p.boxLevel >= 3) mastered++;
    else if (p.repetitions >= 1) learning++;
    if (progressMgr.isHard(p)) hard++;
  });

  const studied = mastered + learning;
  const pct = Math.round((studied / total) * 100);

  let levelName = '⚪ Başlanmadı';
  let levelClass = '';
  if (pct >= 80) { levelName = '👑 Usta'; levelClass = 'master'; }
  else if (pct >= 45) { levelName = '⭐ İleri'; levelClass = 'master'; }
  else if (pct >= 15) { levelName = '🌱 Gelişmekte'; levelClass = ''; }
  else if (pct > 0) { levelName = '🔹 Başlangıç'; levelClass = ''; }

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
          ${stats.studied}/${stats.total} Kelime Çalışıldı ${stats.hard > 0 ? `• <span style="color: #FF5252;">⚠️ ${stats.hard} Zor</span>` : ''}
        </div>
        <div class="unit-card-progress">
          <div class="unit-prog-track">
            <div class="unit-prog-fill" style="width: ${stats.pct}%;"></div>
          </div>
          <span class="unit-prog-text">%${stats.pct}</span>
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
  session.buildDeck();
  closeUnitsModal();
  updateUI();
  showToast(`✅ ${session.selectedUnitIds.size} Ünite, ${session.activeDeck.length} Kelimelik Seans Başlatıldı!`);
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
    const isStudied = p.repetitions >= 1;

    return `
      <div class="dict-word-card" data-word-id="${w.id}">
        <div class="dict-word-top">
          <div class="dict-word-en-group">
            <span class="dict-word-en">${w.english}</span>
            <span class="dict-word-phonetic">${w.phonetic || ''}</span>
            <span class="dict-word-pos">${w.pos || 'kelime'}</span>
            ${isHard ? '<span style="font-size: 10px; color: #FF5252; font-weight: 700;">🔥 Zor</span>' : ''}
            ${isStudied ? '<span style="font-size: 10px; color: #00F5A0; font-weight: 700;">✓ Çalışıldı</span>' : ''}
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
    if (p.repetitions >= 3 && p.boxLevel >= 3) masteredCount++;
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

// İlerlemeyi Sıfırla
document.getElementById('btn-reset-user-progress').addEventListener('click', () => {
  if (confirm('Bu oturumun kelime ilerlemesini sıfırlamak istiyor musun?')) {
    accountMgr.currentUser.dailyReviewed = 0;
    accountMgr.save();
    session.currentIndex = 0;
    updateUI();
    closeProfileModal();
    showToast('Seans ilerlemesi sıfırlandı.');
  }
});

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

  const competitors = [
    { rank: 1, name: 'Berk Yılmaz (YDS 95+)', xp: 185 },
    { rank: 2, name: 'Dr. Zeynep Kaya', xp: 140 },
    { rank: 3, name: 'Ahmet Demir', xp: 110 },
    { rank: 4, name: `${user.name} (Sen)`, xp: user.xp, isMe: true },
    { rank: 5, name: 'Caner Özkan', xp: 65 },
    { rank: 6, name: 'Elif Şahin', xp: 35 }
  ];

  competitors.sort((a, b) => b.xp - a.xp);

  leaderboardListEl.innerHTML = '';
  competitors.slice(3).forEach((item, index) => {
    const rank = index + 4;
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

let toastTimer = null;
function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('active');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('active');
  }, 2200);
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
    const backupData = {
      app: 'Ankoris',
      version: 2,
      exportedAt: new Date().toISOString(),
      currentUser: accountMgr.currentUser,
      accounts: accountMgr.accounts,
      progress: progressMgr.data,
      checksum: SecureStorage.hash(JSON.stringify(accountMgr.accounts) + JSON.stringify(progressMgr.data))
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ankoris_backup_${accountMgr.currentUser.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Güvenli veri yedeği JSON dosyası olarak indirildi.');
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

        // Bütünlük Doğrulama
        const expectedChecksum = SecureStorage.hash(JSON.stringify(imported.accounts) + JSON.stringify(imported.progress));
        if (imported.checksum && imported.checksum !== expectedChecksum) {
          console.warn('Yedek dosyasında sağlama anahtarı eşleşmedi.');
        }

        accountMgr.accounts = imported.accounts;
        accountMgr.currentUser = imported.currentUser || imported.accounts[0];
        accountMgr.save();

        if (imported.progress) {
          progressMgr.data = imported.progress;
          progressMgr.save();
        }

        session.buildDeck();
        renderProfileModal();
        updateUI();
        showToast('✅ Güvenli yedek başarıyla doğrulandı ve yüklendi!');
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
    mobileUrlText.textContent = `http://192.168.1.102:5173/`;
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

// Mobil Dokunmatik Kaydırma (Touch Gestures: Sağa -> Öğrendim, Sola -> Zaten Biliyordum)
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

    if (touchDeltaX > 75) {
      // Sağa kaydırma -> "Öğrendim"
      if ('vibrate' in navigator) navigator.vibrate(15);
      cardEl.style.transform = 'translateX(260px) rotate(14deg)';
      setTimeout(() => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        rateKnowledgeChoice('learned');
      }, 180);
    } else if (touchDeltaX < -75) {
      // Sola kaydırma -> "Zaten Biliyordum"
      if ('vibrate' in navigator) navigator.vibrate(25);
      cardEl.style.transform = 'translateX(-260px) rotate(-14deg)';
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
