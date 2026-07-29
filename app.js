// ============================================================
//  app.js — Логика клиентского приложения Galelium Delivery
//  Используется в: home.html
// ============================================================

import { auth, db, storage, ORDER_STATUS } from './firebase.js';

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

// ─── Состояние приложения ────────────────────────────────────
let CU        = null;   // текущий пользователь Firebase Auth
let UD        = null;   // документ пользователя из Firestore
let GUEST     = false;  // режим гостя
let cart      = [];
let prods     = [];
let cats      = [];
let orders    = [];
let stores    = [];     // каталоги магазинов
let catFilter = 'all';
let searchQ   = '';
let activeOid = null;
let unsubLive = null;
let currentOTab   = 'all';
let homeSearchQ   = '';
let activeStore   = null;  // текущий открытый магазин
let storeCatFilter = 'all'; // фильтр категорий внутри магазина

const DFEE = 7; // стоимость доставки

// ─── Состояние страницы бронирования ────────────────────────
let _bookingOid      = null;  // Firestore ID заказа
let _bookingOrder    = null;  // snapshot данных заказа
let _bookingDeadline = null;  // Date() — дедлайн оплаты
let _bookingTimerInt = null;  // handle setInterval


// ─── Лейблы и цвета статусов (на таджикском) ─────────────────
const SL = {
  awaiting_payment: 'Интизори пардохт',
  pending:    'Интизор',
  confirmed:  'Тасдиқ шуд',
  preparing:  'Омода мешавад',
  delivering: 'Дар роҳ',
  delivered:  'Расонида шуд',
  cancelled:  'Бекор шуд',
};

const SC = {
  awaiting_payment: 'var(--teal)',
  pending:    'var(--amber)',
  confirmed:  'var(--blue)',
  preparing:  'var(--purple)',
  delivering: 'var(--acc)',
  delivered:  'var(--acc)',
  cancelled:  'var(--red)',
};

const STEPS = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered'];

