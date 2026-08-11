// ============================================================
//  app.js — Клиентская логика dastdaroz
//  Используется в: home.html
//
//  Разделы:
//    1. Импорты
//    2. Состояние приложения
//    3. Константы и данные
//    4. Утилиты
//    5. Auth / инициализация
//    6. Навигация
//    7. Сайдбар
//    8. Каталог общих категорий
//    9. Магазины / Ритейлеры
//   10. Товары
//   11. Корзина
//   12. Оформление заказа
//   13. Заказы
//   14. Статус заказа + карта
//   15. Чат с курьером
//   16. Поддержка
//   17. Профиль
//   18. Адреса
//   19. Кошелёк
//   20. Выбор города
// ============================================================

// ─── 1. Импорты ──────────────────────────────────────────────
import { auth, db, storage, ORDER_STATUS } from './firebase.js';
import { Sheet } from './sheet.js';

import {
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';

import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, increment, writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

import {
  ref as sRef, uploadBytes, getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js';


// ─── 2. Состояние приложения ──────────────────────────────────
let CU               = null;   // текущий пользователь Firebase Auth
let UD               = null;   // документ пользователя из Firestore
let GUEST            = false;  // режим гостя

let cart             = [];
let prods            = [];
let cats             = [];
let orders           = [];
let stores           = [];
let genCats          = [];

let catFilter        = 'all';
let searchQ          = '';
let homeSearchQ      = '';
let activeOid        = null;
let unsubLive        = null;
let currentOTab      = 'all';
let activeStore      = null;
let storeCatFilter   = 'all';
let jsonMenuData     = null;
let jsonProdsMap     = {};
let deliveryService  = 'mavsimi';

let _selectedCityId   = localStorage.getItem('selectedCityId')   || 'dushanbe';
let _selectedCityName = localStorage.getItem('selectedCityName') || 'Душанбе';
let _addrBannerUnsub  = null;


// ─── 3. Константы и статические данные ───────────────────────
const DFEE = 7; // стоимость доставки (сомони)

// Лейблы статусов заказа
const SL = {
  pending:    'Ожидание',
  confirmed:  'Подтверждён',
  preparing:  'Готовится',
  delivering: 'В пути',
  delivered:  'Доставлен',
  cancelled:  'Отменён',
};

// Цвета статусов
const SC = {
  pending:    'var(--amber)',
  confirmed:  'var(--blue)',
  preparing:  'var(--purple)',
  delivering: 'var(--acc)',
  delivered:  'var(--acc)',
  cancelled:  'var(--red)',
};

const STEPS = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered'];

// SVG-иконки категорий продуктов
const CAT_SVG = {
  vegetables: { color: '#16a34a', bg: 'rgba(22,163,74,.1)',   svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M16 6 Q10 10 10 20 Q10 26 16 28 Q22 26 22 20 Q22 10 16 6Z" fill="#16a34a" opacity=".85"/><path d="M16 6 Q14 14 15 22" stroke="#15803d" stroke-width="1.5" fill="none"/><path d="M16 6 Q18 14 17 22" stroke="#15803d" stroke-width="1.5" fill="none"/></svg>` },
  fruits:     { color: '#ef4444', bg: 'rgba(239,68,68,.1)',   svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="18" r="10" fill="#ef4444" opacity=".85"/><path d="M16 8 Q18 4 22 5" stroke="#16a34a" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="12" cy="16" r="2" fill="#fff" opacity=".3"/></svg>` },
  drinks:     { color: '#06b6d4', bg: 'rgba(6,182,212,.1)',   svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M10 8 L12 26 L20 26 L22 8 Z" fill="#06b6d4" opacity=".85"/><rect x="9" y="6" width="14" height="3" rx="1.5" fill="#0891b2"/></svg>` },
  chocolate:  { color: '#92400e', bg: 'rgba(146,64,14,.1)',   svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="5" y="9" width="22" height="16" rx="3" fill="#92400e" opacity=".85"/><line x1="12" y1="9" x2="12" y2="25" stroke="#7c2d12" stroke-width="1"/><line x1="19" y1="9" x2="19" y2="25" stroke="#7c2d12" stroke-width="1"/><line x1="5" y1="17" x2="27" y2="17" stroke="#7c2d12" stroke-width="1"/></svg>` },
  bread:      { color: '#d97706', bg: 'rgba(217,119,6,.1)',   svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M6 14 Q6 8 16 8 Q26 8 26 14 L26 24 Q26 26 24 26 L8 26 Q6 26 6 24 Z" fill="#d97706" opacity=".85"/><ellipse cx="16" cy="14" rx="10" ry="5" fill="#f59e0b" opacity=".4"/></svg>` },
  dairy:      { color: '#0ea5e9', bg: 'rgba(14,165,233,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="9" y="8" width="14" height="18" rx="3" fill="#0ea5e9" opacity=".85"/><circle cx="14" cy="19" r="2" fill="#fff" opacity=".5"/></svg>` },
  snacks:     { color: '#f97316', bg: 'rgba(249,115,22,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="5" y="12" width="22" height="12" rx="3" fill="#f97316" opacity=".85"/><rect x="8" y="10" width="16" height="4" rx="2" fill="#ea580c"/></svg>` },
  meat:       { color: '#dc2626', bg: 'rgba(220,38,38,.1)',   svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M8 22 Q6 18 10 14 Q14 10 18 12 L22 8 Q24 6 26 8 Q28 10 26 12 L22 16 Q24 20 20 22 Q16 24 12 22 Q10 24 8 22Z" fill="#dc2626" opacity=".85"/><circle cx="22" cy="10" r="3" fill="#fca5a5" opacity=".6"/></svg>` },
  default:    { color: '#64748b', bg: 'rgba(100,116,139,.1)', svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" fill="#64748b" opacity=".15"/><circle cx="16" cy="16" r="6" fill="#64748b" opacity=".5"/></svg>` },
};

// Fallback-данные категорий (Firestore имеет приоритет)
const GENERAL_CATS = [
  { id: 'american',      nameRu: 'Американская',  nameTj: 'Амрикоӣ',      icon: 'storage/general-catalogs/american.png',      order: 1  },
  { id: 'asian',         nameRu: 'Азиатская',     nameTj: 'Осиёӣ',        icon: 'storage/general-catalogs/asian.png',         order: 2  },
  { id: 'baby',          nameRu: 'Детское',       nameTj: 'Барои кӯдак',  icon: 'storage/general-catalogs/baby.png',          order: 3  },
  { id: 'bakery',        nameRu: 'Выпечка',       nameTj: 'Нонвойӣ',      icon: 'storage/general-catalogs/bakery.png',        order: 4  },
  { id: 'bbq',           nameRu: 'Барбекю',       nameTj: 'Барбекю',      icon: 'storage/general-catalogs/bbq.png',           order: 5  },
  { id: 'beauty',        nameRu: 'Красота',       nameTj: 'Зебоӣ',        icon: 'storage/general-catalogs/beauty.png',        order: 6  },
  { id: 'breakfast',     nameRu: 'Завтрак',       nameTj: 'Наҳорӣ',       icon: 'storage/general-catalogs/breakfast.png',     order: 7  },
  { id: 'bubble-tea',    nameRu: 'Бабл-ти',       nameTj: 'Бабл-ти',      icon: 'storage/general-catalogs/bubble-tea.png',    order: 8  },
  { id: 'burgers',       nameRu: 'Бургеры',       nameTj: 'Бургер',       icon: 'storage/general-catalogs/burgers.png',       order: 9  },
  { id: 'coffee',        nameRu: 'Кофе',          nameTj: 'Қаҳва',        icon: 'storage/general-catalogs/coffee.png',        order: 10 },
  { id: 'desserts',      nameRu: 'Десерты',       nameTj: 'Десерт',       icon: 'storage/general-catalogs/desserts.png',      order: 11 },
  { id: 'fast-food',     nameRu: 'Фастфуд',       nameTj: 'Фастфуд',      icon: 'storage/general-catalogs/fast-food.png',     order: 12 },
  { id: 'flowers',       nameRu: 'Цветы',         nameTj: 'Гулҳо',        icon: 'storage/general-catalogs/flowers.png',       order: 13 },
  { id: 'gifts',         nameRu: 'Подарки',       nameTj: 'Тӯҳфаҳо',      icon: 'storage/general-catalogs/gifts.png',         order: 14 },
  { id: 'halal',         nameRu: 'Халяль',        nameTj: 'Ҳалол',        icon: 'storage/general-catalogs/halal.png',         order: 15 },
  { id: 'healthy',       nameRu: 'Здоровое',      nameTj: 'Солим',        icon: 'storage/general-catalogs/healthy.png',       order: 16 },
  { id: 'ice-cream',     nameRu: 'Мороженое',     nameTj: 'Яхмос',        icon: 'storage/general-catalogs/ice-cream.png',     order: 17 },
  { id: 'italian',       nameRu: 'Итальянская',   nameTj: 'Италиявӣ',     icon: 'storage/general-catalogs/italian.png',       order: 18 },
  { id: 'japanese',      nameRu: 'Японская',      nameTj: 'Японӣ',        icon: 'storage/general-catalogs/japanese.png',      order: 19 },
  { id: 'korean',        nameRu: 'Корейская',     nameTj: 'Кореягӣ',      icon: 'storage/general-catalogs/korean.png',        order: 20 },
  { id: 'mexican',       nameRu: 'Мексиканская',  nameTj: 'Мексикагӣ',    icon: 'storage/general-catalogs/mexican.png',       order: 21 },
  { id: 'pharmacy',      nameRu: 'Аптека',        nameTj: 'Дорухона',     icon: 'storage/general-catalogs/pharmacy.png',      order: 22 },
  { id: 'pizza',         nameRu: 'Пицца',         nameTj: 'Питса',        icon: 'storage/general-catalogs/pizza.png',         order: 23 },
  { id: 'retail',        nameRu: 'Магазины',      nameTj: 'Мағозаҳо',     icon: 'storage/general-catalogs/retail.png',        order: 24 },
  { id: 'salads',        nameRu: 'Салаты',        nameTj: 'Салатҳо',      icon: 'storage/general-catalogs/salads.png',        order: 25 },
  { id: 'seafood',       nameRu: 'Морепродукты',  nameTj: 'Мевои баҳр',   icon: 'storage/general-catalogs/seafood.png',       order: 26 },
  { id: 'soup',          nameRu: 'Супы',          nameTj: 'Шӯрбо',        icon: 'storage/general-catalogs/soup.png',          order: 27 },
  { id: 'street-food',   nameRu: 'Уличная еда',   nameTj: 'Хӯроки кӯча',  icon: 'storage/general-catalogs/street-food.png',   order: 28 },
  { id: 'sushi',         nameRu: 'Суши',          nameTj: 'Суши',         icon: 'storage/general-catalogs/sushi.png',         order: 29 },
  { id: 'sweets',        nameRu: 'Сладости',      nameTj: 'Ширинӣ',       icon: 'storage/general-catalogs/sweets.png',        order: 30 },
  { id: 'vegan',         nameRu: 'Веганское',     nameTj: 'Веган',        icon: 'storage/general-catalogs/vegan.png',         order: 31 },
  { id: 'wings',         nameRu: 'Крылышки',      nameTj: 'Болҳо',        icon: 'storage/general-catalogs/wings.png',         order: 32 },
];


// ─── 4. Утилиты ───────────────────────────────────────────────

/** Экранирование HTML (защита от XSS) */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Форматирование даты из Firestore Timestamp */
function fmtDate(ts) {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    + ', '
    + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Генерация случайного 8-значного номера заказа */
function nextOrderNum() {
  return Math.floor(10_000_000 + Math.random() * 90_000_000).toString();
}

/** Определение ключа иконки категории по id/названию */
function catIconKey(id, name) {
  const n = (name || id || '').toLowerCase();
  if (/сабзав|овощ|vegeta/i.test(n)) return 'vegetables';
  if (/мева|фрукт|fruit/i.test(n))   return 'fruits';
  if (/нӯшок|напит|drink/i.test(n))  return 'drinks';
  if (/шокол|choco/i.test(n))        return 'chocolate';
  if (/нон|хлеб|bread/i.test(n))     return 'bread';
  if (/лаб|молок|dairy|шир/i.test(n))return 'dairy';
  if (/гӯшт|мясо|meat/i.test(n))     return 'meat';
  if (/снек|перек|snack/i.test(n))   return 'snacks';
  return id in CAT_SVG ? id : 'default';
}

const catIcon = (id, name) => CAT_SVG[catIconKey(id, name)] || CAT_SVG.default;
const catName = id => (cats.find(c => c.id === id) || {}).name || id || '';
const getCartQty = pid => (cart.find(c => c.productId === pid) || {}).quantity || 0;

/** Извлечение телефона из псевдо-email dastdaroz ID */
function phoneFromPseudoEmail(email) {
  const m = /^992(\d{9})@phone\.dastdaroz\.id$/.exec(email || '');
  return m ? '+992' + m[1] : '';
}

/** Форматирование баланса кошелька */
function _fmtBal(n) {
  const v     = Number(n) || 0;
  const whole = Math.floor(v);
  const cents = Math.round((v - whole) * 100);
  return {
    whole: whole.toLocaleString('ru-RU'),
    cents: cents.toString().padStart(2, '0'),
  };
}

// ─── Toast уведомления ────────────────────────────────────────
window.toast = function (msg, type = '') {
  const w  = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div class="tdot"></div><span>${msg}</span>`;
  w.appendChild(el);
  setTimeout(() => el.remove(), 3400);
};

/** Свайп вниз для закрытия шитов */
function initSwipeToClose(sheetEl, closeFn, handleEl) {
  if (!sheetEl) return;
  const trigger = handleEl || sheetEl;
  let startY = 0, lastY = 0, active = false;

  trigger.addEventListener('touchstart', e => {
    if (!handleEl && sheetEl.scrollTop > 0) return;
    startY = lastY = e.touches[0].clientY;
    active = true;
    sheetEl.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!active) return;
    lastY = e.touches[0].clientY;
    const dy = Math.max(0, lastY - startY);
    sheetEl.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    const dy = Math.max(0, lastY - startY);
    sheetEl.style.transition = '';
    sheetEl.style.transform  = '';
    if (dy > 100) closeFn();
  });
}


// ─── 5. Инициализация sheets (sheet.js) ──────────────────────
function _initSheets() {

  // ── City selector ──────────────────────────────────────────
  Sheet.define({ id: 'city', title: 'Выбор города', zIndex: 700, onOpen: _loadCities });
  Sheet.body('city').innerHTML = `
    <p class="citysh-subtitle">Все магазины и доставка будут показаны для выбранного города</p>
    <div class="citysh-list" id="citysh-list">
      <div class="citysh-empty">Загружаем города…</div>
    </div>`;

  // ── Cart address picker ────────────────────────────────────
  Sheet.define({ id: 'caddr', title: 'Адрес доставки', zIndex: 700 });
  Sheet.body('caddr').innerHTML = `
    <div class="caddrsh-list" id="caddrsh-list">
      <div class="caddrsh-empty">Адреса загружаются…</div>
    </div>`;

  // ── Add new address ────────────────────────────────────────
  Sheet.define({ id: 'addaddr', title: 'Новый адрес', zIndex: 710 });
  const addaddrBody = Sheet.body('addaddr');
  addaddrBody.style.cssText = 'padding:0 20px';
  addaddrBody.innerHTML = `
    <label class="addaddr-lbl" for="addaddr-inp">Полный адрес</label>
    <textarea class="addaddr-inp" id="addaddr-inp" rows="3"
      placeholder="Например: ул. Рудаки 42, кв. 7…"></textarea>
    <button class="addaddr-save" id="addaddr-save-btn" onclick="saveProfileAddr()">
      Сохранить
    </button>`;
}

_initSheets();

// ─── 5. Auth / Инициализация ──────────────────────────────────
onAuthStateChanged(auth, async u => {
  if (!u) {
    GUEST = true;
    CU    = null;
    UD    = null;
    if (_addrBannerUnsub) { _addrBannerUnsub(); _addrBannerUnsub = null; }
    await Promise.all([loadProds(), loadCats(), loadStores(), loadGenCats()]);
    renderSB();
    renderGuestBanner();
    renderGuestProfile();
    renderCart();
    return;
  }

  GUEST = false;
  CU    = u;
  await loadUD();
  await Promise.all([loadCart(), loadProds(), loadCats(), loadOrders(), loadStores(), loadGenCats()]);
  renderSB();
  renderProfile();
  renderCart();
  removeGuestBanner();
  listenSupportBadge();
  loadHomePromo();
  checkAddressBanner(u.uid);
});

/** Загрузка промо-баннера на главной */
async function loadHomePromo() {
  try {
    const snap = await getDoc(doc(db, 'config', 'homePromo'));
    if (!snap.exists()) return;
    const d = snap.data();
    if (!d.active || !d.imageUrl) return;
    const section = document.getElementById('promo-section');
    const card    = document.getElementById('promo-card');
    const img     = document.getElementById('promo-img');
    if (!section || !card || !img) return;
    img.src = d.imageUrl;
    img.alt = d.altText || '';
    if (d.linkUrl) { card.href = d.linkUrl; card.classList.remove('no-link'); }
    else           { card.removeAttribute('href'); card.classList.add('no-link'); }
    section.style.display = 'block';
  } catch {}
}

/** Загрузка данных пользователя из Firestore */
async function loadUD() {
  const fallbackPhone = phoneFromPseudoEmail(CU.email);
  try {
    const s = await getDoc(doc(db, 'users', CU.uid));
    UD = s.exists()
      ? s.data()
      : { displayName: CU.displayName || '', phone: fallbackPhone, address: '', lat: null, lng: null, role: 'client', avatarUrl: '', walletBalance: 0 };
  } catch {
    UD = { displayName: '', phone: fallbackPhone, address: '', lat: null, lng: null, role: 'client', avatarUrl: '', walletBalance: 0 };
  }
}

window.doLogout = async function () {
  if (unsubLive) unsubLive();
  await signOut(auth);
};

window.goLogin = function () { location.href = 'login.html'; };

/** Проверка авторизации перед действием */
function requireAuth(msg) {
  if (!GUEST) return true;
  toast(msg || 'Войдите для этого действия', 'info');
  setTimeout(() => {
    const el = document.querySelector('.toast:last-child');
    if (el) { el.style.cursor = 'pointer'; el.onclick = () => goLogin(); }
  }, 50);
  return false;
}

// DOMContentLoaded: регистрируем свайпы и инициализируем UI
document.addEventListener('DOMContentLoaded', () => {
  initSwipeToClose(
    document.getElementById('wlt-sheet'),
    () => typeof closeWallet === 'function' && closeWallet(),
    document.getElementById('wlt-drag-handle')
  );
  initSwipeToClose(
    document.getElementById('wlt-tup-sheet'),
    () => typeof closeTopUp === 'function' && closeTopUp()
  );
  initSwipeToClose(
    document.getElementById('ptn-sheet'),
    () => typeof closePartnerSheet === 'function' && closePartnerSheet(),
    document.getElementById('ptn-drag-handle')
  );
  initSwipeToClose(
    document.getElementById('bs-city'),
    () => closeCitySheet(),
    document.querySelector('#bs-city .bs-drag')
  );

  const _tbCityEl = document.getElementById('tb-city-name');
  if (_tbCityEl) _tbCityEl.textContent = _selectedCityName;
});


// ─── 6. Навигация ─────────────────────────────────────────────
window.goPage = function (page) {
  if (GUEST && ['orders', 'status', 'cart'].includes(page)) {
    toast(page === 'cart'
      ? 'Войдите, чтобы использовать корзину'
      : 'Войдите, чтобы видеть заказы', 'info');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni,.mn-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll(`.ni[data-page="${page}"],.mn-item[data-page="${page}"]`)
    .forEach(n => n.classList.add('active'));

  const tb = document.getElementById('tb-title');
  if (page === 'home') {
    tb.innerHTML = 'dastdaroz <em>Delivery</em>';
  } else {
    tb.textContent = {
      catalog: 'Каталог',
      cart:    'Корзина',
      orders:  'Мои заказы',
      status:  'Статус заказа',
      profile: 'Профиль',
      store:   activeStore?.name || 'Магазин',
    }[page] || 'dastdaroz';
  }

  if (page === 'status') renderStatusPage();
  if (page === 'orders') { showOrdersSkeleton(); loadOrders(); }
  if (page === 'store')  renderStorePage();

  closeSB();
  document.getElementById('pages').scrollTop = 0;
};

window.selectDeliveryService = function (svc) {
  deliveryService = svc;
  document.querySelectorAll('.dtab').forEach(el => {
    el.classList.toggle('active', el.dataset.svc === svc);
  });
};


// ─── 7. Сайдбар ───────────────────────────────────────────────
window.toggleSB = function () {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-overlay').classList.toggle('open');
};
window.closeSB = function () {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
};
document.getElementById('sb-overlay').addEventListener('click', closeSB);

function renderSB() {
  if (GUEST) {
    _renderGuestSB();
    return;
  }
  const name = UD?.displayName || 'Покупатель';
  const init = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  document.getElementById('sb-uname').textContent = name;
  const av = document.getElementById('sb-av');
  av.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;

  const adv = document.getElementById('sb-addr-val');
  if (UD?.address) {
    adv.textContent = UD.address;
    adv.classList.remove('empty');
  } else {
    adv.textContent = 'Указать адрес →';
    adv.classList.add('empty');
  }

  const profAddrDisplay = document.getElementById('prof-addr-display');
  if (profAddrDisplay) {
    profAddrDisplay.textContent   = UD?.address || 'Указать адрес →';
    profAddrDisplay.style.color   = UD?.address ? 'var(--tx2)' : 'var(--acc)';
    profAddrDisplay.style.fontWeight = UD?.address ? '500' : '600';
  }
}

function _renderGuestSB() {
  const nm = document.getElementById('sb-uname');
  if (nm) nm.textContent = 'Гость';

  const av = document.getElementById('sb-av');
  if (av) av.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  const adv = document.getElementById('sb-addr-val');
  if (adv) { adv.textContent = 'Войдите для оформления заказа'; adv.classList.add('empty'); }

  const role = document.querySelector('.sb-urole');
  if (role) role.textContent = 'Гостевой режим';

  const logoutBtn = document.querySelector('.sb-logout');
  if (logoutBtn) {
    logoutBtn.title   = 'Войти';
    logoutBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>`;
    logoutBtn.onclick = e => { e.stopPropagation(); goLogin(); };
    logoutBtn.style.color = 'var(--acc)';
  }

  const userEl = document.querySelector('.sb-user');
  if (userEl) userEl.onclick = () => goLogin();
}

function renderGuestBanner() {
  document.getElementById('topbar')?.style?.setProperty('display', 'none');
  document.getElementById('guest-topbar')?.classList.add('visible');
  document.querySelectorAll('.sb-nav .guest-hidden').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#prof-nav-section .pn-guest-hidden').forEach(el => el.style.display = 'none');
  const addrRow = document.getElementById('sb-addr-row');
  if (addrRow) { addrRow.style.pointerEvents = 'none'; addrRow.style.opacity = '.45'; }
}

function removeGuestBanner() {
  document.getElementById('topbar')?.style?.removeProperty('display');
  document.getElementById('guest-topbar')?.classList.remove('visible');
  document.querySelectorAll('.sb-nav .guest-hidden').forEach(el => el.style.display = '');
  document.querySelectorAll('#prof-nav-section .pn-guest-hidden').forEach(el => el.style.display = '');
  const addrRow = document.getElementById('sb-addr-row');
  if (addrRow) { addrRow.style.pointerEvents = ''; addrRow.style.opacity = ''; }
}


// ─── 8. Общие категории ───────────────────────────────────────
async function loadGenCats() {
  // Сразу показываем скелетоны — сбрасываем старые данные до ответа Firestore
  showGenCatsSkeleton();

  try {
    const snap = await getDocs(query(collection(db, 'generalCatalogs'), orderBy('order', 'asc')));
    if (!snap.empty) {
      const all = snap.docs.map(d => {
        const data = d.data();
        const raw = data.cityIds;
        const cityIds = Array.isArray(raw)
          ? raw.filter(Boolean)
          : (typeof raw === 'string' && raw.trim() ? [raw.trim()] : []);
        return {
          id:      d.id,
          nameRu:  data.nameRu || data.name || d.id,
          nameTj:  data.nameTj || data.name || d.id,
          icon:    data.icon   || `storage/general-catalogs/${d.id}.png`,
          order:   data.order  ?? 0,
          active:  data.active,
          cityIds,
        };
      }).filter(c => c.active !== false);

      genCats = all.filter(c =>
        !c.cityIds.length || c.cityIds.includes(_selectedCityId)
      );
    } else {
      genCats = [...GENERAL_CATS];
    }
  } catch {
    genCats = [...GENERAL_CATS];
  }
  renderGenCats();
  renderCatalogGenCats();
}

// Сбрасывает контент и возвращает скелетоны в оба контейнера
function showGenCatsSkeleton() {
  genCats = [];
  const row = document.getElementById('gen-cats-row');
  if (row) {
    row.innerHTML = Array(8).fill(
      '<div class="gen-cat-skl-wrap"><div class="gen-cat-skl-ico"></div><div class="gen-cat-skl-lbl"></div></div>'
    ).join('');
  }
  const grid = document.getElementById('gen-cat-grid');
  if (grid) {
    grid.innerHTML = Array(9).fill(
      '<div class="gcat-skl-wrap"><div class="gcat-skl-img"></div><div class="gcat-skl-lbl"></div></div>'
    ).join('');
  }
}

function renderGenCats() {
  const el = document.getElementById('gen-cats-row');
  if (!el) return;
  if (!genCats.length) { el.innerHTML = ''; return; } // нет категорий для города — убираем скелетоны
  el.innerHTML = genCats.map(c => `
    <button class="gen-cat-btn" onclick="onGenCatClick('${c.id}')" title="${c.nameRu}">
      <div class="gen-cat-img-wrap">
        <img class="gen-cat-img" src="${c.icon}" alt="${c.nameRu}" loading="lazy" onerror="this.style.opacity='.18'"/>
      </div>
      <div class="gen-cat-name">${c.nameRu}</div>
    </button>`).join('');
}

function renderCatalogGenCats() {
  const el = document.getElementById('gen-cat-grid');
  if (!el) return;
  if (!genCats.length) { el.innerHTML = ''; return; } // нет категорий для города — убираем скелетоны
  el.innerHTML = genCats.map(c => `
    <div class="gcat-item" id="gcat-${c.id}" data-gencat="${c.id}">
      <div class="gcat-img-wrap">
        <img class="gcat-img" src="${c.icon}" alt="${c.nameRu}" loading="lazy" onerror="this.style.opacity='.18'"/>
      </div>
      <div class="gcat-name">${c.nameRu}</div>
    </div>`).join('');
}

window.onGenCatClick = function (id) { goPage('catalog'); };

// Seeding утилита (запустить один раз из консоли: await seedGeneralCats())
window.seedGeneralCats = async function () {
  try {
    const batch = writeBatch(db);
    GENERAL_CATS.forEach(c => {
      batch.set(doc(db, 'generalCategories', c.id), {
        nameRu: c.nameRu, nameTj: c.nameTj, icon: c.icon, order: c.order, active: true,
      });
    });
    await batch.commit();
    genCats = [...GENERAL_CATS];
    renderGenCats();
    renderCatalogGenCats();
    console.log('✅ seedGeneralCats: записано', GENERAL_CATS.length, 'категорий');
  } catch (e) {
    console.error('❌ seedGeneralCats:', e);
  }
};


// ─── 9. Магазины / Ритейлеры ─────────────────────────────────
async function loadStores() {
  const cityId = _selectedCityId;
  try {
    const [byPrimary, byCityIds] = await Promise.all([
      getDocs(query(collection(db, 'retailers'), where('primaryCityId', '==', cityId))),
      getDocs(query(collection(db, 'retailers'), where('cityIds', 'array-contains', cityId))),
    ]);

    const seen = new Set();
    stores = [...byPrimary.docs, ...byCityIds.docs]
      .filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return d.data().active !== false;
      })
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  } catch (e) {
    console.warn('loadStores fallback:', e?.message);
    try {
      const s = await getDocs(query(collection(db, 'retailers'), where('active', '==', true)));
      stores = s.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.primaryCityId === cityId || (r.cityIds || []).includes(cityId))
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    } catch { stores = []; }
  }
  renderStoresGrid();
}

function renderStoresGrid() {
  const el = document.getElementById('stores-grid');
  if (!el) return;

  if (!stores.length) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px 20px;color:var(--tx3);font-size:.76rem">
      <div style="font-size:1.6rem;margin-bottom:8px;opacity:.3">🏪</div>
      В городе <strong>${_selectedCityName}</strong> магазинов пока нет
    </div>`;
    return;
  }

  const esc = v => String(v || '').replace(/'/g, '&#39;');
  el.innerHTML = stores.map(s => `
    <div class="store-card" onclick="openRetailer('${s.id}')" title="${esc(s.name)}">
      <div class="store-card-img-wrap">
        ${s.imageUrl
          ? `<img class="store-card-img" src="${s.imageUrl}" alt="${esc(s.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="store-card-placeholder" ${s.imageUrl ? 'style="display:none"' : ''}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
          <span>${esc(s.name)}</span>
        </div>
      </div>
      ${s.name ? `<div class="store-card-name">${esc(s.name)}</div>` : ''}
    </div>`).join('');
}

window.openRetailer = async function (sid) {
  activeStore    = stores.find(s => s.id === sid);
  storeCatFilter = 'all';
  jsonMenuData   = null;
  jsonProdsMap   = {};
  if (!activeStore) return;
  goPage('store');
  renderRetailerPage(activeStore);
};
window.openStore = window.openRetailer; // алиас для совместимости

async function renderRetailerPage(retailer) {
  const hdrEl   = document.getElementById('store-header');
  const catsEl  = document.getElementById('store-cats');
  const prodsEl = document.getElementById('store-prods');
  if (!hdrEl) return;

  const imgUrl = retailer.imageUrl || '';
  hdrEl.innerHTML = `
    <div class="store-cat-header">
      ${imgUrl ? `<img class="store-cat-header-img" src="${imgUrl}" alt="${retailer.name}">` : ''}
      <div class="store-cat-header-overlay"></div>
      <div class="store-cat-header-body">
        <div class="store-cat-header-tag">Ритейлер · ${_selectedCityName}</div>
        <div class="store-cat-header-name">${retailer.name}</div>
        ${retailer.description ? `<div class="store-cat-header-desc">${retailer.description}</div>` : ''}
      </div>
    </div>`;

  if (catsEl)  catsEl.innerHTML  = '';
  if (prodsEl) prodsEl.innerHTML = `
    <div style="grid-column:1/-1">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="font-family:var(--fd);font-weight:900;font-size:.82rem;color:var(--tx)">Точки в городе ${_selectedCityName}</span>
      </div>
      <div id="retailer-locations-list">
        <div class="retailer-loc-skeleton"></div>
        <div class="retailer-loc-skeleton"></div>
      </div>
    </div>`;

  try {
    const snap = await getDocs(
      query(collection(db, 'retailers', retailer.id, 'locations'), where('cityId', '==', _selectedCityId))
    );
    const locations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const listEl    = document.getElementById('retailer-locations-list');
    if (!listEl) return;

    if (!locations.length) {
      listEl.innerHTML = `<div class="store-cat-empty">
        <span class="store-cat-empty-ico">📍</span>
        <div class="store-cat-empty-t">Точек в ${_selectedCityName} нет</div>
        <div class="store-cat-empty-s">Попробуйте выбрать другой город</div>
      </div>`;
      return;
    }

    listEl.innerHTML = locations.map(loc => {
      const mapsUrl = (loc.lat && loc.lng) ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : '';
      return `
      <div class="retailer-loc-card">
        <div class="retailer-loc-ico">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="retailer-loc-body">
          <div class="retailer-loc-addr">${loc.address || '—'}</div>
          ${loc.lat && loc.lng ? `<div class="retailer-loc-coords">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>` : ''}
        </div>
        ${mapsUrl ? `<a class="retailer-loc-map-btn" href="${mapsUrl}" target="_blank" rel="noopener">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Карта
        </a>` : ''}
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Retailer locations error:', e);
    const listEl = document.getElementById('retailer-locations-list');
    if (listEl) listEl.innerHTML = `<div class="store-cat-empty"><div class="store-cat-empty-t">Ошибка загрузки</div></div>`;
  }
}

async function loadJsonMenu(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const raw = await resp.json();
    jsonMenuData = Array.isArray(raw)
      ? { categories: [], products: raw }
      : { categories: raw.categories || [], products: raw.products || raw.items || [] };
  } catch (e) {
    console.error('JSON menu:', e);
    jsonMenuData = { categories: [], products: [], error: e.message };
  }

  jsonProdsMap = {};
  (jsonMenuData.products || []).forEach(p => {
    if (p.id) jsonProdsMap[p.id] = { ...p, storeId: activeStore?.id };
  });
  renderStoreCatPills();
  renderStoreProds();
}

window.filterStoreCat = function (id) {
  storeCatFilter = id;
  renderStoreCatPills();
  renderStoreProds();
};

function renderStorePage() {
  if (!activeStore) return;
  const hdr = document.getElementById('store-header');
  if (hdr) {
    const imgUrl = activeStore.imageUrl || '';
    hdr.innerHTML = `
    <div class="store-cat-header">
      ${imgUrl ? `<img class="store-cat-header-img" src="${imgUrl}" alt="${activeStore.name}">` : ''}
      <div class="store-cat-header-overlay"></div>
      <div class="store-cat-header-body">
        <div class="store-cat-header-tag">Магазин</div>
        <div class="store-cat-header-name">${activeStore.name}</div>
        ${activeStore.description ? `<div class="store-cat-header-desc">${activeStore.description}</div>` : ''}
      </div>
    </div>`;
  }
  renderStoreCatPills();
  renderStoreProds();
}

function getStoreCats() {
  if (!activeStore) return [];
  const storeProdIds = new Set(prods.filter(p => p.storeId === activeStore.id).map(p => p.categoryId));
  return cats.filter(c => storeProdIds.has(c.id));
}

function renderStoreCatPills() {
  const el = document.getElementById('store-cats');
  if (!el) return;

  const all = `<button class="cat${storeCatFilter === 'all' ? ' active' : ''}" onclick="filterStoreCat('all')">Все</button>`;

  if (jsonMenuData) {
    el.innerHTML = all + (jsonMenuData.categories || []).map(c =>
      `<button class="cat${storeCatFilter === c.id ? ' active' : ''}" onclick="filterStoreCat('${c.id}')">${c.name}</button>`
    ).join('');
  } else {
    el.innerHTML = all + getStoreCats().map(c =>
      `<button class="cat${storeCatFilter === c.id ? ' active' : ''}" onclick="filterStoreCat('${c.id}')">${c.name}</button>`
    ).join('');
  }
}

function renderStoreProds() {
  const el = document.getElementById('store-prods');
  if (!el || !activeStore) return;

  const skeleton = Array(6).fill(0).map(() =>
    `<div class="pc pc-skeleton"><div class="pc-img"></div><div class="pc-body" style="gap:8px">
      <div class="skl-block" style="height:8px;width:55%;margin-bottom:4px"></div>
      <div class="skl-block" style="height:10px;width:80%"></div>
      <div class="skl-block" style="height:7px;width:40%;margin-top:4px"></div>
    </div></div>`
  ).join('');

  if (activeStore.menuUrl && jsonMenuData === null) { el.innerHTML = skeleton; return; }

  if (jsonMenuData) {
    if (jsonMenuData.error && !jsonMenuData.products?.length) {
      el.innerHTML = `<div class="store-cat-empty" style="grid-column:1/-1">
        <span class="store-cat-empty-ico">⚠️</span>
        <div class="store-cat-empty-t">Ошибка при загрузке</div>
        <div class="store-cat-empty-s">${jsonMenuData.error}</div>
      </div>`;
      return;
    }
    let list = jsonMenuData.products || [];
    if (storeCatFilter !== 'all') list = list.filter(p => p.categoryId === storeCatFilter);
    el.innerHTML = list.length
      ? list.map(p => renderPC({ ...p, storeId: activeStore.id })).join('')
      : `<div class="store-cat-empty" style="grid-column:1/-1"><span class="store-cat-empty-ico">📦</span><div class="store-cat-empty-t">Товары не найдены</div></div>`;
    return;
  }

  let list = prods.filter(p => p.storeId === activeStore.id);
  if (storeCatFilter !== 'all') list = list.filter(p => p.categoryId === storeCatFilter);
  el.innerHTML = list.length
    ? list.map(renderPC).join('')
    : `<div class="store-cat-empty" style="grid-column:1/-1"><span class="store-cat-empty-ico">📦</span><div class="store-cat-empty-t">Товаров пока нет</div></div>`;
}


// ─── 10. Товары ───────────────────────────────────────────────
async function loadProds() {
  try {
    const s = await getDocs(query(collection(db, 'products'), orderBy('name')));
    prods = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}
  renderHomeProds();
  renderCatalog();
  renderHomeCats();
  renderStoreProds();
  renderStoresGrid();
}

function renderPC(p) {
  const qty     = getCartQty(p.id);
  const unavail = !p.available;
  const ic      = catIcon(p.categoryId, catName(p.categoryId));
  const imgHtml = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy">`
    : `<div style="width:64px;height:64px;opacity:.2">${ic.svg.replace('width="26" height="26"', 'width="64" height="64"')}</div>`;

  const controls = unavail
    ? `<button class="add-btn" disabled><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`
    : qty > 0
      ? `<div class="pc-qty"><button class="pc-qty-btn" onclick="event.stopPropagation();pcMinus('${p.id}')">−</button><div class="pc-qty-val">${qty}</div><button class="pc-qty-btn" onclick="event.stopPropagation();pcPlus('${p.id}')">+</button></div>`
      : `<button class="add-btn" onclick="event.stopPropagation();addToCart('${p.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;

  return `<div class="pc" onclick="openProdModal('${p.id}')">
    <div class="pc-img">${imgHtml}${unavail ? '<div class="pc-badge">Нет</div>' : ''}</div>
    <div class="pc-body">
      <div class="pc-cat">${catName(p.categoryId)}</div>
      <div class="pc-name">${p.name}</div>
      <div class="pc-desc">${p.description || ''}</div>
      <div class="pc-footer">
        <div class="pc-price">${p.price}<span> см</span></div>
        ${controls}
      </div>
    </div>
  </div>`;
}

function renderHomeProds() {
  const el = document.getElementById('home-prods');
  if (!el) return;
  const list = prods.filter(p => p.available !== false).slice(0, 8);
  el.innerHTML = list.length
    ? list.map(renderPC).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="empty-t">Товаров нет</div></div>`;
}

function renderCatalog() {
  const el = document.getElementById('cat-prods');
  if (!el) return;
  let list = [...prods];
  if (catFilter !== 'all') list = list.filter(p => p.categoryId === catFilter);
  if (searchQ) list = list.filter(p =>
    p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQ.toLowerCase())
  );
  el.innerHTML = list.length
    ? list.map(renderPC).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="empty-t">Ничего не найдено</div></div>`;
}

// Модалка товара
window.openProdModal = function (pid) {
  const p = prods.find(x => x.id === pid) || jsonProdsMap[pid];
  if (!p) return;
  renderProdModal(p);
  document.getElementById('prod-modal-bg').classList.add('open');
  document.getElementById('prod-modal-scroll').scrollTop = 0;
};

function renderProdModal(p) {
  const qty     = getCartQty(p.id);
  const unavail = p.available === false;
  const ic      = catIcon(p.categoryId, catName(p.categoryId));
  const cname   = catName(p.categoryId);
  const store   = stores.find(s => s.id === p.storeId);

  const heroHtml = p.imageUrl
    ? `<img class="pm-hero-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy">`
    : `<div class="pm-hero-ph">${ic.svg.replace('width="26" height="26"', 'width="100" height="100"')}</div>`;

  const storeBadge = store
    ? `<div class="pm-badge-store">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
        ${store.name}
       </div>`
    : '';

  const chips = [];
  if (p.weight)  chips.push({ label: p.weight + ' г' });
  if (p.volume)  chips.push({ label: p.volume + ' мл' });
  if (p.brand)   chips.push({ label: p.brand });
  if (p.country) chips.push({ label: p.country });
  if (cname && !chips.find(c => c.label === cname)) chips.unshift({ label: cname });

  const chipsHtml = chips.length
    ? `<div class="pm-chips">${chips.map(c => `<span class="pm-chip">${c.label}</span>`).join('')}</div>`
    : '';

  const buyHtml = unavail
    ? `<button class="pm-add-btn" disabled>Нет в наличии</button>`
    : qty > 0
      ? `<div class="pm-buy-wrap">
           <div class="pm-qty-box">
             <button class="pm-qty-btn" onclick="pmMinus('${p.id}')">−</button>
             <div class="pm-qty-num" id="pm-qty-${p.id}">${qty}</div>
             <button class="pm-qty-btn" onclick="pmPlus('${p.id}')">+</button>
           </div>
           <button class="pm-go-cart" onclick="closeProdModal();goPage('cart')">
             В корзину — ${p.price * qty} см
           </button>
         </div>`
      : `<button class="pm-add-btn" onclick="pmAdd('${p.id}')">Добавить в корзину</button>`;

  document.getElementById('prod-modal-inner').innerHTML = `
    <div class="pm-hero">
      ${heroHtml}
      <button class="pm-close" onclick="closeProdModal()">✕</button>
      ${unavail ? '<div class="pm-badge-unavail">Нет в наличии</div>' : ''}
      ${storeBadge}
    </div>
    <div class="pm-body">
      <div class="pm-cat-line"><div class="pm-cat-dot"></div><div class="pm-cat-lbl">${cname || 'Товары'}</div></div>
      <div class="pm-name">${p.name}</div>
      ${p.description ? `<div class="pm-desc">${p.description}</div>` : ''}
      ${chipsHtml}
      <div class="pm-div"></div>
      <div class="pm-buy-row">
        <div class="pm-price-line">
          <div class="pm-price">${p.price}</div>
          <div class="pm-price-unit">см</div>
        </div>
        ${buyHtml}
      </div>
    </div>`;
}

window.pmAdd   = async function (pid) { await addToCart(pid); const p = prods.find(x => x.id === pid); if (p) renderProdModal(p); };
window.pmPlus  = async function (pid) {
  await addToCart(pid);
  const p   = prods.find(x => x.id === pid);
  const qty = getCartQty(pid);
  const qEl = document.getElementById(`pm-qty-${pid}`);
  if (qEl) {
    qEl.textContent = qty;
    const goBtn = document.querySelector('.pm-go-cart');
    if (goBtn && p) goBtn.textContent = ` В корзину — ${p.price * qty} см`;
  } else if (p) { renderProdModal(p); }
};
window.pmMinus = async function (pid) {
  await pcMinus(pid);
  const p   = prods.find(x => x.id === pid);
  const qty = getCartQty(pid);
  if (!qty) { if (p) renderProdModal(p); return; }
  const qEl = document.getElementById(`pm-qty-${pid}`);
  if (qEl) {
    qEl.textContent = qty;
    const goBtn = document.querySelector('.pm-go-cart');
    if (goBtn && p) goBtn.textContent = ` В корзину — ${p.price * qty} см`;
  }
};

window.closeProdModal = function (e) {
  if (e && e.target !== document.getElementById('prod-modal-bg')) return;
  document.getElementById('prod-modal-bg').classList.remove('open');
};

window.pcPlus  = async function (pid) { await addToCart(pid); };
window.pcMinus = async function (pid) {
  const item = cart.find(c => c.productId === pid);
  if (!item) return;
  const nq = item.quantity - 1;
  const cr = doc(db, 'users', CU.uid, 'cart', pid);
  if (nq <= 0) {
    await deleteDoc(cr);
    cart = cart.filter(c => c.productId !== pid);
  } else {
    await updateDoc(cr, { quantity: nq, updatedAt: serverTimestamp() });
    item.quantity = nq;
  }
  renderCart(); renderHomeProds(); renderCatalog(); renderStoreProds(); updateBadges();
};


// ─── 11. Категории продуктов ──────────────────────────────────
async function loadCats() {
  try {
    const s = await getDocs(collection(db, 'categories'));
    cats = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}
  renderHomeCats();
}

function renderHomeCats() {
  const el = document.getElementById('home-cats');
  if (!el || !cats.length) return;
  el.innerHTML = cats.map(c => {
    const ic = catIcon(c.id, c.name);
    return `<button class="cat-chip" style="--cat-bg:${ic.bg}" onclick="filterCat('${c.id}');goPage('catalog')">
      <div class="cat-chip-ico">${ic.svg}</div>
      <div class="cat-chip-name">${c.name}</div>
    </button>`;
  }).join('');
}

window.filterCat = function (id) {
  catFilter = id;
  renderCatalog();
};


// ─── 12. Поиск ────────────────────────────────────────────────
window.onHomeSearch = function (v) {
  homeSearchQ = v;
  document.getElementById('search-clear')?.classList.toggle('show', v.length > 0);
  renderSD(v);
};

window.clearHS = function () {
  homeSearchQ = '';
  const inp = document.getElementById('search-inp-home');
  if (inp) inp.value = '';
  document.getElementById('search-clear')?.classList.remove('show');
  closeSD();
};

window.openSD  = function () { if (homeSearchQ) renderSD(homeSearchQ); };

function renderSD(q) {
  const dd = document.getElementById('search-dd');
  if (!q) { dd.classList.remove('open'); return; }
  const res = prods
    .filter(p => p.available !== false && (
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(q.toLowerCase())
    ))
    .slice(0, 7);

  if (!res.length) {
    dd.innerHTML = `<div class="srd-empty">Ничего не найдено 🔍</div>`;
    dd.classList.add('open');
    return;
  }
  dd.innerHTML = res.map(p => {
    const ic = catIcon(p.categoryId, catName(p.categoryId));
    return `<div class="srd-item" onclick="pickSD('${p.id}')">
      <div class="srd-img">${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : ic.svg}</div>
      <div class="srd-info"><div class="srd-name">${p.name}</div><div class="srd-cat">${catName(p.categoryId)}</div></div>
      <div class="srd-price">${p.price} см</div>
    </div>`;
  }).join('');
  dd.classList.add('open');
}

function closeSD() { document.getElementById('search-dd')?.classList.remove('open'); }

window.pickSD = function (pid) {
  closeSD(); clearHS();
  catFilter = 'all';
  searchQ   = prods.find(p => p.id === pid)?.name || '';
  renderCatalog();
  goPage('catalog');
  searchQ = '';
};

window.onSearch = function (v) { searchQ = v; renderCatalog(); if (v) goPage('catalog'); };

document.addEventListener('click', e => {
  const sb = document.getElementById('search-box');
  if (sb && !sb.contains(e.target)) closeSD();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeOrderModal(); closeProdModal(); }
});


// ─── 13. Корзина ──────────────────────────────────────────────
async function loadCart() {
  try {
    const s = await getDocs(collection(db, 'users', CU.uid, 'cart'));
    cart = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { cart = []; }
  renderCart();
  updateBadges();
}

window.addToCart = async function (pid) {
  if (!requireAuth('Войдите, чтобы добавить в корзину')) return;
  const p = prods.find(x => x.id === pid) || jsonProdsMap[pid];
  if (!p || !CU) return;

  const cr = doc(db, 'users', CU.uid, 'cart', p.id);
  const ex = cart.find(c => c.productId === p.id);
  try {
    if (ex) {
      await updateDoc(cr, { quantity: increment(1), updatedAt: serverTimestamp() });
      ex.quantity++;
    } else {
      const item = { productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl || '', quantity: 1, addedAt: serverTimestamp(), updatedAt: serverTimestamp() };
      await setDoc(cr, item);
      cart.push({ id: p.id, ...item });
    }
    toast(p.name + ' добавлен в корзину', 'ok');
    renderCart(); renderHomeProds(); renderCatalog(); renderStoreProds(); updateBadges();
  } catch { toast('Ошибка', 'err'); }
};

window.updateQty = async function (pid, d) {
  const item = cart.find(c => c.productId === pid);
  if (!item) return;
  const nq = item.quantity + d;
  const cr = doc(db, 'users', CU.uid, 'cart', pid);
  if (nq <= 0) {
    await deleteDoc(cr);
    cart = cart.filter(c => c.productId !== pid);
  } else {
    await updateDoc(cr, { quantity: nq, updatedAt: serverTimestamp() });
    item.quantity = nq;
  }
  renderCart(); updateBadges();
};

window.removeCI = async function (pid) {
  await deleteDoc(doc(db, 'users', CU.uid, 'cart', pid));
  cart = cart.filter(c => c.productId !== pid);
  renderCart(); renderHomeProds(); renderCatalog(); updateBadges();
};

window.clearCartUI = async function () {
  if (!cart.length || !confirm('Очистить корзину?')) return;
  const b = writeBatch(db);
  cart.forEach(c => b.delete(doc(db, 'users', CU.uid, 'cart', c.productId)));
  await b.commit();
  cart = [];
  renderCart(); renderHomeProds(); renderCatalog(); renderStoreProds(); updateBadges();
};

function renderCart() {
  const el = document.getElementById('cart-list');
  if (!el) return;

  if (GUEST) {
    el.innerHTML = `<div class="ci ci-empty"><div class="ci-empty-txt">
      <div class="ci-empty-t">Вы не вошли</div>
      <div class="ci-empty-s">Для использования корзины</div>
      <button class="ci-empty-btn" onclick="goLogin()">Войти</button>
    </div></div>`;
    _setCartFooter(false);
    return;
  }

  if (!cart.length) {
    el.innerHTML = `<div class="ci ci-empty"><div class="ci-empty-txt"><div class="ci-empty-t">Корзина пуста</div></div></div>`;
    _setCartFooter(false);
  } else {
    el.innerHTML = cart.map(i => {
      const ic = catIcon(i.productId, '').svg;
      return `<div class="ci">
        <div class="ci-img">${i.imageUrl ? `<img src="${i.imageUrl}" alt="">` : ic}</div>
        <div class="ci-info"><div class="ci-name">${i.name}</div><div class="ci-price">${i.price} см / шт.</div></div>
        <div class="qty">
          <button class="qty-btn" onclick="updateQty('${i.productId}',-1)">−</button>
          <div class="qty-val">${i.quantity}</div>
          <button class="qty-btn" onclick="updateQty('${i.productId}',1)">+</button>
        </div>
        <div class="ci-total">${i.price * i.quantity} см</div>
        <button class="ci-del" onclick="removeCI('${i.productId}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`;
    }).join('');
    _setCartFooter(true);
  }

  const sub = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const tot = sub + (cart.length ? DFEE : 0);
  const ci  = document.getElementById('cs-items');        if (ci) ci.textContent = sub + ' см';
  const cd  = document.getElementById('cs-del');          if (cd) cd.textContent = cart.length ? DFEE + ' см' : '0 см';
  const ct  = document.getElementById('cs-total');        if (ct) ct.textContent = tot + ' см';
  const ch  = document.getElementById('cs-header-items'); if (ch) ch.textContent = cart.length + ' позиций';
}

function _setCartFooter(active) {
  const cs = document.getElementById('cart-sum');
  const cb = document.getElementById('checkout-btn');
  if (cs) cs.style.opacity = active ? '1' : '.5';
  if (cb) cb.disabled = !active;
}

function updateBadges() {
  const cnt = cart.reduce((s, c) => s + c.quantity, 0);
  ['cart-nb', 'mob-cart-b', 'prof-cart-nb'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.style.display = cnt > 0 ? '' : 'none'; b.textContent = cnt; }
  });
  const tb = document.getElementById('tb-cnt');
  if (tb) tb.textContent = cnt;
}

function setAddr() { /* адрес выбирается через шит адресов */ }


// ─── 14. Оформление заказа ────────────────────────────────────
window.doCheckout = async function () {
  if (!requireAuth('Войдите для оформления заказа')) return;
  if (!cart.length) return;

  const addr = document.getElementById('cart-addr')?.value.trim();
  const lat  = parseFloat(document.getElementById('cart-lat')?.value) || null;
  const lng  = parseFloat(document.getElementById('cart-lng')?.value) || null;

  if (!addr) {
    toast('Укажите адрес доставки', 'err');
    document.getElementById('cart-addr')?.focus();
    return;
  }

  const btn = document.getElementById('checkout-btn');
  btn.disabled  = true;
  btn.innerHTML = '<div class="spin" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;width:14px;height:14px"></div> Оформляем…';

  try {
    const sub         = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const oNum        = nextOrderNum();
    const confirmCode = Math.floor(1000 + Math.random() * 9000).toString();
    const payMethod   = document.getElementById('cart-pay')?.value || 'cash';

    const ref = await addDoc(collection(db, 'orders'), {
      clientId:        CU.uid,
      clientName:      UD?.displayName || '',
      orderNumber:     oNum,
      confirmCode,
      items:           cart.map(c => ({
        productId: c.productId,
        name:      c.name,
        price:     c.price,
        quantity:  c.quantity,
      })),
      subtotal:        sub,
      deliveryFee:     DFEE,
      total:           sub + DFEE,
      address:         addr,
      lat,
      lng,
      comment:         document.getElementById('cart-comment')?.value.trim() || '',
      paymentMethod:   payMethod,
      deliveryService,
      status:          'pending',
      courierId:       null,
      courierName:     null,
      createdAt:       serverTimestamp(),
      updatedAt:       serverTimestamp(),
    });

    activeOid = ref.id;

    if (deliveryService === 'mavsimi') {
      _submitToMavsimi({
        orderId: ref.id, orderNumber: oNum,
        clientName: UD?.displayName || '', clientPhone: UD?.phone || '',
        items: cart.map(c => ({ name: c.name, price: c.price, quantity: c.quantity })),
        subtotal: sub, deliveryFee: DFEE, total: sub + DFEE,
        address: addr, lat, lng,
        comment: document.getElementById('cart-comment')?.value.trim() || '',
        paymentMethod: payMethod,
      }).catch(e => console.warn('[Mavsimi]', e));
    }

    // Очистка корзины
    const b = writeBatch(db);
    cart.forEach(c => b.delete(doc(db, 'users', CU.uid, 'cart', c.productId)));
    await b.commit();
    cart = [];
    renderCart(); updateBadges();

    toast('Заказ №' + oNum + ' принят! ✅', 'ok');
    await loadOrders();
    setTimeout(() => { goPage('status'); }, 420);

  } catch (e) {
    toast('Ошибка: ' + e.message, 'err');
    btn.disabled  = false;
    btn.innerHTML = 'Оформить заказ';
  }
};

/** Маvsimi — добавляем в очередь (TODO: подключить API) */
async function _submitToMavsimi(data) {
  await addDoc(collection(db, 'mavsimiQueue'), {
    ...data, synced: false, queuedAt: serverTimestamp(),
  });
}

// Шит выбора адреса в корзине — структура через sheet.js (Sheet 'caddr')
window.openCartAddrSheet = async function () {
  Sheet.open('caddr');

  const list = document.getElementById('caddrsh-list');
  if (!list) return;

  if (!CU) {
    list.innerHTML = `<div class="caddrsh-empty">Войдите, чтобы выбрать адрес<br>
      <button class="caddrsh-goto" onclick="closeCartAddrSheet();goLogin()">Войти →</button></div>`;
    return;
  }

  list.innerHTML = '<div class="caddrsh-empty">Загружается…</div>';
  try {
    const snap  = await getDocs(query(collection(db, 'users', CU.uid, 'addresses'), orderBy('createdAt', 'asc')));
    const addrs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderCartAddrList(addrs);
  } catch (e) {
    list.innerHTML = '<div class="caddrsh-empty">Ошибка загрузки</div>';
  }
};

window.closeCartAddrSheet = () => Sheet.close('caddr');

function _renderCartAddrList(addrs) {
  const list    = document.getElementById('caddrsh-list');
  if (!list) return;
  const current = document.getElementById('cart-addr')?.value || '';
  const esc     = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  if (!addrs.length) {
    list.innerHTML = `<div class="caddrsh-empty">Адресов нет<br>
      <button class="caddrsh-goto" onclick="closeCartAddrSheet();goPage('profile')">Добавить в профиле →</button></div>`;
    return;
  }

  list.innerHTML = addrs.map(a => {
    const sel = a.text === current;
    return `<button class="caddrsh-item${sel ? ' selected' : ''}"
        data-text="${escAttr(a.text)}" onclick="selectCartAddr(this.dataset.text)">
      <div class="caddrsh-item-ico">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${sel ? '#fff' : 'var(--acc)'}" stroke-width="1.8">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="caddrsh-item-text">${esc(a.text)}</div>
      <div class="caddrsh-item-check">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    </button>`;
  }).join('');
}

window.selectCartAddr = function (text) {
  const inp = document.getElementById('cart-addr');
  if (inp) inp.value = text;
  const display = document.getElementById('cart-addr-display');
  if (display) display.textContent = text;
  const card = document.getElementById('cart-addr-card');
  if (card) card.classList.add('filled');
  closeCartAddrSheet();
};


// ─── 15. Заказы ───────────────────────────────────────────────
async function loadOrders() {
  try {
    const q = query(collection(db, 'orders'), where('clientId', '==', CU.uid), orderBy('createdAt', 'desc'));
    const s = await getDocs(q);
    orders  = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const q2 = query(collection(db, 'orders'), where('clientId', '==', CU.uid));
      const s2 = await getDocs(q2);
      orders   = s2.docs.map(d => ({ id: d.id, ...d.data() }));
      orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    } catch { orders = []; }
  }

  const live = orders.find(o => ['pending', 'confirmed', 'preparing', 'delivering'].includes(o.status));
  if (live) { activeOid = live.id; if (!unsubLive) listenLive(live.id); }

  renderOrders();
  renderOrdersBadge();
  renderLiveBanner();
  if (document.getElementById('page-status')?.classList.contains('active')) renderStatusPage();

  const tot   = orders.length;
  const spent = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const po = document.getElementById('ps-orders'); if (po) po.textContent = tot;
  const ps = document.getElementById('ps-spent');  if (ps) ps.textContent = spent;
}