// ─── SVG-иконки категорий ─────────────────────────────────────
const CAT_SVG = {
  vegetables: { color: '#16a34a', bg: 'rgba(22,163,74,.1)', svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M16 6 Q10 10 10 20 Q10 26 16 28 Q22 26 22 20 Q22 10 16 6Z" fill="#16a34a" opacity=".85"/><path d="M16 6 Q14 14 15 22" stroke="#15803d" stroke-width="1.5" fill="none"/><path d="M16 6 Q18 14 17 22" stroke="#15803d" stroke-width="1.5" fill="none"/><path d="M10 14 Q13 12 16 14 Q19 12 22 14" stroke="#fff" stroke-width="1" fill="none" opacity=".5"/></svg>` },
  fruits:     { color: '#ef4444', bg: 'rgba(239,68,68,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="18" r="10" fill="#ef4444" opacity=".85"/><path d="M16 8 Q18 4 22 5" stroke="#16a34a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 8 Q16 4 20 3" stroke="#16a34a" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="12" cy="16" r="2" fill="#fff" opacity=".3"/></svg>` },
  drinks:     { color: '#06b6d4', bg: 'rgba(6,182,212,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M10 8 L12 26 L20 26 L22 8 Z" fill="#06b6d4" opacity=".85"/><rect x="9" y="6" width="14" height="3" rx="1.5" fill="#0891b2"/><path d="M12 15 Q16 17 20 15" stroke="#fff" stroke-width="1" fill="none" opacity=".5"/><circle cx="22" cy="10" r="1.5" fill="#22d3ee"/></svg>` },
  chocolate:  { color: '#92400e', bg: 'rgba(146,64,14,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="5" y="9" width="22" height="16" rx="3" fill="#92400e" opacity=".85"/><line x1="12" y1="9" x2="12" y2="25" stroke="#7c2d12" stroke-width="1"/><line x1="19" y1="9" x2="19" y2="25" stroke="#7c2d12" stroke-width="1"/><line x1="5" y1="17" x2="27" y2="17" stroke="#7c2d12" stroke-width="1"/><path d="M13 5 Q16 3 19 5" stroke="#92400e" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>` },
  bread:      { color: '#d97706', bg: 'rgba(217,119,6,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M6 14 Q6 8 16 8 Q26 8 26 14 L26 24 Q26 26 24 26 L8 26 Q6 26 6 24 Z" fill="#d97706" opacity=".85"/><path d="M8 14 Q16 11 24 14" stroke="#b45309" stroke-width="1.5" fill="none"/><ellipse cx="16" cy="14" rx="10" ry="5" fill="#f59e0b" opacity=".4"/></svg>` },
  dairy:      { color: '#0ea5e9', bg: 'rgba(14,165,233,.1)', svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="9" y="8" width="14" height="18" rx="3" fill="#0ea5e9" opacity=".85"/><path d="M9 12 L7 8 L25 8 L23 12" stroke="#0284c7" stroke-width="1" fill="none"/><circle cx="14" cy="19" r="2" fill="#fff" opacity=".5"/><circle cx="19" cy="17" r="1.5" fill="#fff" opacity=".4"/></svg>` },
  snacks:     { color: '#f97316', bg: 'rgba(249,115,22,.1)', svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="5" y="12" width="22" height="12" rx="3" fill="#f97316" opacity=".85"/><rect x="8" y="10" width="16" height="4" rx="2" fill="#ea580c"/><path d="M9 16 Q16 14 23 16" stroke="#fff" stroke-width="1" fill="none" opacity=".4"/><path d="M9 20 Q16 18 23 20" stroke="#fff" stroke-width="1" fill="none" opacity=".4"/></svg>` },
  meat:       { color: '#dc2626', bg: 'rgba(220,38,38,.1)',  svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><path d="M8 22 Q6 18 10 14 Q14 10 18 12 L22 8 Q24 6 26 8 Q28 10 26 12 L22 16 Q24 20 20 22 Q16 24 12 22 Q10 24 8 22Z" fill="#dc2626" opacity=".85"/><circle cx="22" cy="10" r="3" fill="#fca5a5" opacity=".6"/></svg>` },
  default:    { color: '#64748b', bg: 'rgba(100,116,139,.1)',svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="10" fill="#64748b" opacity=".15"/><circle cx="16" cy="16" r="6" fill="#64748b" opacity=".5"/></svg>` },
};

// ─── Вспомогательные функции ──────────────────────────────────

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

function catIcon(id, name) {
  return CAT_SVG[catIconKey(id, name)] || CAT_SVG.default;
}

function catName(id) {
  return (cats.find(c => c.id === id) || {}).name || id || '';
}

function getCartQty(pid) {
  return (cart.find(c => c.productId === pid) || {}).quantity || 0;
}

function fmtDate(ts) {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    + ', '
    + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

let _orderSeq = Date.now() % 100000;
function nextOrderNum() {
  // 8-значный рандомный номер: от 10000000 до 99999999
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// ─── Toast-уведомления ────────────────────────────────────────
window.toast = function (msg, type = '') {
  const w  = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div class="tdot"></div><span>${msg}</span>`;
  w.appendChild(el);
  setTimeout(() => el.remove(), 3400);
};

// ─── Auth: инициализация приложения ──────────────────────────
onAuthStateChanged(auth, async u => {
  if (!u) {
    // Запускаем гостевой режим вместо редиректа
    GUEST = true;
    CU = null;
    UD = null;
    await Promise.all([loadProds(), loadCats(), loadStores()]);
    renderSB();
    renderGuestBanner();
    renderGuestProfile();
    renderCart();
    return;
  }
  GUEST = false;
  CU = u;
  await loadUD();
  await Promise.all([loadCart(), loadProds(), loadCats(), loadOrders(), loadStores()]);
  renderSB();
  renderProfile();
  setAddr();
  renderCart();
  removeGuestBanner();
  listenSupportBadge();
});

// ─── Выход из аккаунта ────────────────────────────────────────
window.doLogout = async function () {
  if (unsubLive) unsubLive();
  await signOut(auth);
  // После выхода — не редиректим, переходим в гостевой режим
  // onAuthStateChanged сработает автоматически
};

// ─── Кнопка входа для гостя ──────────────────────────────────
window.goLogin = function () {
  location.href = 'login.html';
};

// ─── Гостевой баннер: скрываем обычный topbar, показываем гостевой ──
function renderGuestBanner() {
  const topbar = document.getElementById('topbar');
  const guestTopbar = document.getElementById('guest-topbar');
  if (topbar) topbar.style.display = 'none';
  if (guestTopbar) guestTopbar.classList.add('visible');

  // Сайдбар: скрываем корзину/заказы/статус (только в сайдбаре через guest-hidden)
  document.querySelectorAll('.sb-nav .guest-hidden').forEach(el => el.style.display = 'none');

  // Адрес в сайдбаре — блокируем клик
  const addrRow = document.getElementById('sb-addr-row');
  if (addrRow) { addrRow.style.pointerEvents = 'none'; addrRow.style.opacity = '.45'; }
}

function removeGuestBanner() {
  const topbar = document.getElementById('topbar');
  const guestTopbar = document.getElementById('guest-topbar');
  if (topbar) topbar.style.display = '';
  if (guestTopbar) guestTopbar.classList.remove('visible');

  // Восстанавливаем сайдбар
  document.querySelectorAll('.sb-nav .guest-hidden').forEach(el => el.style.display = '');

  // Адрес — разблокируем
  const addrRow = document.getElementById('sb-addr-row');
  if (addrRow) { addrRow.style.pointerEvents = ''; addrRow.style.opacity = ''; }
}

// ─── Гостевой профиль ────────────────────────────────────────
function renderGuestProfile() {
  const av = document.getElementById('sb-av');
  if (av) av.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const nm = document.getElementById('sb-uname');
  if (nm) nm.textContent = 'Меҳмон';
  const adv = document.getElementById('sb-addr-val');
  if (adv) { adv.textContent = 'Барои фармоиш ворид шавед'; adv.classList.add('empty'); }

  // Профиль страница — показываем заглушку
  const profPage = document.getElementById('page-profile');
  if (profPage) {
    profPage.innerHTML = `
      <div style="max-width:400px;margin:60px auto;text-align:center;padding:0 16px">
        <div style="width:80px;height:80px;border-radius:50%;background:var(--accd);border:3px solid var(--accg);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;color:var(--acc)">👤</div>
        <div style="font-family:var(--fd);font-weight:900;font-size:1.3rem;color:var(--tx);margin-bottom:8px">Гостевой режим</div>
        <div style="font-size:.8rem;color:var(--tx3);line-height:1.6;margin-bottom:28px">Барои дидани профил, таърихи фармоишҳо ва захира кардани суроғ, лутфан ворид шавед ё ҳисоб кушоед.</div>
        <button onclick="goLogin()" style="background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:12px;color:#fff;font-size:.78rem;font-family:var(--fd);font-weight:800;padding:13px 32px;cursor:pointer;box-shadow:0 4px 16px rgba(26,158,74,.3);width:100%;max-width:260px;transition:opacity .15s" onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
          Ворид шавед / Ҳисоб кушоед
        </button>
        <div style="margin-top:16px;font-size:.68rem;color:var(--tx3)">Ё идома диҳед ба тарзи гостевӣ — маҳсулотро бинед, каталогро баррасӣ кунед</div>
      </div>`;
  }

  // Заказы страница — заглушка
  const ordPage = document.getElementById('page-orders');
  if (ordPage) {
    ordPage.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div style="font-size:3rem;margin-bottom:14px">📋</div>
        <div style="font-family:var(--fd);font-weight:900;font-size:1.1rem;color:var(--tx);margin-bottom:8px">Фармоишҳо дастрас нестанд</div>
        <div style="font-size:.76rem;color:var(--tx3);margin-bottom:24px">Барои дидани таърихи фармоишҳо ворид шавед</div>
        <button onclick="goLogin()" style="background:var(--acc);border:none;border-radius:10px;color:#fff;font-size:.74rem;font-family:var(--fs);font-weight:700;padding:10px 28px;cursor:pointer;box-shadow:0 3px 12px rgba(26,158,74,.3)">Ворид шавед</button>
      </div>`;
  }

  // Статус страница недоступна гостю — блокируется в goPage() до рендера,
  // отдельной заглушки тут не требуется (структура сторінки тепер повноекранна).
}

// ─── Проверка гостя перед действиями ────────────────────────
function requireAuth(msg) {
  if (!GUEST) return true;
  toast(msg || 'Барои ин амал ворид шавед', 'info');
  // Показываем мини-подсказку с кнопкой входа
  setTimeout(() => {
    const el = document.querySelector('.toast:last-child');
    if (el) {
      el.style.cursor = 'pointer';
      el.onclick = () => goLogin();
    }
  }, 50);
  return false;
}

// Пытается извлечь реальный номер телефона из псевдо-email dastdaroz ID
// (992XXXXXXXXX@phone.dastdaroz.id) — используется только как аварийный
// резерв, если документ users/{uid} почему-то не содержит поле phone.
function phoneFromPseudoEmail(email) {
  const m = /^992(\d{9})@phone\.dastdaroz\.id$/.exec(email || '');
  return m ? '+992' + m[1] : '';
}

// ─── Загрузка данных пользователя ────────────────────────────
async function loadUD() {
  const fallbackPhone = phoneFromPseudoEmail(CU.email);
  try {
    const s = await getDoc(doc(db, 'users', CU.uid));
    UD = s.exists()
      ? s.data()
      : { displayName: CU.displayName || '', phone: fallbackPhone, address: '', lat: null, lng: null, role: 'client', avatarUrl: '' };
  } catch {
    UD = { displayName: '', phone: fallbackPhone, address: '', lat: null, lng: null, role: 'client', avatarUrl: '' };
  }
}

// ─── Рендер сайдбара ─────────────────────────────────────────
function renderSB() {
  if (GUEST) {
    const nm = document.getElementById('sb-uname');
    if (nm) nm.textContent = 'Меҳмон';
    const av = document.getElementById('sb-av');
    if (av) av.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const adv = document.getElementById('sb-addr-val');
    if (adv) { adv.textContent = 'Барои фармоиш ворид шавед'; adv.classList.add('empty'); }
    // Заменяем кнопку выхода на кнопку входа в сайдбаре
    const logoutBtn = document.querySelector('.sb-logout');
    if (logoutBtn) {
      logoutBtn.title = 'Ворид шавед';
      logoutBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>`;
      logoutBtn.onclick = (e) => { e.stopPropagation(); goLogin(); };
      logoutBtn.style.color = 'var(--acc)';
    }
    const role = document.querySelector('.sb-urole');
    if (role) role.textContent = 'Гостевой режим';
    const userEl = document.querySelector('.sb-user');
    if (userEl) userEl.onclick = () => goLogin();
    return;
  }
  const name = UD?.displayName || 'Муштарӣ';
  const init = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  document.getElementById('sb-uname').textContent = name;
  const av = document.getElementById('sb-av');
  av.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;
  const adv = document.getElementById('sb-addr-val');
  if (UD?.address) {
    adv.textContent = UD.address;
    adv.classList.remove('empty');
  } else {
    adv.textContent = 'Суроғ нишон диҳед →';
    adv.classList.add('empty');
  }
}

// ─── Навигация ────────────────────────────────────────────────
window.goPage = function (page) {
  // Гость может смотреть только публичные страницы
  if (GUEST && (page === 'orders' || page === 'status' || page === 'cart')) {
    if (page === 'cart') {
      toast('Барои истифода аз сабад ворид шавед', 'info');
    } else {
      toast('Барои дидани фармоишҳо ворид шавед', 'info');
    }
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni,.mn-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll(`.ni[data-page="${page}"],.mn-item[data-page="${page}"]`)
    .forEach(n => n.classList.add('active'));
  const tb = document.getElementById('tb-title');
  if (page === 'home') tb.innerHTML = 'Galelium <em>Delivery</em>';
  else if (page === 'store') tb.textContent = activeStore?.name || 'Каталог';
  else tb.textContent = {
    catalog: 'Каталог',
    cart:    'Сабад',
    orders:  'Фармоишҳоям',
    status:  'Ҳолати фармоиш',
    profile: 'Профил',
    booking: 'Тасдиқи фармоиш',
  }[page] || 'Galelium Delivery';
  if (page === 'status')  { renderStatusPage(); }
  if (page === 'orders')  { loadOrders(); }
  if (page === 'store')   { renderStorePage(); }
  if (page === 'booking') { renderBookingPage(); startBookingTimer(); }
  closeSB();
  document.getElementById('pages').scrollTop = 0;
};

// ─── Магазины / Каталоги ──────────────────────────────────────
async function loadStores() {
  try {
    const s = await getDocs(query(collection(db, 'stores'), orderBy('order')));
    stores = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // Если нет поля order — грузим без сортировки
    try {
      const s2 = await getDocs(collection(db, 'stores'));
      stores = s2.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { stores = []; }
  }
  renderStoresGrid();
}

function renderStoresGrid() {
  const el = document.getElementById('stores-grid');
  if (!el) return;
  if (!stores.length) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--tx3);font-size:.76rem">Дӯконҳо ёфт нашуданд</div>';
    return;
  }
  el.innerHTML = stores.map(s => {
    const imgUrl  = s.imageUrl || '';
    return `
    <div class="store-card" onclick="openStore('${s.id}')" title="${s.name}">
      <div class="store-card-img-wrap">
        ${imgUrl
          ? `<img class="store-card-img" src="${imgUrl}" alt="${s.name}" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="store-card-placeholder"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg><span>${s.name}</span></div>`}
      </div>
    </div>`;
  }).join('');
}

window.openStore = function (sid) {
  activeStore     = stores.find(s => s.id === sid);
  storeCatFilter  = 'all';
  if (!activeStore) return;
  goPage('store');
};

window.filterStoreCat = function (id) {
  storeCatFilter = id;
  renderStoreCatPills();
  renderStoreProds();
};

function renderStorePage() {
  if (!activeStore) return;

  // Шапка магазина
  const hdr = document.getElementById('store-header');
  if (hdr) {
    const imgUrl = activeStore.imageUrl || '';
    hdr.innerHTML = `
    <div class="store-cat-header">
      ${imgUrl ? `<img class="store-cat-header-img" src="${imgUrl}" alt="${activeStore.name}">` : ''}
      <div class="store-cat-header-overlay"></div>
      <div class="store-cat-header-body">
        <div class="store-cat-header-tag">Дӯкон</div>
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
  const storeProdIds = new Set(
    prods.filter(p => p.storeId === activeStore.id).map(p => p.categoryId)
  );
  return cats.filter(c => storeProdIds.has(c.id));
}

function renderStoreCatPills() {
  const el = document.getElementById('store-cats');
  if (!el) return;
  const storeCats = getStoreCats();
  el.innerHTML = `<button class="cat${storeCatFilter === 'all' ? ' active' : ''}" onclick="filterStoreCat('all')">Ҳама</button>`
    + storeCats.map(c =>
        `<button class="cat${storeCatFilter === c.id ? ' active' : ''}" onclick="filterStoreCat('${c.id}')">${c.name}</button>`
      ).join('');
}

function renderStoreProds() {
  const el = document.getElementById('store-prods');
  if (!el || !activeStore) return;
  let list = prods.filter(p => p.storeId === activeStore.id);
  if (storeCatFilter !== 'all') list = list.filter(p => p.categoryId === storeCatFilter);
  if (!list.length) {
    el.innerHTML = `<div class="store-cat-empty" style="grid-column:1/-1">
      <span class="store-cat-empty-ico">📦</span>
      <div class="store-cat-empty-t">Маҳсулот ҳоло нест</div>
      <div class="store-cat-empty-s">Ба зудӣ маҳсулот илова мешавад</div>
    </div>`;
    return;
  }
  el.innerHTML = list.map(renderPC).join('');
}

window.toggleSB = function () {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-overlay').classList.toggle('open');
};

window.closeSB = function () {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
};

document.getElementById('sb-overlay').addEventListener('click', closeSB);

// ─── Продукты ─────────────────────────────────────────────────
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
    ? `<button class="add-btn" disabled title="Нест"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`
    : qty > 0
      ? `<div class="pc-qty"><button class="pc-qty-btn" onclick="event.stopPropagation();pcMinus('${p.id}')">−</button><div class="pc-qty-val">${qty}</div><button class="pc-qty-btn" onclick="event.stopPropagation();pcPlus('${p.id}')">+</button></div>`
      : `<button class="add-btn" onclick="event.stopPropagation();addToCart('${p.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;
  return `<div class="pc" onclick="openProdModal('${p.id}')"><div class="pc-img">${imgHtml}${unavail ? '<div class="pc-badge">Нест</div>' : ''}</div><div class="pc-body"><div class="pc-cat">${catName(p.categoryId)}</div><div class="pc-name">${p.name}</div><div class="pc-desc">${p.description || ''}</div><div class="pc-footer"><div class="pc-price">${p.price}<span> см</span></div>${controls}</div></div></div>`;
}

// ─── Модалка карточки товара ──────────────────────────────────
window.openProdModal = function (pid) {
  const p = prods.find(x => x.id === pid);
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

  // Hero
  const heroHtml = p.imageUrl
    ? `<img class="pm-hero-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy">`
    : `<div class="pm-hero-ph">${ic.svg.replace('width="26" height="26"', 'width="100" height="100"')}</div>`;

  // Магазин (если есть)
  const store    = stores.find(s => s.id === p.storeId);
  const storeBadge = store
    ? `<div class="pm-badge-store">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
        ${store.name}
       </div>`
    : '';

  // Рейтинг (если есть поле rating в Firestore)
  const ratingHtml = p.rating
    ? (() => {
        const r = Math.round(p.rating * 2) / 2;
        const full = Math.floor(r), half = r % 1;
        const stars = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - Math.ceil(r));
        return `<div class="pm-rating">
          <div class="pm-stars">${[...stars].map(s =>
            `<span class="pm-star" style="color:${s==='☆'?'var(--b1)':'#f59e0b'}">${s==='½'?'⯨':s}</span>`
          ).join('')}</div>
          <span class="pm-rating-val">${p.rating.toFixed(1)}</span>
          ${p.reviewCount ? `<span class="pm-rating-cnt">(${p.reviewCount} отзыв)</span>` : ''}
        </div>`;
      })()
    : '';

  // Чипсы — характеристики из Firestore
  const chips = [];
  if (p.weight)      chips.push({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a1 1 0 100 2 1 1 0 000-2z"/><path d="M5 21h14l-2-11H7z"/></svg>`, label: p.weight + ' г' });
  if (p.volume)      chips.push({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2h6l1 7H8z"/><path d="M8 9a5 5 0 0010 0"/></svg>`, label: p.volume + ' мл' });
  if (p.brand)       chips.push({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>`, label: p.brand });
  if (p.country)     chips.push({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>`, label: p.country });
  if (p.expiry)      chips.push({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`, label: p.expiry });
  if (p.organic)     chips.push({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-6 8-12a8 8 0 00-16 0c0 6 8 12 8 12z"/></svg>`, label: 'Органик' });
  if (cname && !chips.find(c => c.label === cname)) chips.unshift({ icon: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3"/></svg>`, label: cname });
  const chipsHtml = chips.length
    ? `<div class="pm-chips">${chips.map(c => `<span class="pm-chip">${c.icon} ${c.label}</span>`).join('')}</div>`
    : '';

  // Пищевая ценность (если есть в Firestore)
  const nutKeys = [
    { k: 'calories', l: 'Ккал' },
    { k: 'protein',  l: 'Белок' },
    { k: 'fat',      l: 'Жир' },
    { k: 'carbs',    l: 'Углев' },
  ];
  const nutItems = nutKeys.filter(n => p[n.k] != null);
  const nutritionHtml = nutItems.length >= 2
    ? `<div class="pm-div"></div>
       <div style="font-size:.48rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--tx3);margin-bottom:10px">Пищевая ценность / 100г</div>
       <div class="pm-nutrition">${nutItems.map(n =>
         `<div class="pm-nut-item"><div class="pm-nut-val">${p[n.k]}</div><div class="pm-nut-lbl">${n.l}</div></div>`
       ).join('')}</div>`
    : '';

  // Кнопки
  const buyHtml = unavail
    ? `<button class="pm-add-btn" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><line x1="9" y1="15" x2="15" y2="9"/></svg>
        Мавҷуд нест
       </button>`
    : qty > 0
      ? `<div class="pm-buy-wrap">
           <div class="pm-qty-box">
             <button class="pm-qty-btn" onclick="pmMinus('${p.id}')">−</button>
             <div class="pm-qty-num" id="pm-qty-${p.id}">${qty}</div>
             <button class="pm-qty-btn" onclick="pmPlus('${p.id}')">+</button>
           </div>
           <button class="pm-go-cart" onclick="closeProdModal();goPage('cart')">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
             Ба сабад — ${p.price * qty} см
           </button>
         </div>`
      : `<button class="pm-add-btn" onclick="pmAdd('${p.id}')">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
           Ба сабад илова кунед
         </button>`;

  document.getElementById('prod-modal-inner').innerHTML = `
    <div class="pm-hero">
      ${heroHtml}
      <button class="pm-close" onclick="closeProdModal()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      ${unavail ? '<div class="pm-badge-unavail">Мавҷуд нест</div>' : ''}
      ${storeBadge}
    </div>

    <div class="pm-body">
      <div class="pm-cat-line">
        <div class="pm-cat-dot"></div>
        <div class="pm-cat-lbl">${cname || 'Маҳсулот'}</div>
      </div>

      <div class="pm-name">${p.name}</div>

      ${ratingHtml}

      ${p.description ? `<div class="pm-desc">${p.description}</div>` : ''}

      ${chipsHtml}

      ${nutritionHtml}

      <div class="pm-div"></div>

      <div class="pm-buy-row">
        <div class="pm-price-line">
          <div class="pm-price">${p.price}</div>
          <div class="pm-price-unit">см</div>
          ${p.weight ? `<div class="pm-price-per">· за ${p.weight}г</div>` : ''}
        </div>
        ${buyHtml}
      </div>
    </div>`;
}

// Кнопки внутри модалки товара
window.pmAdd = async function (pid) {
  await addToCart(pid);
  const p = prods.find(x => x.id === pid);
  if (p) renderProdModal(p); // перерисовать модалку с счётчиком
};

window.pmPlus = async function (pid) {
  await addToCart(pid);
  const p   = prods.find(x => x.id === pid);
  const qty = getCartQty(pid);
  const qEl = document.getElementById(`pm-qty-${pid}`);
  if (qEl) {
    qEl.textContent = qty;
    const goBtn = document.querySelector('.pm-go-cart');
    if (goBtn && p) goBtn.lastChild.textContent = ` Ба сабад — ${p.price * qty} см`;
  } else {
    if (p) renderProdModal(p);
  }
};

window.pmMinus = async function (pid) {
  await pcMinus(pid);
  const p   = prods.find(x => x.id === pid);
  const qty = getCartQty(pid);
  if (!qty) {
    if (p) renderProdModal(p);
  } else {
    const qEl = document.getElementById(`pm-qty-${pid}`);
    if (qEl) {
      qEl.textContent = qty;
      // обновляем цену в кнопке "Ба сабад"
      const goBtn = document.querySelector('.pm-go-cart');
      if (goBtn && p) goBtn.lastChild.textContent = ` Ба сабад — ${p.price * qty} см`;
    }
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

function renderHomeProds() {
  const el   = document.getElementById('home-prods');
  if (!el) return;
  const list = prods.filter(p => p.available !== false).slice(0, 8);
  el.innerHTML = list.length
    ? list.map(renderPC).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="empty-t">Маҳсулот нест</div></div>`;
}

function renderCatalog() {
  const el = document.getElementById('cat-prods');
  if (!el) return;
  let list = [...prods];
  if (catFilter !== 'all') list = list.filter(p => p.categoryId === catFilter);
  if (searchQ)             list = list.filter(p =>
    p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQ.toLowerCase())
  );
  el.innerHTML = list.length
    ? list.map(renderPC).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="empty-t">Ҳеҷ чиз ёфт нашуд</div></div>`;
}

// ─── Категории ────────────────────────────────────────────────
async function loadCats() {
  try {
    const s = await getDocs(collection(db, 'categories'));
    cats = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}
  renderCatPills();
  renderHomeCats();
}

function renderCatPills() {
  const el = document.getElementById('cats');
  if (!el) return;
  el.innerHTML = `<button class="cat${catFilter === 'all' ? ' active' : ''}" onclick="filterCat('all')">Ҳама</button>`
    + cats.map(c => `<button class="cat${catFilter === c.id ? ' active' : ''}" onclick="filterCat('${c.id}')">${c.name}</button>`).join('');
}

function renderHomeCats() {
  const el    = document.getElementById('home-cats');
  if (!el) return;
  const shown = cats.slice(0, 4);
  if (!shown.length) { el.innerHTML = ''; return; }
  el.innerHTML = shown.map(c => {
    const count = prods.filter(p => p.categoryId === c.id && p.available !== false).length;
    const ic    = catIcon(c.id, c.name);
    return `<div class="cat-panel" style="--cat-c:${ic.color};--cat-bg:${ic.bg}" onclick="filterCat('${c.id}');goPage('catalog')"><div class="cat-panel-ico">${ic.svg}</div><div class="cat-panel-name">${c.name}</div><div class="cat-panel-count">${count} маҳсулот</div></div>`;
  }).join('');
}

window.filterCat = function (id) {
  catFilter = id;
  renderCatPills();
  renderCatalog();
};

// ─── Поиск ───────────────────────────────────────────────────
window.onHomeSearch = function (v) {
  homeSearchQ = v;
  document.getElementById('search-clear').classList.toggle('show', v.length > 0);
  renderSD(v);
};

window.clearHS = function () {
  homeSearchQ = '';
  document.getElementById('search-inp-home').value = '';
  document.getElementById('search-clear').classList.remove('show');
  closeSD();
};

window.openSD = function () { if (homeSearchQ) renderSD(homeSearchQ); };

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
    dd.innerHTML = `<div class="srd-empty">Ҳеҷ чиз ёфт нашуд 🔍</div>`;
    dd.classList.add('open');
    return;
  }
  dd.innerHTML = res.map(p => {
    const ic = catIcon(p.categoryId, catName(p.categoryId));
    return `<div class="srd-item" onclick="pickSD('${p.id}')"><div class="srd-img">${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : ic.svg}</div><div class="srd-info"><div class="srd-name">${p.name}</div><div class="srd-cat">${catName(p.categoryId)}</div></div><div class="srd-price">${p.price} см</div></div>`;
  }).join('');
  dd.classList.add('open');
}

function closeSD() { document.getElementById('search-dd').classList.remove('open'); }

window.pickSD = function (pid) {
  closeSD(); clearHS();
  catFilter = 'all';
  searchQ   = prods.find(p => p.id === pid)?.name || '';
  renderCatalog();
  goPage('catalog');
  searchQ = '';
};

document.addEventListener('click', e => {
  const sb = document.getElementById('search-box');
  if (sb && !sb.contains(e.target)) closeSD();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeOrderModal(); closeProdModal(); }
});

window.onSearch = function (v) {
  searchQ = v;
  renderCatalog();
  if (v) goPage('catalog');
};

// ─── Корзина ─────────────────────────────────────────────────
async function loadCart() {
  try {
    const s = await getDocs(collection(db, 'users', CU.uid, 'cart'));
    cart = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { cart = []; }
  renderCart();
  updateBadges();
}

window.addToCart = async function (pid) {
  if (!requireAuth('Барои илова кардан ба сабад ворид шавед')) return;
  const p = prods.find(x => x.id === pid);
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
    toast(p.name + ' илова шуд', 'ok');
    renderCart(); renderHomeProds(); renderCatalog(); renderStoreProds(); updateBadges();
  } catch { toast('Хато', 'err'); }
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
  if (!cart.length) return;
  if (!confirm('Сабадро тоза кунем?')) return;
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
    el.innerHTML = `<div class="empty" style="padding:52px 20px 20px">
      <span class="empty-ico">🔐</span>
      <div class="empty-t">Барои истифода аз сабад ворид шавед</div>
      <div class="empty-s" style="margin-bottom:20px">Маҳсулотро интихоб кунед ва фармоиш диҳед</div>
      <button onclick="goLogin()" style="background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:10px;color:#fff;font-size:.74rem;font-family:var(--fs);font-weight:700;padding:10px 28px;cursor:pointer;box-shadow:0 3px 12px rgba(26,158,74,.3)">Ворид шавед / Ҳисоб кушоед</button>
    </div>`;
    const cs = document.getElementById('cart-sum');   if (cs) cs.style.opacity = '.5';
    const cb = document.getElementById('checkout-btn'); if (cb) cb.disabled = true;
    return;
  }
  if (!cart.length) {
    el.innerHTML = '<div class="empty"><span class="empty-ico">🛒</span><div class="empty-t">Сабад холӣ аст</div><div class="empty-s">Аз каталог маҳсулот илова кунед</div></div>';
    const cs = document.getElementById('cart-sum');   if (cs) cs.style.opacity = '.5';
    const cb = document.getElementById('checkout-btn'); if (cb) cb.disabled = true;
  } else {
    el.innerHTML = cart.map(i => {
      const ic = catIcon(i.productId, '').svg;
      return `<div class="ci"><div class="ci-img">${i.imageUrl ? `<img src="${i.imageUrl}" alt="">` : ic}</div><div class="ci-info"><div class="ci-name">${i.name}</div><div class="ci-price">${i.price} см / дона</div></div><div class="qty"><button class="qty-btn" onclick="updateQty('${i.productId}',-1)">−</button><div class="qty-val">${i.quantity}</div><button class="qty-btn" onclick="updateQty('${i.productId}',1)">+</button></div><div class="ci-total">${i.price * i.quantity} см</div><button class="ci-del" onclick="removeCI('${i.productId}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div>`;
    }).join('');
    const cs = document.getElementById('cart-sum');   if (cs) cs.style.opacity = '1';
    const cb = document.getElementById('checkout-btn'); if (cb) cb.disabled = false;
  }
  const sub = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const tot = sub + (cart.length ? DFEE : 0);
  const ci  = document.getElementById('cs-items');  if (ci) ci.textContent = sub + ' см';
  const cd  = document.getElementById('cs-del');    if (cd) cd.textContent = cart.length ? DFEE + ' см' : '0 см';
  const ct  = document.getElementById('cs-total');  if (ct) ct.textContent = tot + ' см';
}

function updateBadges() {
  const cnt = cart.reduce((s, c) => s + c.quantity, 0);
  ['cart-nb', 'mob-cart-b'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.style.display = cnt > 0 ? '' : 'none'; b.textContent = cnt; }
  });
  const tb = document.getElementById('tb-cnt');
  if (tb) tb.textContent = cnt;
}

function setAddr() {
  if (UD?.address) {
    updateAddrCard(UD.address, UD.lat || null, UD.lng || null);
  }
}

// ─── Адрес + Карта (Leaflet + OpenStreetMap) ─────────────────
let _map        = null;
let _addrCtx    = null;
let _addrPicked = null;
let _geoTimer   = null;
let _sugTimer   = null;

const DUSHANBE = [38.5598, 68.7733];

window.openAddrModal = function (ctx) {
  if (!requireAuth('Барои нишон додани суроғ ворид шавед')) return;
  _addrCtx = ctx || 'cart';
  document.getElementById('addr-modal-bg').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Предзаполняем текущий адрес
  const curAddr = document.getElementById('cart-addr')?.value || UD?.address || '';
  const curLat  = parseFloat(document.getElementById('cart-lat')?.value) || UD?.lat;
  const curLng  = parseFloat(document.getElementById('cart-lng')?.value) || UD?.lng;

  if (curAddr) {
    document.getElementById('addr-search-inp').value = curAddr;
    document.getElementById('addr-search-clear').classList.add('show');
    const bv = document.getElementById('addr-bottom-val');
    bv.textContent = curAddr;
    bv.classList.remove('placeholder');
    document.getElementById('addr-confirm-btn').disabled = false;
    _addrPicked = { address: curAddr, lat: curLat || DUSHANBE[0], lng: curLng || DUSHANBE[1] };
  }

  // Инициализируем карту после открытия (нужен visible DOM)
  requestAnimationFrame(() => setTimeout(() => initLeaflet(curLat, curLng), 120));
};

function initLeaflet(lat, lng) {
  const center = (lat && lng) ? [lat, lng] : DUSHANBE;
  const zoom   = (lat && lng) ? 16 : 13;

  if (_map) {
    _map.setView(center, zoom);
    return;
  }

  _map = L.map('addr-map', {
    center, zoom,
    zoomControl: false,
    attributionControl: false,
  });

  // Тайлы — можно выбрать любой стиль
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(_map);

  // Кнопка зума своя (в нужном углу)
  L.control.zoom({ position: 'bottomright' }).addTo(_map);

  // При движении карты — reverse geocode по центру
  _map.on('movestart', () => {
    document.getElementById('addr-map-pin').classList.add('dragging');
    document.getElementById('addr-map-pulse').style.opacity = '0';
  });

  _map.on('moveend', () => {
    document.getElementById('addr-map-pin').classList.remove('dragging');
    const c = _map.getCenter();
    reverseGeocode(c.lat, c.lng);
  });
}

function reverseGeocode(lat, lng) {
  clearTimeout(_geoTimer);
  _geoTimer = setTimeout(async () => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
        { headers: { 'Accept-Language': 'ru' } }
      );
      const d = await r.json();
      const a = d.address || {};
      // Формируем красивый адрес
      const parts = [
        a.road || a.pedestrian || a.street || '',
        a.house_number ? a.house_number : '',
        a.suburb || a.neighbourhood || '',
        a.city || a.town || a.village || 'Душанбе',
      ].filter(Boolean);
      const addr = parts.join(', ');
      _addrPicked = { address: addr, lat, lng };
      const bv = document.getElementById('addr-bottom-val');
      if (bv) { bv.textContent = addr; bv.classList.remove('placeholder'); }
      const si = document.getElementById('addr-search-inp');
      if (si) si.value = addr;
      document.getElementById('addr-search-clear')?.classList.add('show');
      document.getElementById('addr-confirm-btn').disabled = false;
      document.getElementById('addr-map-pulse').style.opacity = '1';
    } catch { /* тихо */ }
  }, 500);
}

// Поиск через Nominatim
window.onAddrSearch = function (val) {
  document.getElementById('addr-search-clear').classList.toggle('show', val.length > 0);
  hideSuggestions();
  if (!val.trim()) return;
  clearTimeout(_sugTimer);
  _sugTimer = setTimeout(async () => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val + ' Душанбе Таджикистан')}&format=json&limit=5&accept-language=ru&countrycodes=tj`,
        { headers: { 'Accept-Language': 'ru' } }
      );
      const results = await r.json();
      if (!results.length) { hideSuggestions(); return; }
      showSuggestions(results);
    } catch { hideSuggestions(); }
  }, 350);
};

function showSuggestions(results) {
  const el = document.getElementById('addr-suggestions');
  el.innerHTML = results.map(p => {
    const parts = p.display_name.split(', ');
    const main  = parts.slice(0, 2).join(', ');
    const sec   = parts.slice(2, 4).join(', ');
    return `<div class="addr-sug-item" onclick="pickSuggestion(${p.lat},${p.lon},'${escHtml(main)}')">
      <div class="addr-sug-ico"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
      <div><div class="addr-sug-main">${escHtml(main)}</div><div class="addr-sug-sec">${escHtml(sec)}</div></div>
    </div>`;
  }).join('');
  el.style.display = 'block';
}

function hideSuggestions() {
  const el = document.getElementById('addr-suggestions');
  if (el) el.style.display = 'none';
}

window.pickSuggestion = function (lat, lng, name) {
  hideSuggestions();
  lat = parseFloat(lat); lng = parseFloat(lng);
  document.getElementById('addr-search-inp').value = name;
  _addrPicked = { address: name, lat, lng };
  const bv = document.getElementById('addr-bottom-val');
  if (bv) { bv.textContent = name; bv.classList.remove('placeholder'); }
  document.getElementById('addr-confirm-btn').disabled = false;
  document.getElementById('addr-map-pulse').style.opacity = '1';
  if (_map) _map.setView([lat, lng], 17);
};

window.clearAddrSearch = function () {
  document.getElementById('addr-search-inp').value = '';
  document.getElementById('addr-search-clear').classList.remove('show');
  hideSuggestions();
};

window.goMyLocation = function () {
  const btn = document.getElementById('addr-myloc-btn');
  if (!navigator.geolocation) { toast('Геолокатсия дастгирӣ намешавад', 'err'); return; }
  btn.style.animation = 'spinBtn 1s linear infinite';
  navigator.geolocation.getCurrentPosition(pos => {
    btn.style.animation = '';
    const { latitude: lat, longitude: lng } = pos.coords;
    if (_map) { _map.setView([lat, lng], 17); reverseGeocode(lat, lng); }
  }, () => {
    btn.style.animation = '';
    toast('Мавқеъ муайян нашуд', 'err');
  }, { timeout: 8000 });
};

window.closeAddrModal = function () {
  document.getElementById('addr-modal-bg').classList.remove('open');
  document.body.style.overflow = '';
  hideSuggestions();
};

window.confirmAddr = function () {
  if (!_addrPicked) return;
  const floor = document.getElementById('addr-floor').value.trim();
  const apt   = document.getElementById('addr-apt').value.trim();
  const note  = document.getElementById('addr-note').value.trim();
  let full    = _addrPicked.address;
  const extra = [floor ? 'ош. ' + floor : '', apt ? 'хв. ' + apt : '', note].filter(Boolean).join(', ');
  if (extra) full += ', ' + extra;

  // Обновляем UI карточки и hidden inputs
  updateAddrCard(full, _addrPicked.lat, _addrPicked.lng);

  // Сохраняем в Firestore — коллекция users/{uid}, поля address + lat + lng
  if (CU) {
    setDoc(doc(db, 'users', CU.uid), {
      address:   full,
      lat:       _addrPicked.lat,
      lng:       _addrPicked.lng,
      updatedAt: serverTimestamp(),
    }, { merge: true }).then(() => {
      // Обновляем локальный UD
      UD = { ...UD, address: full, lat: _addrPicked.lat, lng: _addrPicked.lng };
      // Синхронизируем профиль и сайдбар
      renderSB();
      renderProfile();
      // Обновляем поле адреса в профиле
      const pfa = document.getElementById('pf-addr');
      if (pfa) pfa.value = full;
    });
  }

  toast('Суроғ тасдиқ шуд ✓', 'ok');
  closeAddrModal();
};

function updateAddrCard(address, lat, lng) {
  // Hidden inputs для оформления заказа
  const ca = document.getElementById('cart-addr');
  const cl = document.getElementById('cart-lat');
  const cn = document.getElementById('cart-lng');
  if (ca) ca.value = address;
  if (cl) cl.value = lat || '';
  if (cn) cn.value = lng || '';

  // Карточка-кнопка в корзине
  const display = document.getElementById('cart-addr-display');
  const coords  = document.getElementById('cart-addr-coords');
  if (display) { display.textContent = address; display.classList.remove('empty'); }
  if (coords && lat && lng) {
    coords.textContent = `📍 ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`;
    coords.style.display = 'block';
  }

  // Сайдбар
  const adv = document.getElementById('sb-addr-val');
  if (adv) { adv.textContent = address; adv.classList.remove('empty'); }

  // Поле адреса в профиле
  const pfa = document.getElementById('pf-addr');
  if (pfa) pfa.value = address;
  const pfc = document.getElementById('pf-addr-coords');
  if (pfc && lat && lng) {
    pfc.textContent = `📍 ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`;
    pfc.style.display = 'block';
  }
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ─── Оформление заказа + бронирование + переход к оплате ──────
//
//  Флоу:
//  1. Создаём заказ со status = 'awaiting_payment' и reservedUntil = now+10мин
//  2. Очищаем корзину
//  3. Переходим на payment.html?oid=ORDER_ID
//
//  payment.html обрабатывает ответ эквайринга:
//    status=success → меняет status на 'pending' (заказ в работу)
//    status=cancel  → меняет status на 'cancelled'
//    таймер = 0    → меняет status на 'cancelled' (expired)
//
//  Возврат на home.html через якорную ссылку #order-ORDER_ID
//  — автоматически открывает страницу статуса нужного заказа.
// ──────────────────────────────────────────────────────────────

const PAYMENT_RESERVE_MS = 10 * 60 * 1000; // 10 минут

window.doCheckout = async function () {
  if (!requireAuth('Барои фармоиш ворид шавед')) return;
  if (!cart.length) return;
  const addr = document.getElementById('cart-addr').value.trim();
  const lat  = parseFloat(document.getElementById('cart-lat')?.value) || null;
  const lng  = parseFloat(document.getElementById('cart-lng')?.value) || null;
  if (!addr) {
    toast('Суроғи расониданро нишон диҳед', 'err');
    document.getElementById('cart-addr').focus();
    return;
  }

  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;width:14px;height:14px"></div> Бронирование…';

  try {
    const sub         = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const oNum        = nextOrderNum();
    const confirmCode = Math.floor(1000 + Math.random() * 9000).toString();
    const payMethod   = document.getElementById('cart-pay')?.value || 'card';

    // Дедлайн оплаты: now + 10 минут
    const reservedUntil = new Date(Date.now() + PAYMENT_RESERVE_MS);

    const ref = await addDoc(collection(db, 'orders'), {
      clientId:       CU.uid,
      clientName:     UD?.displayName || '',
      orderNumber:    oNum,
      confirmCode:    confirmCode,
      items:          cart.map(c => ({
        productId: c.productId,
        name:      c.name,
        price:     c.price,
        quantity:  c.quantity,
      })),
      subtotal:       sub,
      deliveryFee:    DFEE,
      total:          sub + DFEE,
      address:        addr,
      lat:            lat,
      lng:            lng,
      comment:        document.getElementById('cart-comment')?.value.trim() || '',
      paymentMethod:  payMethod,
      // ── статус бронирования ────────────────────────────────
      status:         'awaiting_payment',  // ждём оплату 10 мин
      paymentStatus:  'pending',           // ещё не оплачен
      reservedUntil:  reservedUntil,       // Timestamp дедлайна
      // ───────────────────────────────────────────────────────
      courierId:      null,
      courierName:    null,
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
    });

    const oid = ref.id;
    activeOid = oid;

    // Очищаем корзину сразу после бронирования
    const b = writeBatch(db);
    cart.forEach(c => b.delete(doc(db, 'users', CU.uid, 'cart', c.productId)));
    await b.commit();
    cart = [];
    renderCart(); updateBadges();

    // Сохраняем данные для страницы бронирования
    _bookingOid      = oid;
    _bookingDeadline = reservedUntil;
    _bookingOrder = {
      id:            oid,
      orderNumber:   oNum,
      items:         cart.map(c => ({ productId: c.productId, name: c.name, price: c.price, quantity: c.quantity })),
      subtotal:      sub,
      deliveryFee:   DFEE,
      total:         sub + DFEE,
      address:       addr,
      paymentMethod: payMethod,
    };

    toast('Фармоиш №' + oNum + ' бронирование шуд! ✅', 'ok');

    // Переход на страницу бронирования (небольшая задержка для toast)
    setTimeout(() => {
      goPage('booking');
    }, 420);

  } catch (e) {
    toast('Хато: ' + e.message, 'err');
    btn.disabled = false;
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M5 12h14M12 5l7 7-7 7"/></svg> Фармоиш расмикунонӣ';
  }
};

// ─── Обработка возврата с payment.html (якорные ссылки) ───────
//
//  payment.html перенаправляет обратно как:
//    home.html#order-<oid>   → открыть статус заказа напрямую
//    home.html#verify-<oid>  → показать страницу бронирования с анимацией
//                              проверки оплаты, затем перейти на статус
//
//  Вызывается один раз при загрузке страницы.
// ──────────────────────────────────────────────────────────────
(function handlePaymentReturn() {
  const hash = location.hash;
  const isVerify = hash.startsWith('#verify-');
  const isOrder  = hash.startsWith('#order-');
  if (!isVerify && !isOrder) return;

  const prefix  = isVerify ? '#verify-' : '#order-';
  const rawPart = hash.slice(prefix.length);
  const oid     = rawPart.split('&')[0];
  if (!oid) return;

  history.replaceState(null, '', location.pathname + location.search);

  const tryOpen = () => {
    if (typeof goPage !== 'function') { setTimeout(tryOpen, 250); return; }

    if (isVerify) {
      // ── Режим проверки: показываем booking-страницу с анимацией ──
      _bookingOid = oid;
      goPage('booking');
      // Прячем все обычные элементы booking-страницы
      const hide = ['bk-timer','bk-receipt-card','bk-methods','bk-section-label',
                    'bk-cancel-btn','bk-expired'];
      hide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      document.querySelectorAll('.bk-section-label').forEach(el => el.style.display='none');
      // Показываем блок проверки
      const vEl = document.getElementById('bk-verify');
      if (vEl) vEl.style.display = 'block';

      // Через 1.8с — проверяем Firestore и показываем результат
      setTimeout(async () => {
        try {
          const { doc: fsDoc, getDoc: fsGet } =
            await import('https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js');
          const snap = await fsGet(fsDoc(db, 'orders', oid));
          const paid = snap.exists() && snap.data().paymentStatus === 'paid';

          if (paid) {
            // Успех — зелёная галочка
            const icon = document.getElementById('bk-verify-icon');
            const spin = document.getElementById('bk-verify-spinner');
            const title = document.getElementById('bk-verify-title');
            const sub   = document.getElementById('bk-verify-sub');
            if (icon)  { icon.classList.add('success'); icon.innerHTML = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'; }
            if (title) { title.textContent = 'Пардохт тасдиқ шуд!'; title.style.color = 'var(--acc)'; }
            if (sub)   sub.textContent = 'Фармоиши шумо ба ошхона фиристода шуд. Мо онро зуд омода мекунем 🚀';

            // Через 2с — грузим заказы и открываем статус
            setTimeout(() => {
              activeOid = oid;
              if (typeof loadOrders === 'function') {
                loadOrders().then(() => {
                  goPage('status');
                  if (typeof renderStatusPage === 'function') renderStatusPage();
                }).catch(() => goPage('status'));
              } else {
                goPage('status');
              }
            }, 2000);

          } else {
            // Не оплачен — ошибка
            const icon  = document.getElementById('bk-verify-icon');
            const title = document.getElementById('bk-verify-title');
            const sub   = document.getElementById('bk-verify-sub');
            if (icon)  { icon.classList.add('fail'); icon.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'; }
            if (title) { title.textContent = 'Пардохт тасдиқ нашуд'; title.style.color = 'var(--red)'; }
            if (sub)   sub.textContent = 'Мутаассифона, пардохт тасдиқ нашуд. Лутфан дубора кӯшиш кунед.';
            // Показываем кнопку «Повторить»
            const vEl = document.getElementById('bk-verify');
            if (vEl) {
              const retryBtn = document.createElement('button');
              retryBtn.className = 'bk-verify-retry';
              retryBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>Дубора кӯшиш кунед';
              retryBtn.onclick = () => { location.href = 'payment.html?oid=' + oid; };
              vEl.appendChild(retryBtn);
            }
          }
        } catch(e) {
          console.error('verify check error:', e);
          // При ошибке — просто открываем статус
          activeOid = oid;
          goPage('status');
        }
      }, 1800);

    } else {
      // ── Прямой переход на статус (#order-) ──
      activeOid = oid;
      if (typeof loadOrders === 'function') {
        loadOrders().then(() => {
          goPage('status');
          if (typeof renderStatusPage === 'function') renderStatusPage();
        }).catch(() => goPage('status'));
      } else {
        goPage('status');
      }
    }
  };
  setTimeout(tryOpen, 500);
})();

// ─── Заказы ──────────────────────────────────────────────────
async function loadOrders() {
  try {
    const q = query(collection(db, 'orders'), where('clientId', '==', CU.uid), orderBy('createdAt', 'desc'));
    const s = await getDocs(q);
    orders = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // Если индекс не создан — пробуем без orderBy, сортируем на клиенте
    try {
      const q2 = query(collection(db, 'orders'), where('clientId', '==', CU.uid));
      const s2 = await getDocs(q2);
      orders = s2.docs.map(d => ({ id: d.id, ...d.data() }));
      orders.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
    } catch { orders = []; }
  }
  const live = orders.find(o => ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'delivering'].includes(o.status));
  if (live) { activeOid = live.id; if (!unsubLive) listenLive(live.id); }
  renderOrders(); renderOrdersBadge(); renderLiveBanner();
  // Статистика профиля
  const tot   = orders.length;
  const spent = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const po = document.getElementById('ps-orders'); if (po) po.textContent = tot;
  const ps = document.getElementById('ps-spent');  if (ps) ps.textContent = spent;
}

window.setOTab = function (tab, btn) {
  currentOTab = tab;
  document.querySelectorAll('.otab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrders();
};

function filterOrders() {
  if (currentOTab === 'all')       return orders;
  if (currentOTab === 'active')    return orders.filter(o => ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'delivering'].includes(o.status));
  if (currentOTab === 'delivered') return orders.filter(o => o.status === 'delivered');
  if (currentOTab === 'cancelled') return orders.filter(o => o.status === 'cancelled');
  return orders;
}

function renderOrders() {
  const el   = document.getElementById('orders-list');
  if (!el) return;
  const list = filterOrders();
  if (!list.length) {
    el.innerHTML = '<div class="empty"><span class="empty-ico">📦</span><div class="empty-t">Фармоишҳо нест</div></div>';
    return;
  }
  el.innerHTML = list.map(o => {
    const c     = SC[o.status] || '#888';
    const l     = SL[o.status] || o.status;
    const num   = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
    const items = (o.items || []).map(i => `${i.name} ×${i.quantity}`).join(', ');
    const date  = fmtDate(o.createdAt);
    const isActive = ['awaiting_payment','pending','confirmed','preparing','delivering'].includes(o.status);
    return `<div class="oc st-${o.status}" onclick="openOrderModal('${o.id}')" style="cursor:pointer">
      <div class="oc-head">
        <div class="oc-num">Фармоиш ${num}</div>
        <div class="oc-status" style="color:${c};border-color:${c}30;background:${c}10">${l}</div>
      </div>
      <div class="oc-items">${items}</div>
      <div class="oc-footer">
        <div><div class="oc-total">${o.total} см</div><div class="oc-meta">${date} · ${o.address || ''}</div></div>
        <div class="oc-actions" onclick="event.stopPropagation()">
          ${isActive ? `<div style="width:7px;height:7px;border-radius:50%;background:${c};animation:rpulse 2s infinite;flex-shrink:0"></div>` : ''}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── Модалка детали заказа + чек ──────────────────────────────
window.openOrderModal = function (oid) {
  const o = orders.find(x => x.id === oid);
  if (!o) return;
  const num   = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
  const c     = SC[o.status] || '#888';
  const l     = SL[o.status] || o.status;
  const si    = STEPS.indexOf(o.status);
  const pay   = o.paymentMethod === 'cash' ? 'Нақдӣ 💵' : o.paymentMethod === 'card' ? 'Корт 💳' : 'Онлайн 📱';
  const date  = fmtDate(o.createdAt);
  const isActive = ['awaiting_payment','pending','confirmed','preparing','delivering'].includes(o.status);
  const sub   = (o.items||[]).reduce((s,i) => s + i.price*i.quantity, 0);
  const delivery = o.total - sub;

  // Timeline вертикальный
  const stepIcons = ['⏳','✅','👨‍🍳','🛵','🎉'];
  const stepSubs  = ['Фармоиш қабул шуд', 'Тасдиқ аз тарафи мо', 'Ошпазон омода мекунад', 'Курьер дар роҳ аст', 'Расонида шуд'];
  const timeline  = STEPS.map((s, i) => {
    const cls = i < si ? 'done' : i === si ? 'cur' : '';
    return `<div class="o-track-step ${cls}">
      <div class="o-track-dot">${i <= si ? stepIcons[i] : ''}</div>
      <div class="o-track-info">
        <div class="o-track-title">${SL[s]}</div>
        <div class="o-track-sub">${i === si ? stepSubs[i] : i < si ? 'Анҷом ёфт ✓' : stepSubs[i]}</div>
      </div>
    </div>`;
  }).join('');

  // QR — кодируем короткий ID заказа
  const qrData  = encodeURIComponent(`GAL-${o.id}`);
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}&color=1a9e4a&bgcolor=ffffff&margin=8&format=png`;

  // Чек
  const itemsHtml = (o.items||[]).map(i =>
    `<div class="receipt-row">
      <span class="receipt-row-name">${i.name}</span>
      <span class="receipt-row-qty">×${i.quantity}</span>
      <span class="receipt-row-price">${i.price * i.quantity} см</span>
    </div>`
  ).join('');

  document.getElementById('order-modal-title').textContent = `Фармоиш ${num}`;
  document.getElementById('order-modal-body').innerHTML = `

    <div style="margin:14px 0 4px">
      <button onclick="closeOrderModal();viewOrderStatus('${o.id}')" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:14px;color:#fff;font-family:var(--fd);font-weight:900;font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px var(--acc-shadow);transition:opacity .15s" onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        Ҳолати фармоишро бинед
      </button>
    </div>

    <div class="receipt">
      <!-- шапка чека -->
      <div class="receipt-top">
        <div class="receipt-brand">Galelium Delivery</div>
        <div class="receipt-order-num">Фармоиш ${num}</div>
        <div class="receipt-status-row">
          <div class="receipt-status-dot" style="background:${c}"></div>
          <div class="receipt-status-lbl">${l}</div>
        </div>
      </div>
      <!-- волна -->
      <svg class="receipt-wave" viewBox="0 0 600 20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0 0 Q150 20 300 10 Q450 0 600 15 L600 0 Z" fill="#fff"/></svg>

      <div class="receipt-body">
        <!-- товары -->
        <div class="receipt-section">
          <div class="receipt-section-title">Таркиб</div>
          ${itemsHtml}
        </div>

        <div class="receipt-divider"></div>

        <!-- итоги -->
        <div class="receipt-section" style="margin-bottom:8px">
          <div class="receipt-total-row">
            <span class="receipt-total-label">Маҳсулот</span>
            <span class="receipt-total-val">${sub} см</span>
          </div>
          <div class="receipt-total-row">
            <span class="receipt-total-label">Расонидан</span>
            <span class="receipt-total-val">${delivery > 0 ? delivery : DFEE} см</span>
          </div>
          <div class="receipt-divider" style="margin:8px 0"></div>
          <div class="receipt-total-row big">
            <span class="receipt-total-label">Ҷамъ</span>
            <span class="receipt-total-val">${o.total} см</span>
          </div>
        </div>

        <!-- инфо -->
        <div class="receipt-section">
          <div class="receipt-section-title">Маълумот</div>
          <div class="receipt-info-grid">
            <div class="receipt-info-item">
              <div class="receipt-info-label">Суроғ</div>
              <div class="receipt-info-val">${o.address || '—'}</div>
              ${o.lat && o.lng ? `<a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" style="font-size:.56rem;color:var(--acc);text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:3px;margin-top:4px">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Дар харита кушоед
              </a>` : ''}
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Пардохт</div>
              <div class="receipt-info-val">${pay}</div>
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Курьер</div>
              <div class="receipt-info-val">${o.courierName || 'Таъин мешавад…'}</div>
            </div>
            <div class="receipt-info-item">
              <div class="receipt-info-label">Вақт</div>
              <div class="receipt-info-val">${date}</div>
            </div>
          </div>
          ${o.comment ? `<div class="receipt-info-item" style="margin-top:10px">
            <div class="receipt-info-label">Изоҳ</div>
            <div class="receipt-info-val">${o.comment}</div>
          </div>` : ''}
        </div>

        <!-- QR -->
        <div class="receipt-qr-wrap">
          <div class="receipt-qr">
            <img src="${qrUrl}" alt="QR" loading="lazy">
          </div>
          <div class="receipt-qr-hint">Рамзи фармоиш · GAL-${o.id.slice(-8).toUpperCase()}</div>
        </div>
      </div>

      <div class="receipt-footer">
        <div class="receipt-footer-brand">Galelium Delivery</div>
        <div class="receipt-footer-ts">${date}</div>
      </div>
    </div>

    ${o.status === 'awaiting_payment' ? `
    <div style="margin:10px 0 4px">
      <div style="background:rgba(13,148,136,.08);border:1.5px solid rgba(13,148,136,.25);border-radius:14px;padding:14px 18px;margin-bottom:8px">
        <div style="font-size:.48rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--teal);margin-bottom:6px">⏳ Интизори пардохт</div>
        <div style="font-size:.72rem;color:var(--tx2);line-height:1.6">Фармоиши шумо 10 дақиқа забронировано шудааст. Барои расмикунонӣ пардохт кунед.</div>
        <button onclick="closeOrderModal(); location.href='payment.html?oid=${o.id}'" style="margin-top:12px;width:100%;padding:12px;background:linear-gradient(135deg,var(--teal),#0d9488);border:none;border-radius:12px;color:#fff;font-family:var(--fd);font-weight:900;font-size:.78rem;cursor:pointer;box-shadow:0 4px 14px rgba(13,148,136,.3)">
          💳 Пардохт кунед
        </button>
      </div>
    </div>` : ''}
  ${['awaiting_payment','pending','confirmed'].includes(o.status) ? `
    <div style="margin-top:4px;margin-bottom:8px">
      <button class="btn-sm danger" style="width:100%;padding:10px;font-size:.64rem" onclick="cancelO('${o.id}');closeOrderModal()">Фармоишро бекор кунед</button>
    </div>` : ''}
  `;

  document.getElementById('order-modal-bg').classList.add('open');
  // Если заказ активный — начинаем слушать
  if (isActive && activeOid !== o.id) {
    activeOid = o.id;
    listenLive(o.id);
  }
};

window.closeOrderModal = function (e) {
  if (e && e.target !== document.getElementById('order-modal-bg')) return;
  document.getElementById('order-modal-bg').classList.remove('open');
};

// Открыть статус конкретного заказа
window.viewOrderStatus = function (oid) {
  activeOid = oid;
  goPage('status');
  renderStatusPage();
};


function renderOrdersBadge() {
  const act = orders.filter(o => ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'delivering'].includes(o.status)).length;
  ['orders-nb', 'mob-ord-b'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.style.display = act > 0 ? '' : 'none'; b.textContent = act; }
  });
}

window.cancelO = async function (id) {
  if (!confirm('Фармоишро бекор кунем?')) return;
  try {
    await updateDoc(doc(db, 'orders', id), { status: 'cancelled', updatedAt: serverTimestamp() });
    toast('Фармоиш бекор шуд', 'ok');
    await loadOrders();
  } catch { toast('Хато', 'err'); }
};

window.trackO = function (id) {
  activeOid = id;
  goPage('status');
  renderStatusPage();
};

// ─── Realtime слушатель активного заказа ─────────────────────
function listenLive(oid) {
  if (unsubLive) { unsubLive(); unsubLive = null; }
  unsubLive = onSnapshot(doc(db, 'orders', oid), snap => {
    if (!snap.exists()) return;
    const o   = { id: snap.id, ...snap.data() };
    const idx = orders.findIndex(x => x.id === oid);
    if (idx >= 0) orders[idx] = o; else orders.unshift(o);
    // Обновляем activeOid чтобы страница статуса показывала правильный заказ
    if (activeOid === oid || !activeOid) activeOid = oid;
    renderOrders(); renderOrdersBadge(); renderLiveBanner();
    if (document.getElementById('page-status')?.classList.contains('active')) renderStatusPage();
    // Обновить открытую модалку если она показывает этот заказ
    const modalBg = document.getElementById('order-modal-bg');
    if (modalBg?.classList.contains('open')) {
      const title = document.getElementById('order-modal-title')?.textContent || '';
      const num   = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
      if (title.includes(num.replace('#',''))) openOrderModal(oid);
    }
    if (['delivered', 'cancelled'].includes(o.status)) {
      if (unsubLive) { unsubLive(); unsubLive = null; }
      if (o.status === 'delivered') toast('🎉 Фармоиш расонида шуд!', 'ok');
    }
  });
}

// ─── Live-баннер на главной ───────────────────────────────────
function renderLiveBanner() {
  const wrap = document.getElementById('live-wrap');
  if (!wrap) return;
  const live = orders.find(o => ['pending', 'confirmed', 'preparing', 'delivering'].includes(o.status));
  if (!live) { wrap.innerHTML = ''; return; }
  const num = live.orderNumber ? '#' + live.orderNumber : '#' + live.id.slice(-6);
  wrap.innerHTML = `<div class="live-banner" onclick="trackO('${live.id}')"><div class="live-pulse"></div><div class="live-info"><div class="live-lbl">Фармоиши фаъол</div><div class="live-txt">Фармоиш ${num} · ${SL[live.status]} · ${live.total} см</div></div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>`;
}

// ─── Карта трекинга курьера (страница «Ҳолати фармоиш») ───────
// ─── Карта трекинга курьера (страница «Ҳолати фармоиш») ───────
// Карта — звичайна карточка в потоці сторінки, з'являється ЛИШЕ
// коли курьер призначений (courierId є в замовленні).
let _trackMap          = null;
let _trackMarkerDest   = null;
let _trackMarkerCour   = null;
let _trackRouteLine    = null;
let _trackCourierUnsub = null;
let _trackCourierId    = null;
let _trackFitted       = false;
let _trackLastOid      = null;

const SC_HEX = {
  pending:    '#d97706',
  confirmed:  '#2563eb',
  preparing:  '#7c3aed',
  delivering: '#1a9e4a',
  delivered:  '#1a9e4a',
  cancelled:  '#dc2626',
};

function mkTrackIcon(html, size) {
  return L.divIcon({ html, className: 'smap-marker-wrap', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ICO_DEST    = '<div class="smap-marker-dest"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6"><circle cx="12" cy="12" r="3"/></svg></div>';
const ICO_COURIER = '<div class="smap-marker-courier"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg></div>';

/**
 * Показывает/скрывает карточку карты. Карта видна ТОЛЬКО когда:
 *  - у заказа есть координаты доставки
 *  - курьер уже назначен (o.courierId)
 *  - статус не финальный (не delivered/cancelled)
 * Leaflet-инстанс создаётся один раз и переиспользуется —
 * контейнер #status-map статичен и не пересоздаётся при ре-рендере.
 */
function renderStatusMap(o) {
  const card = document.getElementById('status-map-card');
  const info = document.getElementById('status-map-info');
  if (!card) return;

  const hasCoords = o && o.lat != null && o.lng != null;
  const TERMINAL  = ['delivered', 'cancelled'];
  const showMap   = hasCoords && !!o.courierId && !TERMINAL.includes(o.status);

  if (!showMap) {
    card.style.display = 'none';
    if (info) info.style.display = 'none';
    stopCourierTracking();
    return;
  }

  if (_trackLastOid !== o.id) { _trackLastOid = o.id; _trackFitted = false; }

  card.style.display = 'block';

  if (!_trackMap) {
    _trackMap = L.map('status-map', {
      center: [o.lat, o.lng], zoom: 15,
      zoomControl: true, attributionControl: false,
    });
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
    _trackCourierId = o.courierId;
    _trackCourierUnsub = onSnapshot(doc(db, 'couriers', o.courierId), snap => {
      if (!snap.exists()) return;
      const loc = snap.data()?.location;
      if (!loc || loc.lat == null || loc.lng == null) return;
      updateCourierOnMap(o, loc.lat, loc.lng);
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

  const dist = haversineKm(lat, lng, o.lat, o.lng);
  const distTxt = dist < 1 ? Math.round(dist * 1000) + ' м' : dist.toFixed(1) + ' км';
  const nameEl = document.getElementById('status-map-info-name');
  const distEl = document.getElementById('status-map-info-dist');
  if (nameEl) nameEl.textContent = o.courierName || 'Курьер';
  if (distEl) distEl.textContent = distTxt;
}

function stopCourierTracking() {
  if (_trackCourierUnsub) { _trackCourierUnsub(); _trackCourierUnsub = null; }
  _trackCourierId = null;
  if (_trackMarkerCour) { _trackMarkerCour.remove(); _trackMarkerCour = null; }
  if (_trackRouteLine)  { _trackRouteLine.remove();  _trackRouteLine  = null; }
}

// ─── Страница статуса заказа ──────────────────────────────────
function renderStatusPage() {
  const el = document.getElementById('status-content');
  if (!el) return;

  let o = null;
  if (activeOid) o = orders.find(x => x.id === activeOid);
  if (!o) o = orders.find(x => ['pending', 'confirmed', 'preparing', 'delivering'].includes(x.status));
  if (!o && orders.length > 0) o = orders[0];

  renderStatusMap(o);

  if (!o) {
    el.innerHTML = '<div class="empty"><span class="empty-ico">📍</span><div class="empty-t">Фармоишҳои фаъол нест</div><div class="empty-s">Пас аз расмикунонӣ ин ҷо намоён мешавад</div></div>';
    return;
  }

  const c    = SC[o.status] || '#888';
  const l    = SL[o.status] || o.status;
  const si   = STEPS.indexOf(o.status);
  const num  = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
  const date = fmtDate(o.createdAt);
  const pay  = o.paymentMethod === 'cash' ? 'Нақдӣ' : o.paymentMethod === 'card' ? 'Корт' : 'Онлайн';

  const stepIcoDone = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
  const steps = STEPS.map((s, i) => {
    const cls = i < si ? 'done' : i === si ? 'cur' : '';
    return `<div class="track-step ${cls}"><div class="track-dot">${i < si ? stepIcoDone : ''}</div><div class="track-lbl">${SL[s]}</div></div>`;
  }).join('');

  el.innerHTML = `<div class="oc st-${o.status}" style="padding:18px 20px">
    <div class="oc-head"><div class="oc-num">Фармоиш ${num}</div><div class="oc-status" style="color:${c};border-color:${c}30;background:${c}10">${l}</div></div>
    <div class="track">${steps}</div><div class="divider"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:.76rem">
      <div><div class="sh-tag" style="margin-bottom:3px">Суроғ</div><div style="color:var(--tx)">${o.address || '—'}</div></div>
      <div><div class="sh-tag" style="margin-bottom:3px">Пардохт</div><div style="color:var(--tx)">${pay}</div></div>
      <div><div class="sh-tag" style="margin-bottom:3px">Курьер</div><div style="color:var(--tx)">${o.courierName || 'Таъин мешавад…'}</div></div>
      <div><div class="sh-tag" style="margin-bottom:3px">Вақт</div><div style="color:var(--tx)">${date}</div></div>
    </div>

    ${o.courierId ? `
    <button class="chat-trigger" onclick="openChat('${o.id}')">
      <div class="chat-trigger-ico">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
      </div>
      <div class="chat-trigger-body">
        <div class="chat-trigger-title">Чат бо курьер</div>
        <div class="chat-trigger-sub">${o.lastMessageAt ? escHtml(o.lastMessage || 'Паём') : (escHtml(o.courierName || 'Курьер') + ' — нависед агар савол дошта бошед')}</div>
      </div>
      ${o.clientUnread > 0 ? `<div class="chat-trigger-badge">${o.clientUnread}</div>` : `<svg class="chat-trigger-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`}
    </button>` : ''}

    <div class="divider"></div>
    <div class="sh-tag" style="margin-bottom:10px">Таркиб</div>
    ${(o.items || []).map(i => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--b0);font-size:.75rem"><span style="color:var(--tx)">${escHtml(i.name)}<span style="color:var(--tx3)"> ×${i.quantity}</span></span><span style="font-weight:600;color:var(--tx2)">${i.price * i.quantity} см</span></div>`).join('')}
    <div style="display:flex;justify-content:space-between;font-size:.72rem;padding:8px 0;color:var(--tx3)"><span>Расонидан</span><span>${DFEE} см</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--b0)"><span style="font-weight:700;font-size:.8rem">Ҷамъ</span><span style="font-family:var(--fd);font-weight:900;font-size:1.15rem;color:var(--acc)">${o.total} см</span></div>
    ${o.status === 'awaiting_payment' ? `
    <div style="margin-top:16px;background:rgba(13,148,136,.08);border:1.5px solid rgba(13,148,136,.28);border-radius:16px;padding:16px 18px">
      <div style="font-size:.48rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--teal);margin-bottom:6px">⏳ Интизори пардохт</div>
      <div style="font-size:.72rem;color:var(--tx2);line-height:1.6;margin-bottom:12px">Фармоиш забронировано шудааст. Барои расмикунонии фармоиш, лутфан дар муддати 10 дақиқа пардохт кунед.</div>
      <button onclick="location.href='payment.html?oid=${o.id}'" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--teal),#0d9488);border:none;border-radius:12px;color:#fff;font-family:var(--fd);font-weight:900;font-size:.8rem;cursor:pointer;box-shadow:0 4px 14px rgba(13,148,136,.3);display:flex;align-items:center;justify-content:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        💳 Пардохт кунед
      </button>
    </div>` : ''}
    ${['awaiting_payment','pending', 'confirmed'].includes(o.status) ? `<div style="margin-top:14px"><button class="btn-sm danger" onclick="cancelO('${o.id}')">Фармоишро бекор кунед</button></div>` : ''}

    ${o.confirmCode && !['cancelled'].includes(o.status) ? `
    <div style="margin-top:18px;background:${o.status === 'client_arrived' ? 'linear-gradient(135deg,rgba(26,158,74,.1),rgba(34,197,94,.05))' : 'linear-gradient(135deg,rgba(26,158,74,.06),rgba(34,197,94,.02))'};border:2px solid ${o.status === 'client_arrived' ? 'rgba(26,158,74,.35)' : 'rgba(26,158,74,.18)'};border-radius:18px;padding:20px;text-align:center">
      <div style="font-size:.55rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);margin-bottom:10px">${o.status === 'client_arrived' ? 'Рамзи тасдиқ барои курьер' : 'Рамзи тасдиқи фармоиш'}</div>
      <div style="font-family:var(--fd);font-weight:900;font-size:3.4rem;color:var(--tx);letter-spacing:.22em;line-height:1">${o.confirmCode}</div>
      <div style="font-size:.62rem;color:var(--tx3);margin-top:10px;line-height:1.6">${o.status === 'client_arrived' ? 'Ин рамзро ба курьер гӯед — ӯ фармоишро тасдиқ мекунад' : o.status === 'delivered' ? 'Фармоиш расонида шуд' : 'Ин рамзро ҳангоми расидани курьер ба ӯ гӯед'}</div>
    </div>` : ''}
  </div>`;
}


// ─── ЧАТ З КУРЬЕРОМ ────────────────────────────────────────────
let chatOid      = null;
let chatUnsub    = null;
let chatMessages = [];

window.openChat = async function (oid) {
  const o = orders.find(x => x.id === oid);
  if (!o) return;
  chatOid = oid;

  const bg = document.getElementById('chat-modal-bg');
  if (bg) bg.classList.add('open');

  const nameEl = document.getElementById('chat-modal-name');
  if (nameEl) nameEl.textContent = o.courierName || 'Курьер';
  const avEl = document.getElementById('chat-modal-av');
  if (avEl) avEl.textContent = (o.courierName || 'К').trim().charAt(0).toUpperCase() || 'К';
  const subEl = document.getElementById('chat-modal-sub');
  if (subEl) subEl.textContent = 'Фармоиш ' + (o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6));

  // Сбрасываем счётчик непрочитанных для клиента
  try { await updateDoc(doc(db, 'orders', oid), { clientUnread: 0 }); } catch {}

  listenChatMessages(oid);
  setTimeout(() => document.getElementById('chat-input')?.focus(), 350);
};

window.closeChat = function () {
  const bg = document.getElementById('chat-modal-bg');
  if (bg) bg.classList.remove('open');
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  chatOid = null;
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

  if (chatMessages.length === 0) {
    wrap.innerHTML = `<div class="chat-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
      <div class="chat-empty-t">Ҳанӯз паём нест</div>
      <div class="chat-empty-s">Ба курьер нависед, агар дар бораи фармоиш савол дошта бошед</div>
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
      text,
      senderId:   CU.uid,
      senderRole: 'client',
      senderName: UD?.displayName || 'Мизоҷ',
      createdAt:  serverTimestamp(),
    });
    await updateDoc(doc(db, 'orders', chatOid), {
      courierUnread:         increment(1),
      lastMessage:           text.slice(0, 120),
      lastMessageAt:         serverTimestamp(),
      lastMessageSenderRole: 'client',
    });
  } catch (e) {
    toast('Хато ҳангоми фиристодани паём', 'err');
  }
  if (btn) btn.disabled = false;
  inp.focus();
};

// ─── ТЕХ. ПОДДЕРЖКА ────────────────────────────────────────────
let supportTicketId        = null;
let supportUnsub           = null; // слушатель сообщений
let supportTicketDocUnsub  = null; // слушатель самого тикета (статус)
let supportBadgeUnsub      = null; // слушатель бейджа (все тикеты клиента)
let supportMessages        = [];
let supportSelectedOrderId = null; // null = без привязки заказа
let supportOrderListOpen   = false;

// Точка входа: если есть открытый тикет — сразу чат, иначе — композер нового обращения
window.openSupport = async function () {
  const bg = document.getElementById('support-modal-bg');
  if (bg) bg.classList.add('open');

  try {
    const q = query(
      collection(db, 'supportTickets'),
      where('clientId', '==', CU.uid),
      where('status', 'in', ['open', 'in_progress']),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Берём самый свежий из открытых
      const docs = snap.docs.sort((a, b) => (b.data().updatedAt?.toMillis?.() || 0) - (a.data().updatedAt?.toMillis?.() || 0));
      openSupportChat(docs[0].id);
      return;
    }
  } catch (e) { /* при отсутствии индекса — просто откроем композер */ }

  showSupportComposer();
};

function showSupportComposer() {
  supportTicketId = null;
  if (supportUnsub)          { supportUnsub(); supportUnsub = null; }
  if (supportTicketDocUnsub) { supportTicketDocUnsub(); supportTicketDocUnsub = null; }

  document.getElementById('support-composer').style.display   = 'block';
  document.getElementById('support-messages').style.display   = 'none';
  document.getElementById('support-input-row').style.display  = 'none';
  document.getElementById('support-status-banner').innerHTML  = '';
  const msgEl = document.getElementById('support-first-msg');
  if (msgEl) msgEl.value = '';
  const sub = document.getElementById('support-modal-sub');
  if (sub) sub.textContent = 'Ба зудӣ ҷавоб медиҳем';

  supportOrderListOpen = false;
  renderSupportOrderPicker();
}