function showOrdersSkeleton() {
  const el = document.getElementById('orders-list');
  if (!el) return;
  const card = (w1, w2, w3, w4) =>
    `<div class="oc oc-skl">
      <div class="oc-head">
        <div class="skl-block" style="height:11px;width:${w1}%;border-radius:6px"></div>
        <div class="skl-block" style="height:20px;width:${w2}px;border-radius:99px"></div>
      </div>
      <div class="skl-block" style="height:8px;width:${w3}%;margin-bottom:6px"></div>
      <div class="skl-block" style="height:8px;width:${w4}%;margin-bottom:13px"></div>
    </div>`;
  el.innerHTML = [card(50, 82, 82, 58), card(44, 76, 76, 64), card(54, 90, 70, 52)].join('');
}

window.setOTab = function (tab, btn) {
  currentOTab = tab;
  document.querySelectorAll('.otab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrders();
};

function filterOrders() {
  if (currentOTab === 'active')    return orders.filter(o => ['pending','confirmed','preparing','delivering'].includes(o.status));
  if (currentOTab === 'delivered') return orders.filter(o => o.status === 'delivered');
  if (currentOTab === 'cancelled') return orders.filter(o => o.status === 'cancelled');
  return orders;
}

function renderOrders() {
  const el   = document.getElementById('orders-list');
  if (!el) return;
  const list = filterOrders();
  if (!list.length) {
    el.innerHTML = '<div class="empty"><span class="empty-ico">📦</span><div class="empty-t">Заказов нет</div></div>';
    return;
  }
  el.innerHTML = list.map(o => {
    const c        = SC[o.status] || '#888';
    const l        = SL[o.status] || o.status;
    const num      = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
    const items    = (o.items || []).map(i => `${i.name} ×${i.quantity}`).join(', ');
    const isActive = ['pending','confirmed','preparing','delivering'].includes(o.status);
    return `<div class="oc st-${o.status}" onclick="openOrderModal('${o.id}')" style="cursor:pointer">
      <div class="oc-head">
        <div class="oc-num">Заказ ${num}</div>
        <div class="oc-status" style="color:${c};border-color:${c}30;background:${c}10">${l}</div>
      </div>
      <div class="oc-items">${items}</div>
      <div class="oc-footer">
        <div><div class="oc-total">${o.total} см</div><div class="oc-meta">${fmtDate(o.createdAt)} · ${o.address || ''}</div></div>
        <div class="oc-actions" onclick="event.stopPropagation()">
          ${isActive ? `<div style="width:7px;height:7px;border-radius:50%;background:${c};animation:rpulse 2s infinite;flex-shrink:0"></div>` : ''}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderOrdersBadge() {
  const act = orders.filter(o => ['pending','confirmed','preparing','delivering'].includes(o.status)).length;
  ['orders-nb', 'mob-ord-b', 'prof-orders-nb'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.style.display = act > 0 ? '' : 'none'; b.textContent = act; }
  });
}

window.openOrderModal = function (oid) {
  const o = orders.find(x => x.id === oid);
  if (!o) return;

  const num      = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
  const c        = SC[o.status] || '#888';
  const l        = SL[o.status] || o.status;
  const si       = STEPS.indexOf(o.status);
  const pay      = { cash: 'Наличные 💵', card: 'Карта 💳', online: 'Онлайн 📱' }[o.paymentMethod] || o.paymentMethod;
  const isActive = ['pending','confirmed','preparing','delivering'].includes(o.status);
  const sub      = (o.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const delivery = o.total - sub;

  const stepIcons = ['⏳','✅','👨‍🍳','🛵','🎉'];
  const stepSubs  = ['Заказ принят','Подтверждение','Повар готовит','Курьер в пути','Доставлен'];
  const timeline  = STEPS.map((s, i) => {
    const cls = i < si ? 'done' : i === si ? 'cur' : '';
    return `<div class="o-track-step ${cls}">
      <div class="o-track-dot">${i <= si ? stepIcons[i] : ''}</div>
      <div class="o-track-info">
        <div class="o-track-title">${SL[s]}</div>
        <div class="o-track-sub">${i < si ? 'Завершён ✓' : stepSubs[i]}</div>
      </div>
    </div>`;
  }).join('');

  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent('GAL-' + o.id)}&color=1a9e4a&bgcolor=ffffff&margin=8&format=png`;
  const itemsHtml = (o.items || []).map(i =>
    `<div class="receipt-row">
      <span class="receipt-row-name">${i.name}</span>
      <span class="receipt-row-qty">×${i.quantity}</span>
      <span class="receipt-row-price">${i.price * i.quantity} см</span>
    </div>`
  ).join('');

  document.getElementById('order-modal-title').textContent = `Заказ ${num}`;
  document.getElementById('order-modal-body').innerHTML = `
    <div style="margin:14px 0 4px">
      <button onclick="closeOrderModal();viewOrderStatus('${o.id}')" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:14px;color:#fff;font-family:var(--fd);font-weight:900;font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
        Посмотреть статус заказа
      </button>
    </div>
    <div class="receipt">
      <div class="receipt-top">
        <div class="receipt-brand">dastdaroz Delivery</div>
        <div class="receipt-order-num">Заказ ${num}</div>
        <div class="receipt-status-row">
          <div class="receipt-status-dot" style="background:${c}"></div>
          <div class="receipt-status-lbl">${l}</div>
        </div>
      </div>
      <div class="receipt-body">
        <div class="receipt-section">
          <div class="receipt-section-title">Состав</div>
          ${itemsHtml}
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-section">
          <div class="receipt-total-row"><span>Товары</span><span>${sub} см</span></div>
          <div class="receipt-total-row"><span>Доставка</span><span>${delivery > 0 ? delivery : DFEE} см</span></div>
          <div class="receipt-divider" style="margin:8px 0"></div>
          <div class="receipt-total-row big"><span>Итого</span><span>${o.total} см</span></div>
        </div>
        <div class="receipt-section">
          <div class="receipt-section-title">Информация</div>
          <div class="receipt-info-grid">
            <div class="receipt-info-item"><div class="receipt-info-label">Адрес</div><div class="receipt-info-val">${o.address || '—'}</div></div>
            <div class="receipt-info-item"><div class="receipt-info-label">Оплата</div><div class="receipt-info-val">${pay}</div></div>
            <div class="receipt-info-item"><div class="receipt-info-label">Курьер</div><div class="receipt-info-val">${o.courierName || 'Назначается…'}</div></div>
            <div class="receipt-info-item"><div class="receipt-info-label">Время</div><div class="receipt-info-val">${fmtDate(o.createdAt)}</div></div>
          </div>
          ${o.comment ? `<div class="receipt-info-item" style="margin-top:10px"><div class="receipt-info-label">Комментарий</div><div class="receipt-info-val">${o.comment}</div></div>` : ''}
        </div>
        <div class="receipt-qr-wrap">
          <div class="receipt-qr"><img src="${qrUrl}" alt="QR" loading="lazy"></div>
          <div class="receipt-qr-hint">Код · GAL-${o.id.slice(-8).toUpperCase()}</div>
        </div>
      </div>
      <div class="receipt-footer">
        <div class="receipt-footer-brand">dastdaroz Delivery</div>
        <div class="receipt-footer-ts">${fmtDate(o.createdAt)}</div>
      </div>
    </div>
    ${['pending','confirmed'].includes(o.status) ? `
    <div style="margin-top:4px;margin-bottom:8px">
      <button class="btn-sm danger" style="width:100%;padding:10px;font-size:.64rem" onclick="cancelO('${o.id}');closeOrderModal()">Отменить заказ</button>
    </div>` : ''}`;

  document.getElementById('order-modal-bg').classList.add('open');
  if (isActive && activeOid !== o.id) { activeOid = o.id; listenLive(o.id); }
};

window.closeOrderModal = function (e) {
  if (e && e.target !== document.getElementById('order-modal-bg')) return;
  document.getElementById('order-modal-bg').classList.remove('open');
};

window.viewOrderStatus = function (oid) { activeOid = oid; goPage('status'); renderStatusPage(); };
window.trackO          = function (oid) { activeOid = oid; goPage('status'); renderStatusPage(); };

window.cancelO = async function (id) {
  if (!confirm('Отменить заказ?')) return;
  try {
    await updateDoc(doc(db, 'orders', id), { status: 'cancelled', updatedAt: serverTimestamp() });
    toast('Заказ отменён', 'ok');
    await loadOrders();
  } catch { toast('Ошибка', 'err'); }
};

function renderLiveBanner() {
  const wrap = document.getElementById('live-wrap');
  if (!wrap) return;
  const live = orders.find(o => ['pending','confirmed','preparing','delivering'].includes(o.status));
  if (!live) { wrap.innerHTML = ''; return; }
  const num = live.orderNumber ? '#' + live.orderNumber : '#' + live.id.slice(-6);
  wrap.innerHTML = `<div class="live-banner" onclick="trackO('${live.id}')">
    <div class="live-pulse"></div>
    <div class="live-info">
      <div class="live-lbl">Активный заказ</div>
      <div class="live-txt">Заказ ${num} · ${SL[live.status]} · ${live.total} см</div>
    </div>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
  </div>`;
}

function listenLive(oid) {
  if (unsubLive) { unsubLive(); unsubLive = null; }
  unsubLive = onSnapshot(doc(db, 'orders', oid), snap => {
    if (!snap.exists()) return;
    const o   = { id: snap.id, ...snap.data() };
    const idx = orders.findIndex(x => x.id === oid);
    if (idx >= 0) orders[idx] = o; else orders.unshift(o);
    if (activeOid === oid || !activeOid) activeOid = oid;
    renderOrders(); renderOrdersBadge(); renderLiveBanner();
    if (document.getElementById('page-status')?.classList.contains('active')) renderStatusPage();

    const modalBg = document.getElementById('order-modal-bg');
    if (modalBg?.classList.contains('open')) {
      const num = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
      if (document.getElementById('order-modal-title')?.textContent.includes(num.replace('#', ''))) {
        openOrderModal(oid);
      }
    }
    if (['delivered', 'cancelled'].includes(o.status)) {
      if (unsubLive) { unsubLive(); unsubLive = null; }
      if (o.status === 'delivered') toast('🎉 Заказ доставлен!', 'ok');
    }
  });
}


// ─── 16. Статус заказа + Leaflet карта ───────────────────────
let _trackMap          = null;
let _trackMarkerDest   = null;
let _trackMarkerCour   = null;
let _trackRouteLine    = null;
let _trackCourierUnsub = null;
let _trackCourierId    = null;
let _trackFitted       = false;
let _trackLastOid      = null;

const ICO_DEST    = '<div class="smap-marker-dest"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6"><circle cx="12" cy="12" r="3"/></svg></div>';
const ICO_COURIER = '<div class="smap-marker-courier"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg></div>';

function mkTrackIcon(html, size) {
  return L.divIcon({ html, className: 'smap-marker-wrap', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderStatusMap(o) {
  const card = document.getElementById('status-map-card');
  const info = document.getElementById('status-map-info');
  if (!card) return;

  const TERMINAL = ['delivered', 'cancelled'];
  const showMap  = o && o.lat != null && o.lng != null && !!o.courierId && !TERMINAL.includes(o.status);

  if (!showMap) {
    card.style.display = 'none';
    if (info) info.style.display = 'none';
    stopCourierTracking();
    return;
  }

  if (_trackLastOid !== o.id) { _trackLastOid = o.id; _trackFitted = false; }
  card.style.display = 'block';

  if (!_trackMap) {
    _trackMap = L.map('status-map', { center: [o.lat, o.lng], zoom: 15, zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_trackMap);
  }
  setTimeout(() => _trackMap && _trackMap.invalidateSize(), 60);

  if (!_trackMarkerDest) {
    _trackMarkerDest = L.marker([o.lat, o.lng], { icon: mkTrackIcon(ICO_DEST, 28), zIndexOffset: 400 }).addTo(_trackMap);
  } else {
    _trackMarkerDest.setLatLng([o.lat, o.lng]);
  }

  if (_trackCourierId !== o.courierId) {
    stopCourierTracking();
    _trackCourierId    = o.courierId;
    _trackCourierUnsub = onSnapshot(doc(db, 'couriers', o.courierId), snap => {
      if (!snap.exists()) return;
      const loc = snap.data()?.location;
      if (loc?.lat != null && loc?.lng != null) updateCourierOnMap(o, loc.lat, loc.lng);
    });
  }

  if (info) info.style.display = 'flex';
}

function updateCourierOnMap(o, lat, lng) {
  if (!_trackMap) return;
  if (!_trackMarkerCour) {
    _trackMarkerCour = L.marker([lat, lng], { icon: mkTrackIcon(ICO_COURIER, 30), zIndexOffset: 800 }).addTo(_trackMap);
  } else {
    _trackMarkerCour.setLatLng([lat, lng]);
  }
  const pts = [[lat, lng], [o.lat, o.lng]];
  if (!_trackRouteLine) {
    _trackRouteLine = L.polyline(pts, { color: '#1a9e4a', weight: 3.5, opacity: .75, dashArray: '8 10' }).addTo(_trackMap);
  } else {
    _trackRouteLine.setLatLngs(pts);
  }
  if (!_trackFitted) {
    try { _trackMap.fitBounds(_trackRouteLine.getBounds(), { padding: [34, 34] }); } catch {}
    _trackFitted = true;
  }
  const dist    = haversineKm(lat, lng, o.lat, o.lng);
  const distTxt = dist < 1 ? Math.round(dist * 1000) + ' м' : dist.toFixed(1) + ' км';
  const nameEl  = document.getElementById('status-map-info-name');
  const distEl  = document.getElementById('status-map-info-dist');
  if (nameEl) nameEl.textContent = o.courierName || 'Курьер';
  if (distEl) distEl.textContent = distTxt;
}

function stopCourierTracking() {
  if (_trackCourierUnsub) { _trackCourierUnsub(); _trackCourierUnsub = null; }
  _trackCourierId = null;
  if (_trackMarkerCour) { _trackMarkerCour.remove(); _trackMarkerCour = null; }
  if (_trackRouteLine)  { _trackRouteLine.remove();  _trackRouteLine  = null; }
}

function renderStatusPage() {
  const el = document.getElementById('status-content');
  if (!el) return;

  let o = null;
  if (activeOid) o = orders.find(x => x.id === activeOid);
  if (!o) o = orders.find(x => ['pending','confirmed','preparing','delivering'].includes(x.status));
  if (!o && orders.length) o = orders[0];

  try { renderStatusMap(o); } catch (e) { console.warn('[renderStatusMap]', e); }

  if (!o) {
    el.innerHTML = '<div class="empty"><span class="empty-ico">📍</span><div class="empty-t">Нет активных заказов</div><div class="empty-s">После оформления появится здесь</div></div>';
    return;
  }

  const c    = SC[o.status] || '#888';
  const l    = SL[o.status] || o.status;
  const si   = STEPS.indexOf(o.status);
  const num  = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
  const pay  = { cash: 'Наличные', card: 'Карта', online: 'Онлайн' }[o.paymentMethod] || o.paymentMethod;

  const checkIco = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
  const steps = STEPS.map((s, i) => {
    const cls = i < si ? 'done' : i === si ? 'cur' : '';
    return `<div class="track-step ${cls}"><div class="track-dot">${i < si ? checkIco : ''}</div><div class="track-lbl">${SL[s]}</div></div>`;
  }).join('');

  el.innerHTML = `<div class="oc st-${o.status}" style="padding:18px 20px">
    <div class="oc-head"><div class="oc-num">Заказ ${num}</div><div class="oc-status" style="color:${c};border-color:${c}30;background:${c}10">${l}</div></div>
    <div class="track">${steps}</div>
    <div class="divider"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:.76rem">
      <div><div class="sh-tag" style="margin-bottom:3px">Адрес</div><div style="color:var(--tx)">${o.address || '—'}</div></div>
      <div><div class="sh-tag" style="margin-bottom:3px">Оплата</div><div style="color:var(--tx)">${pay}</div></div>
      <div><div class="sh-tag" style="margin-bottom:3px">Курьер</div><div style="color:var(--tx)">${o.courierName || 'Назначается…'}</div></div>
      <div><div class="sh-tag" style="margin-bottom:3px">Время</div><div style="color:var(--tx)">${fmtDate(o.createdAt)}</div></div>
    </div>
    ${o.courierId ? `
    <button class="chat-trigger" onclick="openChat('${o.id}')">
      <div class="chat-trigger-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg></div>
      <div class="chat-trigger-body">
        <div class="chat-trigger-title">Чат с курьером</div>
        <div class="chat-trigger-sub">${escHtml(o.courierName || 'Курьер')} — напишите если есть вопросы</div>
      </div>
      ${o.clientUnread > 0 ? `<div class="chat-trigger-badge">${o.clientUnread}</div>` : '<svg class="chat-trigger-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>'}
    </button>` : ''}
    <div class="divider"></div>
    <div class="sh-tag" style="margin-bottom:10px">Состав</div>
    ${(o.items || []).map(i =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--b0);font-size:.75rem">
        <span>${escHtml(i.name)} <span style="color:var(--tx3)">×${i.quantity}</span></span>
        <span style="font-weight:600">${i.price * i.quantity} см</span>
      </div>`
    ).join('')}
    <div style="display:flex;justify-content:space-between;font-size:.72rem;padding:8px 0;color:var(--tx3)"><span>Доставка</span><span>${DFEE} см</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--b0)">
      <span style="font-weight:700;font-size:.8rem">Итого</span>
      <span style="font-family:var(--fd);font-weight:900;font-size:1.15rem;color:var(--acc)">${o.total} см</span>
    </div>
    ${['pending','confirmed'].includes(o.status) ? `
    <div style="margin-top:14px"><button class="btn-sm danger" onclick="cancelO('${o.id}')">Отменить заказ</button></div>` : ''}
    ${o.confirmCode && o.status !== 'cancelled' ? `
    <div style="margin-top:18px;background:rgba(26,158,74,.06);border:2px solid rgba(26,158,74,.18);border-radius:18px;padding:20px;text-align:center">
      <div style="font-size:.55rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);margin-bottom:10px">Код подтверждения</div>
      <div style="font-family:var(--fd);font-weight:900;font-size:3.4rem;color:var(--tx);letter-spacing:.22em">${o.confirmCode}</div>
      <div style="font-size:.62rem;color:var(--tx3);margin-top:10px">Скажите этот код курьеру при получении</div>
    </div>` : ''}
  </div>`;
}


// ─── 17. Чат с курьером ───────────────────────────────────────
let chatOid      = null;
let chatUnsub    = null;
let chatMessages = [];

window.openChat = async function (oid) {
  const o = orders.find(x => x.id === oid);
  if (!o) return;
  chatOid = oid;
  document.getElementById('chat-modal-bg')?.classList.add('open');

  const nameEl = document.getElementById('chat-modal-name');
  if (nameEl) nameEl.textContent = o.courierName || 'Курьер';
  const avEl = document.getElementById('chat-modal-av');
  if (avEl) avEl.textContent = (o.courierName || 'К').charAt(0).toUpperCase();
  const subEl = document.getElementById('chat-modal-sub');
  if (subEl) subEl.textContent = 'Заказ ' + (o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6));

  try { await updateDoc(doc(db, 'orders', oid), { clientUnread: 0 }); } catch {}
  listenChatMessages(oid);
  setTimeout(() => document.getElementById('chat-input')?.focus(), 350);
};

window.closeChat = function () {
  document.getElementById('chat-modal-bg')?.classList.remove('open');
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  chatOid      = null;
  chatMessages = [];
};

function listenChatMessages(oid) {
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  const q = query(collection(db, 'orders', oid, 'messages'), orderBy('createdAt', 'asc'));
  chatUnsub = onSnapshot(q, snap => {
    chatMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderChatMessages();
  });
}

function renderChatMessages() {
  const wrap = document.getElementById('chat-messages');
  if (!wrap) return;
  if (!chatMessages.length) {
    wrap.innerHTML = `<div class="chat-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
      <div class="chat-empty-t">Сообщений пока нет</div>
      <div class="chat-empty-s">Напишите курьеру, если есть вопросы</div>
    </div>`;
    return;
  }
  wrap.innerHTML = chatMessages.map(m => {
    const mine = m.senderRole === 'client';
    const time = m.createdAt?.toDate
      ? m.createdAt.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="chat-msg ${mine ? 'chat-msg-me' : 'chat-msg-them'}">${escHtml(m.text)}<span class="chat-msg-time">${time}</span></div>`;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

window.sendChatMsg = async function () {
  const inp = document.getElementById('chat-input');
  if (!inp || !chatOid) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = 'auto';
  const btn = document.getElementById('chat-send-btn');
  if (btn) btn.disabled = true;
  try {
    await addDoc(collection(db, 'orders', chatOid, 'messages'), {
      text, senderId: CU.uid, senderRole: 'client',
      senderName: UD?.displayName || 'Клиент', createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'orders', chatOid), {
      courierUnread: increment(1), lastMessage: text.slice(0, 120),
      lastMessageAt: serverTimestamp(), lastMessageSenderRole: 'client',
    });
  } catch { toast('Ошибка отправки', 'err'); }
  if (btn) btn.disabled = false;
  inp.focus();
};


// ─── 18. Техническая поддержка ────────────────────────────────
let _supChatId          = null;
let _unsubSupMsgs       = null;
let _supSelectedOrder   = null;
let _supOrdersCache     = [];
let _supOrderPickerOpen = false;
let _supBadgeUnsub      = null;

window.openSupport = function () {
  if (!CU) return;
  document.getElementById('supsh-ov')?.classList.add('open');
  document.getElementById('supsh')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  _supChatId = CU.uid;
  _listenSupportChatUser();
  _loadSupportOrders();
};

window.closeSupport = function () {
  document.getElementById('supsh-ov')?.classList.remove('open');
  document.getElementById('supsh')?.classList.remove('open');
  document.body.style.overflow = '';
  if (_unsubSupMsgs) { _unsubSupMsgs(); _unsubSupMsgs = null; }
};

function _listenSupportChatUser() {
  if (_unsubSupMsgs) _unsubSupMsgs();
  if (!_supChatId) return;
  const q = query(collection(db, 'supportChats', _supChatId, 'messages'), orderBy('createdAt', 'asc'));
  _unsubSupMsgs = onSnapshot(q, snap => {
    _renderSupportMsgsUser(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    updateDoc(doc(db, 'supportChats', _supChatId), { userUnread: 0 }).catch(() => {});
  }, () => {});
}

function _renderSupportMsgsUser(msgs) {
  const el = document.getElementById('supsh-msgs');
  if (!el) return;
  if (!msgs.length) {
    el.innerHTML = `<div class="supsh-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <div class="supsh-empty-t">Нет сообщений</div>
      <div class="supsh-empty-s">Напишите нам — ответим быстро</div>
    </div>`;
    return;
  }
  el.innerHTML = msgs.map(m => {
    const isMe = m.senderRole === 'user';
    const time = m.createdAt?.toDate
      ? m.createdAt.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="supsh-msg ${isMe ? 'supsh-msg-me' : 'supsh-msg-them'}">
      ${!isMe && m.senderName ? `<span class="supsh-msg-name">${escHtml(m.senderName)}</span>` : ''}
      ${escHtml(m.text)}<span class="supsh-msg-time">${time}</span>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function _loadSupportOrders() {
  if (!CU) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'orders'), where('clientId', '==', CU.uid), orderBy('createdAt', 'desc'), limit(10))
    );
    _supOrdersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { _supOrdersCache = []; }
  _renderSupOrderPicker();
}

function _renderSupOrderPicker() {
  const el = document.getElementById('supsh-order-picker');
  if (!el) return;
  const noSel = _supSelectedOrder === null;

  let html = `<button class="supsh-order-item ${noSel ? 'selected' : ''}" onclick="selectSupportOrder(null,null)">
    <div class="supsh-order-item-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${noSel ? '#fff' : 'currentColor'}" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></div>
    <div class="supsh-order-item-body"><div class="supsh-order-item-num">Без заказа</div><div class="supsh-order-item-meta">Общий вопрос</div></div>
    ${noSel ? '<svg class="supsh-order-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
  </button>`;

  _supOrdersCache.forEach(o => {
    const sel  = _supSelectedOrder === o.id;
    const num  = o.orderNumber || o.id.slice(-6).toUpperCase();
    const date = o.createdAt?.toDate
      ? o.createdAt.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
      : '';
    html += `<button class="supsh-order-item ${sel ? 'selected' : ''}" onclick="selectSupportOrder('${o.id}','${escHtml(num)}')">
      <div class="supsh-order-item-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${sel ? '#fff' : 'currentColor'}" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg></div>
      <div class="supsh-order-item-body"><div class="supsh-order-item-num">#${escHtml(num)}</div><div class="supsh-order-item-meta">${date}</div></div>
      ${sel ? '<svg class="supsh-order-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    </button>`;
  });
  el.innerHTML = html;
}

window.toggleSupportOrderPicker = function () {
  _supOrderPickerOpen = !_supOrderPickerOpen;
  document.getElementById('supsh-order-picker')?.classList.toggle('open', _supOrderPickerOpen);
  const btn = document.getElementById('supsh-order-btn');
  if (btn) btn.textContent = _supOrderPickerOpen ? 'Закрыть' : 'Выбрать';
};

window.selectSupportOrder = function (orderId, orderNum) {
  _supSelectedOrder = orderId;
  const valEl = document.getElementById('supsh-order-val');
  if (valEl) {
    valEl.textContent = orderId ? `#${orderNum}` : 'Без заказа';
    valEl.classList.toggle('has-order', !!orderId);
  }
  _renderSupOrderPicker();
  if (_supOrderPickerOpen) toggleSupportOrderPicker();
};

window.sendSupportMsg = async function () {
  if (!CU) return;
  const inp = document.getElementById('supsh-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = 'auto';

  _supChatId = CU.uid;
  const chatData = {
    userId:                CU.uid,
    userName:              CU.displayName || 'Пользователь',
    lastMessage:           text.slice(0, 120),
    lastMessageAt:         serverTimestamp(),
    lastMessageSenderRole: 'user',
    adminUnread:           increment(1),
    userUnread:            0,
    updatedAt:             serverTimestamp(),
  };
  if (_supSelectedOrder) {
    const order = _supOrdersCache.find(o => o.id === _supSelectedOrder);
    if (order) { chatData.orderId = order.id; chatData.orderNumber = order.orderNumber || order.id.slice(-6).toUpperCase(); }
  }
  try {
    await setDoc(doc(db, 'supportChats', _supChatId), chatData, { merge: true });
    await addDoc(collection(db, 'supportChats', _supChatId, 'messages'), {
      text, senderId: CU.uid, senderRole: 'user',
      senderName: CU.displayName || 'Пользователь', createdAt: serverTimestamp(),
    });
  } catch { toast('Ошибка отправки', 'err'); }
};

function listenSupportBadge() {
  if (_supBadgeUnsub) { _supBadgeUnsub(); _supBadgeUnsub = null; }
  if (!CU) return;
  _supBadgeUnsub = onSnapshot(doc(db, 'supportChats', CU.uid), snap => {
    _updateSupportBadge(snap.exists() ? (snap.data().userUnread || 0) : 0);
  }, () => {});
}

function _updateSupportBadge(count) {
  ['support-nb', 'prof-support-nb', 'support-entry-badge', 'mob-prof-b'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = count > 0 ? 'flex' : 'none'; el.textContent = count; }
  });
}


// ─── 19. Профиль ──────────────────────────────────────────────
function showProfContent() {
  document.getElementById('prof-card-loading')?.remove();
  document.getElementById('prof-content-loading')?.remove();
  const rc = document.getElementById('prof-real-content');
  if (rc) rc.style.display = '';
}

function renderProfile() {
  showProfContent();
  const name  = UD?.displayName || CU.displayName || '';
  const init  = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const phone = UD?.phone || phoneFromPseudoEmail(CU.email);

  document.getElementById('p-name')?.textContent  && (document.getElementById('p-name').textContent  = name || 'Без имени');
  document.getElementById('p-phone')?.textContent && (document.getElementById('p-phone').textContent = phone || '—');

  const av = document.getElementById('p-av');
  if (av) av.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;

  document.getElementById('pf-name')  && (document.getElementById('pf-name').value  = name);
  document.getElementById('pf-phone') && (document.getElementById('pf-phone').value = phone);

  const _wbFmt = _fmtBal(UD?.walletBalance || 0);
  document.querySelectorAll('.prof-wallet-bal').forEach(el => {
    el.textContent = _wbFmt.whole + '.' + _wbFmt.cents + ' см';
  });
}

function renderGuestProfile() {
  showProfContent();
  const av = document.getElementById('sb-av');
  if (av) av.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  const nm = document.getElementById('sb-uname');
  if (nm) nm.textContent = 'Гость';

  const profUserSection = document.getElementById('prof-user-section');
  if (profUserSection) {
    profUserSection.innerHTML = `
      <div style="max-width:400px;margin:24px auto 60px;text-align:center;padding:0 4px">
        <div style="width:80px;height:80px;border-radius:50%;background:var(--accd);border:3px solid var(--accg);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;color:var(--acc)">👤</div>
        <div style="font-family:var(--fd);font-weight:900;font-size:1.3rem;color:var(--tx);margin-bottom:8px">Гостевой режим</div>
        <div style="font-size:.8rem;color:var(--tx3);line-height:1.6;margin-bottom:28px">Для просмотра профиля и истории заказов войдите или зарегистрируйтесь.</div>
        <button onclick="goLogin()" style="background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:12px;color:#fff;font-size:.78rem;font-family:var(--fd);font-weight:800;padding:13px 32px;cursor:pointer;width:100%;max-width:260px">
          Войти / Зарегистрироваться
        </button>
      </div>`;
  }

  const ordPage = document.getElementById('page-orders');
  if (ordPage) {
    ordPage.innerHTML = `<div style="text-align:center;padding:60px 20px">
      <div style="font-size:3rem;margin-bottom:14px">📋</div>
      <div style="font-family:var(--fd);font-weight:900;font-size:1.1rem;color:var(--tx);margin-bottom:8px">Заказы недоступны</div>
      <div style="font-size:.76rem;color:var(--tx3);margin-bottom:24px">Войдите, чтобы увидеть историю заказов</div>
      <button onclick="goLogin()" style="background:var(--acc);border:none;border-radius:10px;color:#fff;font-size:.74rem;font-family:var(--fs);font-weight:700;padding:10px 28px;cursor:pointer">Войти</button>
    </div>`;
  }
}

window.saveProfile = async function () {
  const name = document.getElementById('pf-name')?.value.trim();
  try {
    const saveData = {
      displayName: name,
      updatedAt:   serverTimestamp(),
    };
    await setDoc(doc(db, 'users', CU.uid), saveData, { merge: true });
    UD = { ...UD, ...saveData };
    renderSB(); renderProfile();
    toast('Профиль сохранён', 'ok');
  } catch { toast('Ошибка', 'err'); }
};

window.uploadAvUI = async function (inp) {
  const f = inp.files[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { toast('Файл слишком большой (макс 2 МБ)', 'err'); return; }
  toast('Загрузка…');
  try {
    const sr  = sRef(storage, `avatars/${CU.uid}`);
    await uploadBytes(sr, f);
    const url = await getDownloadURL(sr);
    await setDoc(doc(db, 'users', CU.uid), { avatarUrl: url, updatedAt: serverTimestamp() }, { merge: true });
    UD.avatarUrl = url;
    renderSB(); renderProfile();
    toast('Фото обновлено', 'ok');
  } catch { toast('Ошибка загрузки', 'err'); }
};


// ─── 20. Адреса профиля ───────────────────────────────────────
let _profAddrs = [];

window.openAddrModal      = function () { openProfAddrModal(); };

window.openProfileAddrs = async function () {
  if (!requireAuth('Войдите, чтобы добавить адрес')) return;
  document.getElementById('paddr-bg')?.classList.add('open');
  await _loadProfAddrs();
};

window.closeProfileAddrs = function () {
  document.getElementById('paddr-bg')?.classList.remove('open');
};

async function _loadProfAddrs() {
  if (!CU) return;
  try {
    const snap = await getDocs(query(collection(db, 'users', CU.uid, 'addresses'), orderBy('createdAt', 'asc')));
    _profAddrs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderProfAddrs();
  } catch (e) { console.error('ProfAddrs:', e); }
}

function _renderProfAddrs() {
  const list = document.getElementById('paddr-list');
  if (!list) return;
  const esc  = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  list.innerHTML = !_profAddrs.length
    ? '<div class="paddr-empty">Адресов нет</div>'
    : _profAddrs.map(a => `
      <div class="paddr-item">
        <div class="paddr-item-ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
        <div class="paddr-item-text">${esc(a.text)}</div>
        <button class="paddr-item-del" onclick="deleteProfAddr('${a.id}')" title="Удалить">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`).join('');

  const sub = document.getElementById('prof-addr-display');
  if (sub) {
    sub.textContent     = _profAddrs.length > 0 ? _profAddrs[0].text : 'Указать адрес →';
    sub.style.color     = _profAddrs.length > 0 ? 'var(--tx2)' : 'var(--acc)';
    sub.style.fontWeight = _profAddrs.length > 0 ? '500' : '600';
  }
}

// addaddr — структура через sheet.js (Sheet 'addaddr')
window.openAddAddrSheet = function () {
  const inp = document.getElementById('addaddr-inp');
  if (inp) inp.value = '';
  Sheet.open('addaddr');
  setTimeout(() => document.getElementById('addaddr-inp')?.focus(), 320);
};

window.closeAddAddrSheet = () => Sheet.close('addaddr');

window.saveProfileAddr = async function () {
  if (!CU) return;
  const text = document.getElementById('addaddr-inp')?.value.trim();
  if (!text) { toast('Введите адрес', 'warn'); return; }
  const btn = document.getElementById('addaddr-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await addDoc(collection(db, 'users', CU.uid, 'addresses'), { text, createdAt: serverTimestamp() });
    closeAddAddrSheet();
    toast('Адрес добавлен', 'ok');
    await _loadProfAddrs();
  } catch { toast('Ошибка сохранения', 'err'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; } }
};

window.deleteProfAddr = async function (id) {
  if (!CU) return;
  try {
    await deleteDoc(doc(db, 'users', CU.uid, 'addresses', id));
    await _loadProfAddrs();
  } catch { toast('Ошибка удаления', 'err'); }
};

function checkAddressBanner(uid) {
  if (_addrBannerUnsub) { _addrBannerUnsub(); _addrBannerUnsub = null; }
  if (!uid) {
    window.dispatchEvent(new CustomEvent('appDataLoaded', { detail: { hasAddress: false } }));
    return;
  }
  const q = query(collection(db, 'users', uid, 'addresses'));
  _addrBannerUnsub = onSnapshot(q,
    snap  => window.dispatchEvent(new CustomEvent('appDataLoaded', { detail: { hasAddress: !snap.empty } })),
    _err  => window.dispatchEvent(new CustomEvent('appDataLoaded', { detail: { hasAddress: true } }))
  );
}


// ─── 21. Кошелёк ──────────────────────────────────────────────
let _wltTxs = [];

function _renderWltBal(n) {
  const { whole, cents } = _fmtBal(n);
  const el = document.getElementById('wlt-bal-num');
  if (el) el.innerHTML = whole + '<span class="wlt-bal-cents">.' + cents + '</span>';
}

window.openWallet = async function () {
  if (!requireAuth('Войдите для доступа к кошельку')) return;
  const av = document.getElementById('wlt-av');
  if (av) {
    const name = UD?.displayName || '';
    const init = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    av.innerHTML = UD?.avatarUrl
      ? `<img src="${UD.avatarUrl}" alt="">`
      : init || `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>`;
  }
  _renderWltBal(UD?.walletBalance || 0);
  document.getElementById('wlt-overlay')?.classList.add('open');
  document.getElementById('wlt-sheet')?.classList.add('open');
  document.body.style.overflow = 'hidden';

  const list = document.getElementById('wlt-txs-list');
  if (list) list.innerHTML = `
    <div class="wlt-tx-skl"><div class="wlt-tx-skl-ico"></div><div class="wlt-tx-skl-body"><div class="wlt-tx-skl-n"></div><div class="wlt-tx-skl-s"></div></div></div>
    <div class="wlt-tx-skl"><div class="wlt-tx-skl-ico"></div><div class="wlt-tx-skl-body"><div class="wlt-tx-skl-n"></div><div class="wlt-tx-skl-s"></div></div></div>`;
  await _loadWalletData(false);
};

window.closeWallet = function () {
  document.getElementById('wlt-overlay')?.classList.remove('open');
  document.getElementById('wlt-sheet')?.classList.remove('open');
  document.body.style.overflow = '';
};

async function _loadWalletData(all) {
  if (!CU) return;
  try {
    const snap = await getDoc(doc(db, 'users', CU.uid));
    const bal  = snap.exists() ? (snap.data().walletBalance || 0) : 0;
    if (UD) UD.walletBalance = bal;
    _renderWltBal(bal);

    const _wbFmt = _fmtBal(bal);
    document.querySelectorAll('.prof-wallet-bal').forEach(el => {
      el.textContent = _wbFmt.whole + '.' + _wbFmt.cents + ' см';
    });

    const col = collection(db, 'users', CU.uid, 'walletTransactions');
    let q;
    if (all) {
      q = query(col, orderBy('createdAt', 'desc'), limit(60));
    } else {
      const tod = new Date(); tod.setHours(0, 0, 0, 0);
      q = query(col, where('createdAt', '>=', tod), orderBy('createdAt', 'desc'), limit(30));
    }
    const txSnap = await getDocs(q);
    _wltTxs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const ttl = document.getElementById('wlt-txs-ttl');
    if (ttl) ttl.textContent = all ? 'История' : 'Сегодня';
    _renderWltTxs();
  } catch (e) { console.error('WalletLoad:', e); }
}

window.loadAllWalletTxs = async function () {
  const list = document.getElementById('wlt-txs-list');
  if (list) list.innerHTML = `<div class="wlt-tx-skl"><div class="wlt-tx-skl-ico"></div><div class="wlt-tx-skl-body"><div class="wlt-tx-skl-n"></div></div></div>`;
  await _loadWalletData(true);
};

function _renderWltTxs() {
  const list = document.getElementById('wlt-txs-list');
  if (!list) return;
  if (!_wltTxs.length) { list.innerHTML = '<div class="wlt-tx-empty">Транзакций нет</div>'; return; }

  const icons = { topup: '💳', spend: '🛒', refund: '↩️', transfer: '↗️', order: '🛍️' };
  const cats  = { topup: 'Пополнение', spend: 'Расход', refund: 'Возврат', transfer: 'Перевод', order: 'Заказ' };

  list.innerHTML = _wltTxs.map(tx => {
    const pos          = tx.amount > 0;
    const { whole, cents } = _fmtBal(Math.abs(tx.amount));
    const amt          = (pos ? '+' : '') + whole + '.' + cents + ' см';
    const date         = tx.createdAt?.toDate?.();
    const time         = date ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `<div class="wlt-tx-item">
      <div class="wlt-tx-ico">${icons[tx.type] || '💱'}</div>
      <div class="wlt-tx-body">
        <div class="wlt-tx-name">${escHtml(tx.description || cats[tx.type] || tx.type || '—')}</div>
        <div class="wlt-tx-sub">${cats[tx.type] || tx.type} · ${time}</div>
      </div>
      <div class="wlt-tx-right">
        <div class="wlt-tx-amt${pos ? ' pos' : ''}">${amt}</div>
        <div class="wlt-tx-acc">Кошелёк</div>
      </div>
    </div>`;
  }).join('');
}

window.openTopUp  = function () { document.getElementById('wlt-tup-overlay')?.classList.add('open');    document.getElementById('wlt-tup-sheet')?.classList.add('open'); };
window.closeTopUp = function () { document.getElementById('wlt-tup-overlay')?.classList.remove('open'); document.getElementById('wlt-tup-sheet')?.classList.remove('open'); };

window.doTopUp = function () {
  toast('Пополнение временно недоступно', 'warn');
};


// ─── 22. Выбор города ─────────────────────────────────────────
// DOM-структура и open/close управляются через sheet.js (Sheet 'city')
window.openCitySheet  = () => Sheet.open('city');
window.closeCitySheet = () => Sheet.close('city');

async function _loadCities() {
  const list = document.getElementById('citysh-list');
  if (!list) return;
  list.innerHTML = '<div class="citysh-empty">Загружаем города…</div>';
  try {
    const snap  = await getDocs(query(collection(db, 'cities'), orderBy('order')));
    const cities = snap.docs.length
      ? snap.docs.map(d => ({ id: d.id, ...d.data() }))
      : [{ id: 'dushanbe', name: 'Душанбе', order: 1, active: true, region: 'Столица' }];
    _renderCities(cities);
  } catch {
    _renderCities([{ id: 'dushanbe', name: 'Душанбе', order: 1, active: true, region: 'Столица' }]);
  }
}

function _renderCities(cities) {
  const list = document.getElementById('citysh-list');
  if (!list) return;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  list.innerHTML = cities.map(c => {
    const active = c.active !== false;
    const sel    = active && c.id === _selectedCityId;
    const icoClr = sel ? '#fff' : active ? 'var(--acc)' : 'var(--tx3)';
    return `<button class="citysh-item${sel ? ' selected' : ''}${!active ? ' inactive' : ''}"
        data-id="${esc(c.id)}" data-name="${esc(c.name)}"
        ${!active ? 'disabled' : `onclick="selectCity(this.dataset.id, this.dataset.name)"`}>
      <div class="citysh-item-ico">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${icoClr}" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="citysh-item-body">
        <div class="citysh-item-name">${esc(c.name)}</div>
        ${c.region ? `<div class="citysh-item-sub">${esc(c.region)}</div>` : ''}
      </div>
      ${!active
        ? '<div class="citysh-item-soon">Скоро</div>'
        : `<div class="citysh-item-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>`}
    </button>`;
  }).join('');
}

window.selectCity = function (id, name) {
  _selectedCityId   = id;
  _selectedCityName = name;
  localStorage.setItem('selectedCityId',   id);
  localStorage.setItem('selectedCityName', name);

  const tbName = document.getElementById('tb-city-name');
  if (tbName) tbName.textContent = name;

  document.querySelectorAll('.citysh-item').forEach(el => {
    const sel    = el.dataset.id === id;
    const icoSvg = el.querySelector('.citysh-item-ico svg');
    el.classList.toggle('selected', sel);
    if (icoSvg) icoSvg.setAttribute('stroke', sel ? '#fff' : 'var(--acc)');
    const check = el.querySelector('.citysh-item-check');
    if (check) check.style.opacity = sel ? '1' : '0';
  });

  loadStores();
  loadGenCats();
  setTimeout(closeCitySheet, 260);
};

// Геттеры выбранного города (для других модулей)
window.getSelectedCityId   = () => _selectedCityId;
window.getSelectedCityName = () => _selectedCityName;