function renderSupportOrderPicker() {
  const wrap = document.getElementById('support-order-picker');
  if (!wrap) return;

  if (!orders || orders.length === 0) {
    supportSelectedOrderId = null;
    wrap.innerHTML = `<div class="sup-no-orders">Шумо ҳанӯз фармоише надоред — метавонед бе интихоби фармоиш нависед</div>`;
    return;
  }

  if (supportSelectedOrderId === undefined) supportSelectedOrderId = null;
  // Автовыбор последнего заказа при первом открытии
  if (supportSelectedOrderId === null && !supportOrderListOpen && !wrap.dataset.touched) {
    supportSelectedOrderId = orders[0].id;
  }
  wrap.dataset.touched = '1';

  const sel = supportSelectedOrderId ? orders.find(o => o.id === supportSelectedOrderId) : null;

  let html = '';
  if (sel) {
    const num = sel.orderNumber ? '#' + sel.orderNumber : '#' + sel.id.slice(-6).toUpperCase();
    html += `<div class="sup-order-card">
      <div class="sup-order-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="sup-order-body">
        <div class="sup-order-num">${num}</div>
        <div class="sup-order-meta">${SL[sel.status] || sel.status} · ${sel.total || 0} см · ${fmtDate(sel.createdAt)}</div>
      </div>
    </div>`;
  } else {
    html += `<div class="sup-order-card dim">
      <div class="sup-order-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="sup-order-body">
        <div class="sup-order-num">Бе фармоиш</div>
        <div class="sup-order-meta">Муроҷиати умумӣ</div>
      </div>
    </div>`;
  }
  html += `<button class="sup-order-change" onclick="toggleSupportOrderList()">${supportOrderListOpen ? 'Пинҳон кардан' : 'Фармоиши дигар / бе фармоиш'}</button>`;

  const listItems = orders.slice(0, 5).map(o => {
    const num = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6).toUpperCase();
    return `<div class="sup-order-list-item" onclick="selectSupportOrder('${o.id}')">
      <span>${num}</span><span style="color:var(--tx3);font-size:.66rem">${SL[o.status] || o.status}</span>
    </div>`;
  }).join('');
  html += `<div class="sup-order-list ${supportOrderListOpen ? 'open' : ''}" id="sup-order-list">
    ${listItems}
    <div class="sup-order-list-item no-order" onclick="clearSupportOrder()">Бе интихоби фармоиш</div>
  </div>`;

  wrap.innerHTML = html;
}

window.toggleSupportOrderList = function () {
  supportOrderListOpen = !supportOrderListOpen;
  renderSupportOrderPicker();
};
window.selectSupportOrder = function (oid) {
  supportSelectedOrderId = oid;
  supportOrderListOpen = false;
  renderSupportOrderPicker();
};
window.clearSupportOrder = function () {
  supportSelectedOrderId = null;
  supportOrderListOpen = false;
  renderSupportOrderPicker();
};

window.createSupportTicket = async function () {
  const inp  = document.getElementById('support-first-msg');
  const text = inp ? inp.value.trim() : '';
  if (!text) { toast('Паёмро нависед', 'warn'); return; }

  const btn = document.getElementById('support-send-first');
  if (btn) { btn.disabled = true; }

  const order = supportSelectedOrderId ? orders.find(o => o.id === supportSelectedOrderId) : null;
  const subject = order
    ? `Дар бораи фармоиш #${order.orderNumber || order.id.slice(-6).toUpperCase()}`
    : 'Муроҷиати умумӣ';

  try {
    const ref = await addDoc(collection(db, 'supportTickets'), {
      clientId:      CU.uid,
      clientName:    UD?.displayName || 'Мизоҷ',
      clientPhone:   UD?.phone || '',
      orderId:       order ? order.id : null,
      orderNumber:   order ? (order.orderNumber || order.id.slice(-6).toUpperCase()) : null,
      subject,
      status:        'open',
      lastMessage:   text.slice(0, 120),
      lastMessageAt: serverTimestamp(),
      lastMessageSenderRole: 'client',
      clientUnread:  0,
      adminUnread:   1,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    });
    await addDoc(collection(db, 'supportTickets', ref.id, 'messages'), {
      text,
      senderId:   CU.uid,
      senderRole: 'client',
      senderName: UD?.displayName || 'Мизоҷ',
      createdAt:  serverTimestamp(),
    });
    openSupportChat(ref.id);
  } catch (e) {
    toast('Хато рӯй дод. Бори дигар кӯшиш кунед', 'err');
  }
  if (btn) btn.disabled = false;
};

function openSupportChat(ticketId) {
  supportTicketId = ticketId;
  document.getElementById('support-composer').style.display  = 'none';
  document.getElementById('support-messages').style.display  = 'flex';
  document.getElementById('support-input-row').style.display = 'flex';

  updateDoc(doc(db, 'supportTickets', ticketId), { clientUnread: 0 }).catch(() => {});

  listenSupportMessages(ticketId);
  listenSupportTicketDoc(ticketId);
  setTimeout(() => document.getElementById('support-input')?.focus(), 300);
}

function listenSupportMessages(ticketId) {
  if (supportUnsub) { supportUnsub(); supportUnsub = null; }
  const q = query(collection(db, 'supportTickets', ticketId, 'messages'), orderBy('createdAt', 'asc'));
  supportUnsub = onSnapshot(q, snap => {
    supportMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSupportMessages();
  });
}

function listenSupportTicketDoc(ticketId) {
  if (supportTicketDocUnsub) { supportTicketDocUnsub(); supportTicketDocUnsub = null; }
  supportTicketDocUnsub = onSnapshot(doc(db, 'supportTickets', ticketId), snap => {
    if (!snap.exists()) return;
    const t = snap.data();
    updateSupportStatusBanner(t.status);
    // Пока модал открыт на этом тикете — сразу гасим непрочитанные
    if (t.clientUnread > 0) {
      updateDoc(doc(db, 'supportTickets', ticketId), { clientUnread: 0 }).catch(() => {});
    }
  });
}

function updateSupportStatusBanner(status) {
  const el = document.getElementById('support-status-banner');
  const inputRow = document.getElementById('support-input-row');
  if (!el) return;

  if (status === 'resolved') {
    el.innerHTML = `<div class="sup-status-banner resolved">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
      Ин муроҷиат ҳал шудааст
      <button class="sup-status-banner-btn" onclick="startNewSupportTicket()">Муроҷиати нав</button>
    </div>`;
    if (inputRow) inputRow.style.display = 'none';
  } else if (status === 'in_progress') {
    el.innerHTML = `<div class="sup-status-banner progress">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Мутахассис бо шумо кор мекунад
    </div>`;
    if (inputRow) inputRow.style.display = 'flex';
  } else {
    el.innerHTML = '';
    if (inputRow) inputRow.style.display = 'flex';
  }
}

window.startNewSupportTicket = function () {
  showSupportComposer();
};

function renderSupportMessages() {
  const wrap = document.getElementById('support-messages');
  if (!wrap) return;

  if (supportMessages.length === 0) {
    wrap.innerHTML = `<div class="chat-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 11a9 9 0 0118 0v5a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3M3 11v3a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3"/></svg>
      <div class="chat-empty-t">Мунтазири ҷавоб</div>
      <div class="chat-empty-s">Мутахассиси мо ба зудӣ ҷавоб медиҳад</div>
    </div>`;
    return;
  }

  wrap.innerHTML = supportMessages.map(m => {
    const mine = m.senderRole === 'client';
    const time = m.createdAt?.toDate
      ? m.createdAt.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="chat-msg ${mine ? 'chat-msg-me' : 'chat-msg-them'}">${escHtml(m.text)}<span class="chat-msg-time">${time}</span></div>`;
  }).join('');

  wrap.scrollTop = wrap.scrollHeight;
}

window.sendSupportMsg = async function () {
  const inp = document.getElementById('support-input');
  if (!inp || !supportTicketId) return;
  const text = inp.value.trim();
  if (!text) return;

  inp.value = '';
  inp.style.height = 'auto';
  const btn = document.getElementById('support-send-btn');
  if (btn) btn.disabled = true;

  try {
    await addDoc(collection(db, 'supportTickets', supportTicketId, 'messages'), {
      text,
      senderId:   CU.uid,
      senderRole: 'client',
      senderName: UD?.displayName || 'Мизоҷ',
      createdAt:  serverTimestamp(),
    });
    await updateDoc(doc(db, 'supportTickets', supportTicketId), {
      adminUnread:           increment(1),
      lastMessage:           text.slice(0, 120),
      lastMessageAt:         serverTimestamp(),
      lastMessageSenderRole: 'client',
      // Если клиент пишет после решения — считаем обращение снова открытым
      status:                'open',
      updatedAt:             serverTimestamp(),
    });
  } catch (e) {
    toast('Хато ҳангоми фиристодани паём', 'err');
  }
  if (btn) btn.disabled = false;
  inp.focus();
};

window.closeSupport = function () {
  document.getElementById('support-modal-bg')?.classList.remove('open');
  if (supportUnsub)          { supportUnsub(); supportUnsub = null; }
  if (supportTicketDocUnsub) { supportTicketDocUnsub(); supportTicketDocUnsub = null; }
  supportTicketId = null;
  supportMessages = [];
};

// Глобальный бейдж непрочитанных — работает независимо от того, открыт ли модал
function listenSupportBadge() {
  if (supportBadgeUnsub) { supportBadgeUnsub(); supportBadgeUnsub = null; }
  if (!CU) return;
  const q = query(
    collection(db, 'supportTickets'),
    where('clientId', '==', CU.uid),
    where('status', 'in', ['open', 'in_progress']),
  );
  supportBadgeUnsub = onSnapshot(q, snap => {
    let total = 0;
    snap.forEach(d => { total += d.data().clientUnread || 0; });
    updateSupportBadgeUI(total);
  }, () => { /* индекс ещё не готов — тихо игнорируем */ });
}

function updateSupportBadgeUI(count) {
  const has = count > 0;
  const entryBadge = document.getElementById('support-entry-badge');
  if (entryBadge) { entryBadge.style.display = has ? 'flex' : 'none'; entryBadge.textContent = count; }
  const mobBadge = document.getElementById('mob-prof-b');
  if (mobBadge) { mobBadge.style.display = has ? 'flex' : 'none'; mobBadge.textContent = count; }
  const sbBadge = document.getElementById('support-nb');
  if (sbBadge) { sbBadge.style.display = has ? 'flex' : 'none'; sbBadge.textContent = count; }
}

// ─── Профиль ─────────────────────────────────────────────────
function renderProfile() {
  const name = UD?.displayName || CU.displayName || '';
  const init = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const phone = UD?.phone || phoneFromPseudoEmail(CU.email);
  const pn = document.getElementById('p-name');  if (pn) pn.textContent = name || 'Бе ном';
  const pp = document.getElementById('p-phone'); if (pp) pp.textContent = phone || '—';
  const av = document.getElementById('p-av');    if (av) av.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;
  const pfn = document.getElementById('pf-name');  if (pfn) pfn.value = name;
  const pfp = document.getElementById('pf-phone'); if (pfp) pfp.value = phone;
  const pfa = document.getElementById('pf-addr');  if (pfa) pfa.value = UD?.address || '';
  // Показываем координаты если есть
  const pfc = document.getElementById('pf-addr-coords');
  if (pfc) {
    if (UD?.lat && UD?.lng) {
      pfc.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${parseFloat(UD.lat).toFixed(5)}, ${parseFloat(UD.lng).toFixed(5)}`;
      pfc.style.display = 'block';
    } else {
      pfc.style.display = 'none';
    }
  }
}

window.saveProfile = async function () {
  const name  = document.getElementById('pf-name').value.trim();
  const addr  = document.getElementById('pf-addr').value.trim();
  try {
    // Если адрес вручную изменён — сбрасываем координаты (они уже не актуальны)
    const addrChanged = addr !== UD?.address;
    const saveData = {
      displayName: name,
      // Телефон НЕ сохраняем — это идентификатор dastdaroz ID, менять его тут нельзя
      address: addr,
      updatedAt: serverTimestamp(),
    };
    // Сохраняем координаты только если адрес не менялся вручную
    if (!addrChanged && UD?.lat && UD?.lng) {
      saveData.lat = UD.lat;
      saveData.lng = UD.lng;
    } else if (addrChanged) {
      // При ручном вводе адреса пробуем геокодировать через Nominatim
      saveData.lat = null;
      saveData.lng = null;
    }
    await setDoc(doc(db, 'users', CU.uid), saveData, { merge: true });
    UD = { ...UD, ...saveData };
    renderSB(); renderProfile(); setAddr();
    toast('Профил сақл шуд', 'ok');
  } catch { toast('Хато', 'err'); }
};

window.uploadAvUI = async function (inp) {
  const f = inp.files[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { toast('Файл хеле калон аст', 'err'); return; }
  toast('Боргузорӣ…');
  try {
    const sr  = sRef(storage, `avatars/${CU.uid}`);
    await uploadBytes(sr, f);
    const url = await getDownloadURL(sr);
    await setDoc(doc(db, 'users', CU.uid), { avatarUrl: url, updatedAt: serverTimestamp() }, { merge: true });
    UD.avatarUrl = url;
    renderSB(); renderProfile();
    toast('Акс навсозӣ шуд', 'ok');
  } catch { toast('Хатои боргузорӣ', 'err'); }
};


// ═══════════════════════════════════════════════════════════════
//  BOOKING PAGE — логика страницы тасдиқи пардохт
// ═══════════════════════════════════════════════════════════════

/** Рендерит чек на странице бронирования */
function renderBookingPage() {
  if (!_bookingOrder) return;
  const o   = _bookingOrder;
  const num = o.orderNumber ? '#' + o.orderNumber : '#' + (o.id || '').slice(-6);

  const receiptEl = document.getElementById('bk-receipt-card');
  if (!receiptEl) return;

  const itemsHtml = o.items.map(i =>
    `<div class="bk-receipt-item">
       <span class="bk-receipt-item-name">${escHtml(i.name)}</span>
       <span class="bk-receipt-item-qty">×${i.quantity}</span>
       <span class="bk-receipt-item-price">${i.price * i.quantity} см</span>
     </div>`
  ).join('');

  receiptEl.innerHTML = `
    <div class="bk-receipt-head">
      <div class="bk-receipt-brand">Dastdaroz</div>
      <div class="bk-receipt-num">Фармоиш ${num}</div>
      <div class="bk-receipt-status">
        <div class="bk-receipt-status-dot"></div>
        Интизори пардохт
      </div>
    </div>
    <div class="bk-receipt-body">
      <div class="bk-receipt-items">${itemsHtml}</div>
      <div class="bk-receipt-divider"></div>
      <div class="bk-receipt-sum-row"><span>Маҳсулот</span><span>${o.subtotal} см</span></div>
      <div class="bk-receipt-sum-row"><span>Расонидан</span><span>${o.deliveryFee} см</span></div>
      <div class="bk-receipt-total-row">
        <span class="bk-receipt-total-lbl">Ҷамъ</span>
        <span class="bk-receipt-total-val">${o.total} см</span>
      </div>
      ${o.address ? `<div class="bk-receipt-addr">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${escHtml(o.address)}
      </div>` : ''}
    </div>`;

  // Reset expired state when re-entering booking page
  const expEl = document.getElementById('bk-expired');
  if (expEl) expEl.style.display = 'none';
  document.querySelectorAll('.bk-pay-btn').forEach(b => { b.disabled = false; });
  const cancelBtn = document.getElementById('bk-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = '';
}

/** Запускает (или перезапускает) таймер обратного отсчёта */
function startBookingTimer() {
  stopBookingTimer();
  updateBookingTimer();
  _bookingTimerInt = setInterval(updateBookingTimer, 1000);
}

function stopBookingTimer() {
  if (_bookingTimerInt) { clearInterval(_bookingTimerInt); _bookingTimerInt = null; }
}

function updateBookingTimer() {
  if (!_bookingDeadline) return;
  const dl   = _bookingDeadline instanceof Date ? _bookingDeadline.getTime() : Number(_bookingDeadline);
  const left = dl - Date.now();

  if (left <= 0) {
    stopBookingTimer();
    expireBooking();
    return;
  }

  const m  = Math.floor(left / 60000);
  const s  = Math.floor((left % 60000) / 1000);
  const el = document.getElementById('bk-timer-val');
  if (el) el.textContent = m + ':' + String(s).padStart(2, '0');

  const total = 10 * 60 * 1000;
  const pct   = Math.max(0, Math.min(100, (left / total) * 100));
  const bar   = document.getElementById('bk-timer-bar');
  if (bar) {
    bar.style.width      = pct + '%';
    bar.style.background = pct > 40 ? 'var(--acc)' : pct > 15 ? 'var(--amber)' : 'var(--red)';
  }
  if (el) el.style.color = left < 60000 ? 'var(--red)' : left < 180000 ? 'var(--amber)' : 'var(--acc)';
}

/** Вызывается, когда 10 минут истекли */
async function expireBooking() {
  if (_bookingOid) {
    try {
      await updateDoc(doc(db, 'orders', _bookingOid), {
        status:        'cancelled',
        paymentStatus: 'expired',
        cancelReason:  'Вақти пардохт гузашт',
        updatedAt:     serverTimestamp(),
      });
      await loadOrders();
    } catch(e) { console.error('expireBooking:', e); }
  }
  const valEl = document.getElementById('bk-timer-val');
  if (valEl) { valEl.textContent = '0:00'; valEl.style.color = 'var(--red)'; }
  const barEl = document.getElementById('bk-timer-bar');
  if (barEl) { barEl.style.width = '0%'; barEl.style.background = 'var(--red)'; }
  const expEl = document.getElementById('bk-expired');
  if (expEl) expEl.style.display = 'block';
  document.querySelectorAll('.bk-pay-btn').forEach(b => { b.disabled = true; });
  const cancelBtn = document.getElementById('bk-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

/** Нажатие «Оплатить картой» → переход на payment.html */
window.goToCardPayment = function() {
  if (!_bookingOid) { toast('Хато: Фармоиш ёфт нашуд', 'err'); return; }
  stopBookingTimer();
  location.href = 'payment.html?oid=' + _bookingOid;
};

/** Нажатие «Отменить» на странице бронирования */
window.cancelBooking = async function() {
  if (!confirm('Фармоишро бекор кунем?')) return;
  stopBookingTimer();
  if (_bookingOid) {
    try {
      await updateDoc(doc(db, 'orders', _bookingOid), {
        status:        'cancelled',
        paymentStatus: 'cancelled',
        cancelReason:  'Бекор аз тарафи корбар',
        updatedAt:     serverTimestamp(),
      });
      await loadOrders();
    } catch(e) { console.error(e); }
  }
  _bookingOid      = null;
  _bookingOrder    = null;
  _bookingDeadline = null;
  toast('Фармоиш бекор шуд');
  goPage('home');
};
