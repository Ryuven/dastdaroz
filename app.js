// ============================================================
//  app.js — Клиентская логика dastdaroz
//  Используется в: home.html
//
//  Разделы:
//    1. Импорты
//    2. Состояние приложения
//    3. Константы
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
//   19. Кошелёк (я удалил кошелек)
//   20. Выбор города
// ============================================================

// ─── 1. Импорты ──────────────────────────────────────────────
import { auth, db, storage, ORDER_STATUS } from './firebase.js';
import { Sheet }    from './sheet.js';
import { SheetPdf } from './sheet-pdf.js';

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
// ─── Возврат с платёжной страницы Алифа ─────────────────────
const _payReturnOid = new URLSearchParams(location.search).get('order') || null;
if (_payReturnOid) history.replaceState({}, '', location.pathname + location.hash);

let CU               = null;   // текущий пользователь Firebase Auth
let UD               = null;   // документ пользователя из Firestore
let GUEST            = false;  // режим гостя

let cart             = [];
let prods            = [];
let cats             = [];
let orders           = [];
let stores           = [];


let catFilter        = 'all';
let searchQ          = '';
let homeSearchQ      = '';
let activeOid        = null;
let unsubLive        = null;
let unsubBooked      = null;
let currentOTab      = 'all';
let activeStore      = null;
let storeCatFilter   = 'all';
let jsonMenuData     = null;
let jsonProdsMap     = {};
let deliveryService  = 'mavsimi';
let deliveryServices = [];        // загружается из Firestore коллекции deliveryServices
let activeCollection = null;      // 'bookedOrders' | 'dastdarozOrders' | 'mavsimiOrders'

let _selectedCityId   = localStorage.getItem('selectedCityId')   || 'dushanbe';
let _selectedCityName = localStorage.getItem('selectedCityName') || 'Душанбе';
let _addrBannerUnsub  = null;


// ─── 3. Константы ────────────────────────────────────────────
const DFEE = 7; // стоимость доставки (сомони)

// Лейблы статусов заказа
const SL = {
  reserved:   'Забронирован',
  pending:    'Ожидание',
  confirmed:  'Подтверждён',
  preparing:  'Готовится',
  delivering: 'В пути',
  delivered:  'Доставлен',
  cancelled:  'Отменён',
};

// Цвета статусов
const SC = {
  reserved:   'var(--teal)',
  pending:    'var(--amber)',
  confirmed:  'var(--blue)',
  preparing:  'var(--purple)',
  delivering: 'var(--acc)',
  delivered:  'var(--acc)',
  cancelled:  'var(--red)',
};

// Длительность бронирования


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

  // ── Liked products ─────────────────────────────────────────
  Sheet.define({ id: 'likes', title: 'Понравившиеся товары', zIndex: 700 });
  Sheet.body('likes').innerHTML = `
    <div class="likesh-empty">
      <div class="likesh-empty-ico">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
      </div>
      <div class="likesh-empty-title">Скоро добавим эту функцию</div>
      <div class="likesh-empty-sub">Здесь будут отображаться товары, которые вам понравились</div>
    </div>`;

  // ── Bookings (бронированные) ──────────────────────────────
  Sheet.define({ id: 'bookings', title: 'Бронированные', zIndex: 700, onOpen: renderBookingsSheet });

  // ── Support chat ────────────────────────────────────────────
  Sheet.define({ id: 'support', title: 'Чат с поддержкой', zIndex: 700 });
  (function(){
    const b = Sheet.body('support');
    b.style.cssText = 'overflow:hidden;display:flex;flex-direction:column;padding:0;flex:1';
    b.innerHTML = `
      <div class="supsh-msgs" id="supsh-msgs">
        <div class="supsh-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <div class="supsh-empty-t">Нет сообщений</div>
          <div class="supsh-empty-s">Напишите нам — ответим быстро</div>
        </div>
      </div>
      <div class="supsh-input-row">
        <textarea class="supsh-input" id="supsh-input" rows="1" placeholder="Написать сообщение…"
          oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSupportMsg();}"></textarea>
        <button class="supsh-send" onclick="sendSupportMsg()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>`;
  })();

  // ── Partner application ───────────────────────────────────
  // ── Language selector ──────────────────────────────────────
  Sheet.define({ id: 'lang', title: 'Язык / Забон / Language', zIndex: 800 });
  Sheet.body('lang').style.cssText = 'padding:28px 20px 48px;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:260px';
  Sheet.body('lang').innerHTML = `
    <div style="font-size:2.6rem;margin-bottom:18px">🌐</div>
    <div style="font-family:var(--fd);font-weight:900;font-size:1.15rem;color:var(--tx);margin-bottom:8px">Скоро</div>
    <div style="font-size:.76rem;color:var(--tx3);text-align:center;line-height:1.6;max-width:220px">Выбор языка интерфейса появится в ближайшем обновлении</div>`;
  window.openLangSheet = function () { Sheet.open('lang'); };

  Sheet.define({ id: 'partner', title: 'Партнерство', zIndex: 800 });
  Sheet.body('partner').style.cssText = 'padding:20px 16px 32px;overflow-y:auto;-webkit-overflow-scrolling:touch';
  Sheet.body('partner').innerHTML = `
    <label class="pf-lbl">Название компании</label>
    <input class="pf-inp" id="pf-company" type="text" placeholder="ООО …" autocomplete="organization"/>
    <label class="pf-lbl">Название ресторана</label>
    <input class="pf-inp" id="pf-restaurant" type="text" placeholder="…"/>
    <label class="pf-lbl">Адрес</label>
    <input class="pf-inp" id="pf-address" type="text" placeholder="г. Душанбе, ул…" autocomplete="street-address"/>
    <label class="pf-lbl">Телефон менеджера</label>
    <div class="pf-phone-row" id="pf-phone-wrap">
      <span class="pf-pfx">+992</span>
      <input class="pf-tel" id="pf-phone" type="tel" placeholder="977178800" inputmode="numeric" maxlength="9"/>
    </div>
    <label class="pf-lbl">Доп. телефон (необязательно)</label>
    <div class="pf-phone-row">
      <span class="pf-pfx">+992</span>
      <input class="pf-tel" id="pf-phone2" type="tel" placeholder="XX XXX XX XX" inputmode="numeric" maxlength="9"/>
    </div>
    <label class="pf-lbl">Комментарий (необязательно)</label>
    <textarea class="pf-ta" id="pf-comment" placeholder="Напишите комментарий…"></textarea>
    <button class="pf-btn" id="pf-submit-btn" onclick="submitPartnerForm()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Отправить
    </button>`;

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
  Sheet.define({ id: 'addaddr', title: 'Новый адрес', zIndex: 710, onOpen: _onAddrSheetOpen });
  const addaddrBody = Sheet.body('addaddr');
  addaddrBody.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;flex:1;min-height:0';
  addaddrBody.innerHTML = `
    <div id="addaddr-step1" class="addaddr-step">
      <div class="addaddr-map-tip">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Нажмите на карту или перетащите метку на нужное место
      </div>
      <div id="addaddr-map"></div>
      <div class="addaddr-map-bottom">
        <div class="addaddr-coords-badge" id="addaddr-coords-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span id="addaddr-map-coords-txt">Укажите точку на карте</span>
        </div>
        <button class="addaddr-btn-primary" onclick="goToAddrTextStep()">
          Далее — ввести адрес
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
    <div id="addaddr-step2" class="addaddr-step" style="display:none">
      <div class="addaddr-step2-inner">
        <div class="addaddr-sel-point">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span id="addaddr-sel-coords" class="addaddr-sel-coords-txt"></span>
        </div>
        <div>
          <label class="addaddr-lbl" for="addaddr-inp">Полный адрес</label>
          <textarea class="addaddr-inp" id="addaddr-inp" rows="3"
            placeholder="Например: ул. Рудаки 42, кв. 7…"></textarea>
        </div>
        <div class="addaddr-act-row">
          <button class="addaddr-btn-secondary" onclick="goToAddrMapStep()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Карта
          </button>
          <button class="addaddr-btn-primary addaddr-btn-grow" id="addaddr-save-btn" onclick="saveProfileAddr()">
            Сохранить
          </button>
        </div>
      </div>
    </div>`;

  // ── Alif Pay ───────────────────────────────────────────────
  Sheet.define({ id: 'alifpay', title: 'Alif Pay', zIndex: 710 });
  Sheet.body('alifpay').innerHTML = `
    <div class="paysh-coming">
      <div class="paysh-coming-img-wrap">
        <img src="https://dastdaroz.shop/storage/others/alifpay.png" alt="Alif Pay"/>
      </div>
      <div class="paysh-coming-badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Скоро доступно
      </div>
      <div class="paysh-coming-title">Alif Pay</div>
      <div class="paysh-coming-sub">Оплата через Alif Pay появится совсем скоро. Следите за обновлениями!</div>
    </div>`;

  // ── Google Pay ─────────────────────────────────────────────
  Sheet.define({ id: 'googlepay', title: 'Google Pay', zIndex: 710 });
  Sheet.body('googlepay').innerHTML = `
    <div class="paysh-coming">
      <div class="paysh-coming-img-wrap">
        <img src="https://dastdaroz.shop/storage/others/googlepay.png" alt="Google Pay"/>
      </div>
      <div class="paysh-coming-badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Скоро доступно
      </div>
      <div class="paysh-coming-title">Google Pay</div>
      <div class="paysh-coming-sub">Оплата через Google Pay появится совсем скоро. Следите за обновлениями!</div>
    </div>`;

  // ── Карточка товара ────────────────────────────────────────
  Sheet.define({ id: 'product', title: 'Товар', zIndex: 700 });
  const _prodShBody = Sheet.body('product');
  _prodShBody.style.cssText = 'padding:0;overflow-y:auto;-webkit-overflow-scrolling:touch;';
  // ── Редактирование профиля ────────────────────────────────
  Sheet.define({ id: 'profile-edit', title: 'Редактировать профиль', zIndex: 700 });
  Sheet.body('profile-edit').style.cssText = 'padding:0;overflow-y:auto;-webkit-overflow-scrolling:touch;';
}

_initSheets();

// ─── Публичная оферта (PDF sheet) ─────────────────────────────
SheetPdf.define({
  id:     'oferta',
  title:  'Публичная оферта',
  url:    'https://dastdaroz.shop/help/terms.pdf',
  zIndex: 700,
});

// ─── Политика конфиденциальности (PDF sheet) ───────────────────
SheetPdf.define({
  id:     'privacy',
  title:  'Политика конфиденциальности',
  url:    'https://dastdaroz.shop/help/privacy.pdf',
  zIndex: 700,
});

// ─── 5. Auth / Инициализация ──────────────────────────────────
onAuthStateChanged(auth, async u => {
  if (!u) {
    GUEST = true;
    CU    = null;
    UD    = null;
    if (_addrBannerUnsub) { _addrBannerUnsub(); _addrBannerUnsub = null; }
    await Promise.all([loadProds(), loadCats(), loadStores(), loadDeliveryServices()]);
    renderSB();
    renderGuestBanner();
    renderGuestProfile();
    renderCart();
    return;
  }

  GUEST = false;
  CU    = u;
  await loadUD();
  await Promise.all([loadCart(), loadProds(), loadCats(), loadOrders(), loadStores(), loadDeliveryServices()]);
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
      : { displayName: CU.displayName || '', phone: fallbackPhone, address: '', lat: null, lng: null, role: 'client', avatarUrl: '' };
  } catch {
    UD = { displayName: '', phone: fallbackPhone, address: '', lat: null, lng: null, role: 'client', avatarUrl: '' };
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
  // Обновляем способ доставки в карточке корзины
  const csSvc  = document.getElementById('cs-svc-name');
  if (csSvc) {
    const svcObj = deliveryServices.find(s => s.id === svc);
    csSvc.textContent = svcObj ? svcObj.name : (svc || '—');
  }
};

// ── Курьерские службы из Firestore ────────────────────────────
async function loadDeliveryServices() {
  try {
    // Простой запрос без orderBy — не требует составного индекса
    const snap = await getDocs(
      query(collection(db, 'deliveryServices'), where('active', '==', true))
    );
    if (!snap.empty) {
      deliveryServices = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    } else {
      throw new Error('empty');
    }
  } catch {
    // Fallback — хардкод если Firestore пуст или недоступен
    deliveryServices = [
      { id: 'mavsimi',   name: 'Мавсими Расон',      subtitle: 'Хидмати расонидан',          logoUrl: '/storage/delivery-service/mavsimi_rason_mini.png',    active: true, order: 1 },
      { id: 'dastdaroz', name: 'Dastdaroz Delivery',  subtitle: 'Бета · Собственная доставка', logoUrl: '/storage/delivery-service/dastdaroz_delivery_mini.png', active: true, order: 2 },
    ];
  }
  renderDeliveryTabs();
}

function renderDeliveryTabs() {
  const container = document.getElementById('delivery-tabs');
  if (!container) return;

  if (!deliveryServices.length) {
    container.innerHTML = '<div style="font-size:.65rem;color:var(--tx3);padding:8px 4px">Нет доступных служб доставки</div>';
    return;
  }

  // Выбираем первый сервис по умолчанию если текущий не найден
  if (!deliveryServices.find(s => s.id === deliveryService)) {
    deliveryService = deliveryServices[0].id;
  }

  container.innerHTML = deliveryServices.map(svc => {
    const isBeta = svc.id === 'dastdaroz';
    return `<div class="dtab ${deliveryService === svc.id ? 'active' : ''}" data-svc="${svc.id}" onclick="selectDeliveryService('${svc.id}')">
      <img class="dtab-logo-sq" src="${escHtml(svc.logoUrl || '')}" alt="${escHtml(svc.name)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="dtab-logo-fb" style="display:none">${escHtml((svc.name || '').slice(0, 2).toUpperCase())}</div>
      <div class="dtab-info">
        <div class="dtab-name">${escHtml(svc.name)}${isBeta ? ' <span style="font-size:.48rem;background:var(--acc);color:#fff;border-radius:4px;padding:1px 4px;vertical-align:middle">β</span>' : ''}</div>
        <div class="dtab-sub">${escHtml(svc.subtitle || '')}</div>
      </div>
      <div class="dtab-radio"></div>
    </div>`;
  }).join('');
}


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
  const name  = UD?.displayName?.trim() || '';
  const phone = UD?.phone || phoneFromPseudoEmail(CU.email) || '';
  const displayStr = name || phone || 'Покупатель';
  const init = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (phone ? phone.replace(/\D/g, '').slice(3, 5) : '?');

  document.getElementById('sb-uname').textContent = displayStr;
  const av = document.getElementById('sb-av');
  av.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;
  const mnAv = document.getElementById('mn-av');
  if (mnAv) mnAv.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;

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
  const mnAv = document.getElementById('mn-av');
  if (mnAv) mnAv.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

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


// ─── 8. Общие категории — удалено ────────────────────────────




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
  // Сбросить кнопку назад на «Главная»
  const backBtn = document.querySelector('.store-cat-back');
  if (backBtn) {
    backBtn.onclick = () => goPage('home');
    backBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg> Главная страница`;
  }
  renderRetailerPage(activeStore);
};
window.openStore = window.openRetailer; // алиас для совместимости

// Открыть каталог конкретной точки ритейлера
window.openRetailerCatalog = async function (rid, locId, locAddr) {
  document.getElementById('pages').scrollTop = 0;
  storeCatFilter = 'all';
  jsonMenuData   = null;
  jsonProdsMap   = {};

  const prodsEl = document.getElementById('store-prods');
  const catsEl  = document.getElementById('store-cats');
  const hdrEl   = document.getElementById('store-header');

  // Кнопка назад → возврат к списку точек
  const backBtn = document.querySelector('.store-cat-back');
  if (backBtn) {
    backBtn.style.display = '';
    backBtn.onclick = () => openRetailer(rid);
    backBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg> К точкам магазина`;
  }

  // Заголовок: доп-баннер (если есть) или дефолтный hero
  if (hdrEl && activeStore) {
    if (activeStore.extraBannerUrl) {
      // Прячем внешнюю кнопку — она внутри баннера
      if (backBtn) backBtn.style.display = 'none';
      hdrEl.innerHTML = `
        <div class="ret-xbanner-wrap">
          <div class="ret-xbanner">
            <img src="${activeStore.extraBannerUrl}" alt="${activeStore.name}">
            <button class="ret-xbanner-back" onclick="openRetailer('${rid}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div class="ret-xbanner-body">
              <div class="ret-xbanner-tag">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${locAddr || 'Точка'}
              </div>
              <div class="ret-xbanner-name">${activeStore.name}</div>
              ${activeStore.description ? `<div class="ret-xbanner-desc">${activeStore.description}</div>` : ''}
            </div>
          </div>
        </div>`;
    } else {
      // Дефолтный hero с внешней кнопкой назад
      const imgUrl = activeStore.imageUrl || '';
      hdrEl.innerHTML = `
        <div class="store-cat-header">
          ${imgUrl ? `<img class="store-cat-header-img" src="${imgUrl}" alt="${activeStore.name}">` : ''}
          <div class="store-cat-header-overlay"></div>
          <div class="store-cat-header-body">
            <div class="store-cat-header-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${locAddr || 'Точка'}
            </div>
            <div class="store-cat-header-name">${activeStore.name}</div>
            ${activeStore.description ? `<div class="store-cat-header-desc">${activeStore.description}</div>` : ''}
          </div>
        </div>`;
    }
  }

  // Скелетон при загрузке
  if (catsEl)  catsEl.innerHTML = '';
  if (prodsEl) prodsEl.innerHTML = Array(6).fill(0).map(() =>
    `<div class="pc pc-skeleton"><div class="pc-img"></div><div class="pc-body" style="gap:8px">
      <div class="skl-block" style="height:8px;width:55%;margin-bottom:4px"></div>
      <div class="skl-block" style="height:10px;width:82%"></div>
      <div class="skl-block" style="height:7px;width:40%;margin-top:6px"></div>
      <div class="pc-footer" style="margin-top:auto">
        <div class="skl-block" style="height:11px;width:38%"></div>
        <div class="skl-block" style="height:28px;width:72px;border-radius:9px"></div>
      </div>
    </div></div>`
  ).join('');

  try {
    const snap = await getDocs(
      query(collection(db, 'retailers', rid, 'catalog'), where('available', '==', true))
    );
    const allProds = snap.docs.map(d => ({ id: d.id, ...d.data(), storeId: rid }));

    // Категории из уникальных categoryId продуктов
    const catMap = {};
    allProds.forEach(p => {
      if (p.categoryId && !catMap[p.categoryId]) {
        catMap[p.categoryId] = { id: p.categoryId, name: p.categoryId };
      }
    });
    const categories = Object.values(catMap).sort((a, b) =>
      a.name.localeCompare(b.name, 'ru')
    );

    jsonMenuData = { categories, products: allProds };
    allProds.forEach(p => { jsonProdsMap[p.id] = p; });

    renderStoreCatPills();
    renderStoreProds();
  } catch (e) {
    console.error('openRetailerCatalog:', e);
    if (prodsEl) prodsEl.innerHTML = `
      <div class="store-cat-empty" style="grid-column:1/-1">
        <span class="store-cat-empty-ico">⚠️</span>
        <div class="store-cat-empty-t">Ошибка загрузки каталога</div>
        <div class="store-cat-empty-s">${e.message}</div>
      </div>`;
  }
};

async function renderRetailerPage(retailer) {
  const hdrEl   = document.getElementById('store-header');
  const catsEl  = document.getElementById('store-cats');
  const prodsEl = document.getElementById('store-prods');
  if (!hdrEl) return;

  // ── Хедер: доп-баннер (16:9) или дефолтный hero ──────────
  const extBack = document.querySelector('.store-cat-back');
  if (retailer.extraBannerUrl) {
    // Прячем внешнюю кнопку — она внутри баннера
    if (extBack) extBack.style.display = 'none';
    hdrEl.innerHTML = `
      <div class="ret-xbanner-wrap">
        <div class="ret-xbanner">
          <img src="${retailer.extraBannerUrl}" alt="${retailer.name}">
          <button class="ret-xbanner-back" onclick="goPage('home')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div class="ret-xbanner-body">
            <div class="ret-xbanner-tag">Ритейлер · ${_selectedCityName}</div>
            <div class="ret-xbanner-name">${retailer.name}</div>
            ${retailer.description ? `<div class="ret-xbanner-desc">${retailer.description}</div>` : ''}
          </div>
        </div>
      </div>`;
  } else {
    // Показываем внешнюю кнопку для дефолтного hero
    if (extBack) extBack.style.display = '';
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
  }

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
      const mapsUrl  = (loc.lat && loc.lng) ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : '';
      const safeAddr = (loc.address || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `
      <div class="retailer-loc-card" style="cursor:pointer"
           onclick="openRetailerCatalog('${retailer.id}','${loc.id}','${safeAddr}')">
        <div class="retailer-loc-ico">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="retailer-loc-body">
          <div class="retailer-loc-addr">${loc.address || '—'}</div>
          ${loc.lat && loc.lng ? `<div class="retailer-loc-coords">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>` : ''}
        </div>
        ${mapsUrl ? `<a class="retailer-loc-map-btn" href="${mapsUrl}" target="_blank" rel="noopener"
            onclick="event.stopPropagation()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Карта
        </a>` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2" style="flex-shrink:0;opacity:.6"><path d="M9 18l6-6-6-6"/></svg>`}
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
        <div class="pc-price">${p.price}<span> TJS</span></div>
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
  Sheet.open('product');
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

  const chipsHtml = chips.length
    ? `<div class="pm-chips">${chips.map(c => `<span class="pm-chip">${c.label}</span>`).join('')}</div>`
    : '';

  const buyHtml = unavail
    ? `<div class="pm-addrow">
         <button class="pm-addrow-add" disabled>Нет в наличии</button>
       </div>`
    : qty > 0
      ? `<div class="pm-addrow">
           <button class="pm-addrow-side" onclick="pmMinus('${p.id}')">−</button>
           <div class="pm-addrow-mid">
             <span class="pm-addrow-num" id="pm-qty-${p.id}">${qty}</span>
             <span class="pm-addrow-price">${p.price * qty} TJS</span>
           </div>
           <button class="pm-addrow-side" onclick="pmPlus('${p.id}')">+</button>
         </div>`
      : `<div class="pm-addrow">
           <button class="pm-addrow-add" onclick="pmAdd('${p.id}')">Добавить в корзину</button>
         </div>`;

  const _psBody = Sheet.body('product');
  _psBody.innerHTML = `
    <div class="pm-hero">
      ${heroHtml}
      ${unavail ? '<div class="pm-badge-unavail">Нет в наличии</div>' : ''}
      ${storeBadge}
    </div>
    <div class="pm-body">
      <div class="pm-name">${p.name}</div>
      <div class="pm-price-row"><span class="pm-price">${p.price}</span><span class="pm-price-unit">TJS</span></div>
      ${p.description ? `<div class="pm-desc">${p.description}</div>` : ''}
      ${chipsHtml}
      ${buyHtml}
      <div class="pm-disclaimer">Изображение товара может отличаться от фактического внешнего вида</div>
    </div>`;
  _psBody.scrollTop = 0;
}

window.pmAdd   = async function (pid) { await addToCart(pid); const p = prods.find(x => x.id === pid); if (p) renderProdModal(p); };
window.pmPlus  = async function (pid) {
  await addToCart(pid);
  const p   = prods.find(x => x.id === pid);
  const qty = getCartQty(pid);
  const qEl = document.getElementById(`pm-qty-${pid}`);
  if (qEl) {
    qEl.textContent = qty;
    const priceEl = document.querySelector('.pm-addrow-price');
    if (priceEl && p) priceEl.textContent = `${p.price * qty} TJS`;
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
    const priceEl = document.querySelector('.pm-addrow-price');
    if (priceEl && p) priceEl.textContent = `${p.price * qty} TJS`;
  } else if (p) { renderProdModal(p); }
};

window.closeProdModal = function () {
  Sheet.close('product');
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
      <div class="srd-price">${p.price} TJS</div>
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
    el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:6px;text-align:center">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--b1)" stroke-width="1.4"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      <div class="ci-empty-t" style="margin-top:6px">Корзина пуста</div>
      <div class="ci-empty-s">Добавьте товары из каталога</div>
    </div>`;
    _setCartFooter(false);
  } else {
    el.innerHTML = cart.map(i => {
      const ic = catIcon(i.productId, '').svg;
      const leftBtn = i.quantity === 1
        ? `<button class="ci-stepper-btn" onclick="event.stopPropagation();removeCI('${i.productId}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.9"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
           </button>`
        : `<button class="ci-stepper-btn" onclick="event.stopPropagation();updateQty('${i.productId}',-1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
           </button>`;
      return `<div class="ci">
        <div class="ci-img">${i.imageUrl ? `<img src="${i.imageUrl}" alt="">` : ic}</div>
        <div class="ci-info"><div class="ci-name">${i.name}</div><div class="ci-price">${i.price * i.quantity} TJS</div></div>
        <div class="ci-stepper">
          ${leftBtn}
          <span class="ci-stepper-val">${i.quantity}</span>
          <button class="ci-stepper-btn" onclick="event.stopPropagation();updateQty('${i.productId}',1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
    _setCartFooter(true);
  }

  const sub = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const tot = sub + (cart.length ? DFEE : 0);
  const ci  = document.getElementById('cs-items');        if (ci) ci.textContent = sub + ' TJS';
  const cd  = document.getElementById('cs-del');          if (cd) cd.textContent = cart.length ? DFEE + ' TJS' : '0 TJS';
  const ct  = document.getElementById('cs-total');        if (ct) ct.textContent = tot + ' TJS';

  // Список товаров в карточке
  const csList = document.getElementById('cs-items-list');
  if (csList) {
    csList.innerHTML = cart.map(i => `
      <div class="booking-item">
        <div class="booking-item-name">${escHtml(i.name)}</div>
        <div class="booking-item-right">
          <span class="booking-item-qty">×${i.quantity}</span>
          <span class="booking-item-price">${i.price * i.quantity} TJS</span>
        </div>
      </div>`).join('');
  }

  // Инфо-блок: имя, телефон, способ доставки
  const csName  = document.getElementById('cs-client-name');
  const csPhone = document.getElementById('cs-client-phone');
  const csSvc   = document.getElementById('cs-svc-name');
  const phone   = UD?.phone || phoneFromPseudoEmail(CU?.email) || '';
  if (csName)  csName.textContent  = UD?.displayName || '—';
  if (csPhone) csPhone.textContent = phone || '—';
  if (csSvc) {
    const svcObj = deliveryServices.find(s => s.id === deliveryService);
    csSvc.textContent = svcObj ? svcObj.name : (deliveryService || '—');
  }
}

function _setCartFooter(active) {
  const skl = document.getElementById('cart-sum-skl');
  const cs  = document.getElementById('cart-sum');
  const cb  = document.getElementById('cart-clear-btn');
  if (skl) skl.style.display = 'none';                       // скелетон всегда скрываем после загрузки
  if (cs)  cs.style.display  = active ? 'flex' : 'none';
  if (cb)  cb.style.display  = active ? ''     : 'none';
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
  btn.innerHTML = '<div class="spin" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;width:14px;height:14px"></div> Бронируем…';

  try {
    const sub           = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const oNum          = nextOrderNum();
    const payMethod     = 'online';

    const orderData = {
      clientId:        CU.uid,
      clientName:      UD?.displayName || '',
      clientPhone:     UD?.phone || phoneFromPseudoEmail(CU.email) || '',
      orderNumber:     oNum,
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
      status:          'reserved',
      courierId:       null,
      courierName:     null,
      createdAt:       serverTimestamp(),
      updatedAt:       serverTimestamp(),
    };

    // Создаём заказ в коллекции бронированных заказов
    const ref = await addDoc(collection(db, 'bookedOrders'), orderData);

    // Очистка корзины
    const b = writeBatch(db);
    cart.forEach(c => b.delete(doc(db, 'users', CU.uid, 'cart', c.productId)));
    await b.commit();
    cart = [];
    renderCart(); updateBadges();

    // Добавляем новый заказ локально, чтобы сразу открыть модалку
    const newOrder = {
      id: ref.id,
      ...orderData,
      _col: 'bookedOrders',
      createdAt: { toDate: () => new Date() }, // псевдо-timestamp для fmtDate
    };
    orders.unshift(newOrder);
    activeOid = ref.id;

    renderOrders(); renderOrdersBadge(); renderLiveBanner();

    toast('Заказ оформлен! ✅', 'ok');
    listenBooked(ref.id);

    // Сразу открываем модалку бронирования
    setTimeout(() => openOrderModal(ref.id), 350);

    // Параллельно обновляем из Firestore
    loadOrders().catch(() => {});

  } catch (e) {
    toast('Ошибка: ' + e.message, 'err');
    btn.disabled  = false;
    btn.innerHTML = 'Оформить заказ';
  }
};

/** Подтверждение бронирования:
 *  - удаляем из bookedOrders
 *  - создаём в dastdarozOrders или mavsimiOrders (зависит от deliveryService)
 */


/** Отмена бронирования (статус reserved → бронь ещё не подтверждена) */
window.cancelReservation = async function (oid) {
  if (!confirm('Отменить бронирование?')) return;
  try {
    await updateDoc(doc(db, 'bookedOrders', oid), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    closeOrderModal();
    await loadOrders();
    toast('Бронирование отменено', 'ok');
  } catch { toast('Ошибка отмены', 'err'); }
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
    const sel     = a.text === current;
    const hasCoord = a.lat != null && a.lng != null;
    return `<button class="caddrsh-item${sel ? ' selected' : ''}"
        data-text="${escAttr(a.text)}"
        data-lat="${hasCoord ? a.lat : ''}"
        data-lng="${hasCoord ? a.lng : ''}"
        onclick="selectCartAddr(this.dataset.text, this.dataset.lat, this.dataset.lng)">
      <div class="caddrsh-item-ico">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${sel ? '#fff' : 'var(--acc)'}" stroke-width="1.8">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="caddrsh-item-text">${esc(a.text)}</div>
      ${!hasCoord ? `<div class="caddrsh-item-nocoord" title="Координаты не указаны">!</div>` : ''}
      <div class="caddrsh-item-check">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    </button>`;
  }).join('');
}

window.selectCartAddr = function (text, lat, lng) {
  const inp = document.getElementById('cart-addr');
  if (inp) inp.value = text;

  // Записываем координаты (пустая строка → parseFloat вернёт NaN → null в doCheckout)
  const latInp = document.getElementById('cart-lat');
  if (latInp) latInp.value = lat || '';
  const lngInp = document.getElementById('cart-lng');
  if (lngInp) lngInp.value = lng || '';

  const display = document.getElementById('cart-addr-display');
  if (display) display.textContent = text;
  const card = document.getElementById('cart-addr-card');
  if (card) card.classList.add('filled');

  // Обновляем блок инфо в карточке
  const csAddr   = document.getElementById('cs-addr-display');
  const csCoords = document.getElementById('cs-coords-display');
  if (csAddr) csAddr.textContent = text || '—';
  if (csCoords) {
    const fLat = parseFloat(lat);
    const fLng = parseFloat(lng);
    csCoords.textContent = (fLat && fLng) ? `${fLat.toFixed(5)}, ${fLng.toFixed(5)}` : '—';
  }

  closeCartAddrSheet();
};


// ─── 15. Заказы ───────────────────────────────────────────────
async function loadOrders() {
  if (!CU?.uid) return;
  const uid = CU.uid;

  const safeQuery = async (col) => {
    try {
      const q = query(collection(db, col), where('clientId', '==', uid), orderBy('createdAt', 'desc'));
      const s = await getDocs(q);
      return s.docs.map(d => ({ id: d.id, ...d.data(), _col: col }));
    } catch {
      try {
        // fallback без orderBy (если нет индекса)
        const q2 = query(collection(db, col), where('clientId', '==', uid));
        const s2 = await getDocs(q2);
        return s2.docs.map(d => ({ id: d.id, ...d.data(), _col: col }));
      } catch { return []; }
    }
  };

  const [booked, dast, mav] = await Promise.all([
    safeQuery('bookedOrders'),
    safeQuery('dastdarozOrders'),
    safeQuery('mavsimiOrders'),
  ]);

  orders = [...booked, ...dast, ...mav].sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );

  const live = orders.find(o => ['reserved','pending','confirmed','preparing','delivering'].includes(o.status));
  if (live) {
    activeOid        = live.id;
    activeCollection = live._col;
    // Live-слежение только для dastdaroz (mavsimi — через бэкенд в будущем)
    if (!unsubLive && live.status !== 'reserved' && live._col === 'dastdarozOrders') {
      listenLive(live.id, 'dastdarozOrders');
    }
  }

  renderOrders();
  renderOrdersBadge();
  renderLiveBanner();
  if (document.getElementById('page-status')?.classList.contains('active')) renderStatusPage();

  // Автооткрытие заказа после возврата с платёжной страницы Алифа
  if (_payReturnOid) {
    const found = orders.find(o => o.id === _payReturnOid);
    if (found) {
      activeOid = found.id;
      if (found._col === 'bookedOrders' && !['cancelled', 'failed'].includes(found.status)) {
        // Заказ ещё в bookedOrders — оплата обрабатывается
        // Показываем оверлей и слушаем в реальном времени
        showPaymentProcessing();
        listenBooked(found.id);
      } else if (found._col !== 'bookedOrders') {
        // Callback уже пришёл и переместил заказ — показываем сразу
        toast('Оплата прошла успешно! ✅', 'ok');
        goPage('orders');
        setTimeout(() => openOrderModal(found.id), 400);
      }
    }
  }

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
  return orders.filter(o => o.status !== 'reserved');
}

function renderBookingsSheet() {
  const body    = Sheet.body('bookings');
  const reserved = orders.filter(o => o.status === 'reserved');

  if (!reserved.length) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 24px;text-align:center">
        <div style="width:54px;height:54px;border-radius:16px;background:var(--teal-d);border:1.5px solid rgba(13,148,136,.18);display:flex;align-items:center;justify-content:center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.7">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
          </svg>
        </div>
        <div style="font-family:var(--fd);font-weight:900;font-size:.95rem;color:var(--tx)">Нет бронирований</div>
        <div style="font-size:.74rem;color:var(--tx3);line-height:1.55;max-width:210px">Оформляете заказ из корзины — бронь появится здесь</div>
      </div>`;
    return;
  }

  body.innerHTML = reserved.map(o => {
    const num   = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
    const items = (o.items || []).map(i => `${escHtml(i.name)} ×${i.quantity}`).join(', ');


    return `<div class="oc st-reserved" onclick="openOrderModal('${o.id}')" style="cursor:pointer">
      <div class="oc-head">
        <div class="oc-num">Бронь ${num}</div>
        <div class="oc-status" style="color:var(--teal);border-color:rgba(13,148,136,.28);background:var(--teal-d)">🔒 Забронирован</div>
      </div>
      <div class="oc-items">${items}</div>
      <div class="oc-footer">
        <div>
          <div class="oc-total">${o.total} TJS</div>
          <div class="oc-meta" style="color:var(--teal)">Ожидает оплаты</div>
        </div>
        <div class="oc-actions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
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
        <div><div class="oc-total">${o.total} TJS</div><div class="oc-meta">${fmtDate(o.createdAt)} · ${o.address || ''}</div></div>
        <div class="oc-actions" onclick="event.stopPropagation()">
          ${isActive ? `<div style="width:7px;height:7px;border-radius:50%;background:${c};animation:rpulse 2s infinite;flex-shrink:0"></div>` : ''}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderOrdersBadge() {
  const act  = orders.filter(o => ['pending','confirmed','preparing','delivering'].includes(o.status)).length;
  const resv = orders.filter(o => o.status === 'reserved').length;
  ['orders-nb', 'mob-ord-b', 'prof-orders-nb'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.style.display = act > 0 ? '' : 'none'; b.textContent = act; }
  });
  const bb = document.getElementById('bookings-nb');
  if (bb) { bb.style.display = resv > 0 ? '' : 'none'; bb.textContent = resv; }
}

window.openOrderModal = function (oid) {
  const o = orders.find(x => x.id === oid);
  if (!o) return;


  const num      = o.orderNumber ? '#' + o.orderNumber : '#' + o.id.slice(-6);
  const c        = SC[o.status] || '#888';
  const l        = SL[o.status] || o.status;
  const si       = STEPS.indexOf(o.status);
  const pay      = 'Онлайн 📱';
  const isActive = ['pending','confirmed','preparing','delivering'].includes(o.status);
  const sub      = (o.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const delivery = o.total - sub;

  // ════ БРОНИРОВАНИЕ — специальный UI ════
  if (o.status === 'reserved') {
    document.getElementById('order-modal-title').textContent = `Бронь заказа ${num}`;

    const itemsHtml = (o.items || []).map(i =>
      `<div class="receipt-row">
        <span class="receipt-row-name">${escHtml(i.name)}</span>
        <span class="receipt-row-qty">×${i.quantity}</span>
        <span class="receipt-row-price">${i.price * i.quantity} TJS</span>
      </div>`
    ).join('');

    const svcObj  = deliveryServices.find(s => s.id === o.deliveryService);
    const svcName = svcObj ? svcObj.name : (o.deliveryService || '—');
    const coords  = (o.lat && o.lng) ? `${o.lat.toFixed(5)}, ${o.lng.toFixed(5)}` : '—';
    const bPhone  = o.clientPhone || '—';
    const bName   = o.clientName  || '—';
    const bFee    = o.total - sub > 0 ? o.total - sub : DFEE;

    document.getElementById('order-modal-body').innerHTML = `
      <!-- ── Герой-блок бронирования ── -->
      <div class="booking-hero">
        <div class="booking-hero-glow"></div>
        <div class="booking-hero-title">Заказ бронирован!</div>
        <div class="booking-hero-sub">Оплатите заказ удобным способом</div>
      </div>

      <!-- ── Детали заказа ── -->
      <div class="booking-order-card">
        <div class="booking-order-header">
          <div class="booking-order-num">Заказ ${num}</div>
        </div>

        <!-- 1. Список товаров -->
        <div class="booking-items">
          ${(o.items || []).map(i => `
            <div class="booking-item">
              <div class="booking-item-name">${escHtml(i.name)}</div>
              <div class="booking-item-right">
                <span class="booking-item-qty">×${i.quantity}</span>
                <span class="booking-item-price">${i.price * i.quantity} TJS</span>
              </div>
            </div>`).join('')}
        </div>

        <!-- 2. Разделитель -->
        <div class="booking-divider"></div>

        <!-- 3. Товары + Доставка -->
        <div class="booking-totals">
          <div class="booking-total-row">
            <span>Товары</span>
            <span>${sub} TJS</span>
          </div>
          <div class="booking-total-row">
            <span>Доставка</span>
            <span>${bFee} TJS</span>
          </div>
        </div>

        <!-- 4. Разделитель -->
        <div class="booking-divider"></div>

        <!-- 5. Информация о доставке -->
        <div class="booking-delivery-info">
          <div class="booking-delivery-row">
            <span class="booking-delivery-label">Способ доставки</span>
            <span class="booking-delivery-val">${escHtml(svcName)}</span>
          </div>
          <div class="booking-delivery-row">
            <span class="booking-delivery-label">Имя</span>
            <span class="booking-delivery-val">${escHtml(bName)}</span>
          </div>
          <div class="booking-delivery-row">
            <span class="booking-delivery-label">Номер телефона</span>
            <span class="booking-delivery-val">${escHtml(bPhone)}</span>
          </div>
          <div class="booking-delivery-row">
            <span class="booking-delivery-label">Адрес</span>
            <span class="booking-delivery-val">${escHtml(o.address || '—')}</span>
          </div>
          <div class="booking-delivery-row">
            <span class="booking-delivery-label">Координаты</span>
            <span class="booking-delivery-val booking-delivery-coords">${escHtml(coords)}</span>
          </div>
        </div>

        <!-- 6. Разделитель -->
        <div class="booking-divider"></div>

        <!-- 7. Итог -->
        <div class="booking-total-row booking-total-final">
          <span>Итог</span>
          <span class="booking-total-final-sum">${o.total} TJS</span>
        </div>

      </div>

      <!-- ── Кнопки действий ── -->
      <div class="booking-actions">
        <div class="booking-pay-row">
          <button class="booking-btn-pay" onclick="openAlifPaySheet()">
            <img class="booking-pay-ico" src="https://dastdaroz.shop/storage/others/alifpay.png" alt="Alif Pay"/>
            Alif Pay
          </button>
          <button class="booking-btn-pay" onclick="openGooglePaySheet()">
            <img class="booking-pay-ico" src="https://dastdaroz.shop/storage/others/googlepay.png" alt="Google Pay"/>
            Google Pay
          </button>
        </div>
        <p style="font-size:.62rem;color:var(--tx3);text-align:center;line-height:1.55;margin:4px 4px 0">
          Нажимая на кнопку оплаты, вы автоматически соглашаетесь с
          <span style="color:var(--acc);text-decoration:underline;cursor:pointer" onclick="openOfertaSheet()">Публичной офертой</span>
          и
          <span style="color:var(--acc);text-decoration:underline;cursor:pointer" onclick="openPrivacySheet()">Политикой конфиденциальности</span>
        </p>
        <button class="booking-btn-cancel" onclick="cancelReservation('${o.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Отменить бронь
        </button>
      </div>`;

    document.getElementById('order-modal-bg').classList.add('open');


    return; // выходим — не показываем обычный UI
  }

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
      <span class="receipt-row-price">${i.price * i.quantity} TJS</span>
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
          <div class="receipt-total-row"><span>Товары</span><span>${sub} TJS</span></div>
          <div class="receipt-total-row"><span>Доставка</span><span>${delivery > 0 ? delivery : DFEE} TJS</span></div>
          <div class="receipt-divider" style="margin:8px 0"></div>
          <div class="receipt-total-row big"><span>Итого</span><span>${o.total} TJS</span></div>
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
  if (isActive && activeOid !== o.id) {
    activeOid        = o.id;
    activeCollection = o._col || 'dastdarozOrders';
    if (o._col === 'dastdarozOrders') listenLive(o.id, 'dastdarozOrders');
  }
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
    const o   = orders.find(x => x.id === id);
    const col = o?._col || 'dastdarozOrders';
    await updateDoc(doc(db, col, id), { status: 'cancelled', updatedAt: serverTimestamp() });
    toast('Заказ отменён', 'ok');
    await loadOrders();
  } catch { toast('Ошибка', 'err'); }
};

function renderLiveBanner() {
  const wrap = document.getElementById('live-wrap');
  if (!wrap) return;
  const live = orders.find(o => ['reserved','pending','confirmed','preparing','delivering'].includes(o.status));
  if (!live) { wrap.innerHTML = ''; return; }
  const num = live.orderNumber ? '#' + live.orderNumber : '#' + live.id.slice(-6);

  if (live.status === 'reserved') {
    wrap.innerHTML = `<div class="live-banner live-banner-booking" onclick="openOrderModal('${live.id}')">
      <div class="live-booking-ico">🔒</div>
      <div class="live-info">
        <div class="live-lbl" style="color:var(--teal)">Бронь активна</div>
        <div class="live-txt">Заказ ${num} · ${live.total} TJS · нажмите для подтверждения</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="live-banner" onclick="trackO('${live.id}')">
    <div class="live-pulse"></div>
    <div class="live-info">
      <div class="live-lbl">Активный заказ</div>
      <div class="live-txt">Заказ ${num} · ${SL[live.status]} · ${live.total} TJS</div>
    </div>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
  </div>`;
}

function listenLive(oid, col = 'dastdarozOrders') {
  if (unsubLive) { unsubLive(); unsubLive = null; }
  unsubLive = onSnapshot(doc(db, col, oid), snap => {
    if (!snap.exists()) return;
    const o   = { id: snap.id, ...snap.data(), _col: col };
    const idx = orders.findIndex(x => x.id === oid);
    if (idx >= 0) orders[idx] = o; else orders.unshift(o);
    if (activeOid === oid || !activeOid) { activeOid = oid; activeCollection = col; }
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


// ─── Оверлей "Обрабатывается оплата" ────────────────────────
function showPaymentProcessing() {
  if (document.getElementById('pay-proc-overlay')) return;
  const el = document.createElement('div');
  el.id = 'pay-proc-overlay';
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(255,255,255,0.97)',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:16px',
  ].join(';');
  el.innerHTML = `
    <div class="spin" style="width:48px;height:48px;border-width:4px;
      border-color:rgba(0,0,0,.1);border-top-color:var(--accent, #4f8fff)"></div>
    <div style="font-size:17px;font-weight:600">Обрабатывается оплата</div>
    <div style="font-size:14px;opacity:.6">Обычно занимает 1–2 минуты</div>
    <div style="font-size:13px;opacity:.4">Не закрывайте страницу</div>
  `;
  document.body.appendChild(el);
  // Таймаут 3 минуты
  setTimeout(() => {
    hidePaymentProcessing();
    toast('Оплата занимает дольше обычного. Обновите страницу через минуту.', 'err');
  }, 3 * 60 * 1000);
}
function hidePaymentProcessing() {
  document.getElementById('pay-proc-overlay')?.remove();
}

// ─── Слушатель bookedOrders (для реакции на оплату/отмену) ──
function listenBooked(oid) {
  if (unsubBooked) { unsubBooked(); unsubBooked = null; }
  unsubBooked = onSnapshot(doc(db, 'bookedOrders', oid), async snap => {
    if (!snap.exists()) {
      // Документ удалён — callback переместил заказ (оплата прошла)
      if (unsubBooked) { unsubBooked(); unsubBooked = null; }
      hidePaymentProcessing();
      toast('Оплата прошла успешно! ✅', 'ok');
      await loadOrders();
      renderOrders(); renderOrdersBadge();
      goPage('orders');
      setTimeout(() => openOrderModal(oid), 400);
      return;
    }
    const o   = { id: snap.id, ...snap.data(), _col: 'bookedOrders' };
    const idx = orders.findIndex(x => x.id === oid);
    if (idx >= 0) orders[idx] = o; else orders.unshift(o);
    renderOrders(); renderOrdersBadge(); renderLiveBanner();

    // Если модалка открыта — обновляем её
    const modalBg = document.getElementById('order-modal-bg');
    if (modalBg?.classList.contains('open') && activeOid === oid) {
      openOrderModal(oid);
    }

    // Заказ отменён (оплата не прошла или истёк таймер)
    if (['cancelled', 'failed'].includes(o.status)) {
      if (unsubBooked) { unsubBooked(); unsubBooked = null; }
      hidePaymentProcessing();
      toast('Оплата не прошла. Заказ отменён.', 'err');
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
  const pay  = 'Онлайн';

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
        <span style="font-weight:600">${i.price * i.quantity} TJS</span>
      </div>`
    ).join('')}
    <div style="display:flex;justify-content:space-between;font-size:.72rem;padding:8px 0;color:var(--tx3)"><span>Доставка</span><span>${DFEE} TJS</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--b0)">
      <span style="font-weight:700;font-size:.8rem">Итого</span>
      <span style="font-family:var(--fd);font-weight:900;font-size:1.15rem;color:var(--acc)">${o.total} TJS</span>
    </div>
    ${['pending','confirmed'].includes(o.status) ? `
    <div style="margin-top:14px"><button class="btn-sm danger" onclick="cancelO('${o.id}')">Отменить заказ</button></div>` : ''}
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
  Sheet.open('support');
  _supChatId = CU.uid;
  _listenSupportChatUser();
  _loadSupportOrders();
};

window.closeSupport = function () {
  Sheet.close('support');
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
    return `<div class="supsh-msg-wrap ${isMe ? 'supsh-msg-wrap-me' : 'supsh-msg-wrap-them'}">
      ${!isMe && m.senderName ? `<div class="supsh-msg-name">${escHtml(m.senderName)}</div>` : ''}
      <div class="supsh-msg ${isMe ? 'supsh-msg-me' : 'supsh-msg-them'}">${escHtml(m.text)}<span class="supsh-msg-time">${time}</span></div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function _loadSupportOrders() {
  if (!CU) return;

  // ── Быстрый путь: используем уже загруженный массив orders ──
  if (orders.length > 0) {
    _supOrdersCache = orders.slice(0, 10);
    _renderSupOrderPicker();
    return;
  }

  // ── Fallback: прямой запрос в Firestore (если orders ещё пуст) ──
  try {
    // Попытка 1: с orderBy (требует composite index)
    const snap = await getDocs(
      query(collection(db, 'orders'), where('clientId', '==', CU.uid), orderBy('createdAt', 'desc'), limit(10))
    );
    _supOrdersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      // Попытка 2: без orderBy (работает без индекса), сортируем вручную
      const snap2 = await getDocs(
        query(collection(db, 'orders'), where('clientId', '==', CU.uid), limit(10))
      );
      _supOrdersCache = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      _supOrdersCache.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    } catch { _supOrdersCache = []; }
  }
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
  const name  = UD?.displayName?.trim() || '';
  const phone = UD?.phone || phoneFromPseudoEmail(CU.email) || '';

  // Аватар: инициалы имени или две цифры оператора из номера
  const init = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (phone ? phone.replace(/\D/g, '').slice(3, 5) : '?');

  const nameEl  = document.getElementById('p-name');
  const phoneEl = document.getElementById('p-phone');

  // Если имя есть — имя сверху, номер снизу
  // Если имени нет — номер сверху, подсказка снизу
  if (nameEl)  nameEl.textContent  = name || phone || '—';
  if (phoneEl) phoneEl.textContent = name ? (phone || '—') : 'Добавьте имя в профиле →';

  const av = document.getElementById('p-av');
  if (av) av.innerHTML = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;

  const nameInp = document.getElementById('prof-sh-name') || document.getElementById('pf-name');
  if (nameInp) nameInp.value = name;
  document.getElementById('pf-phone') && (document.getElementById('pf-phone').value = phone);
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
          Авторизоваться
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
  const name = (document.getElementById('prof-sh-name') || document.getElementById('pf-name'))?.value.trim();
  try {
    const saveData = {
      displayName: name,
      updatedAt:   serverTimestamp(),
    };
    await setDoc(doc(db, 'users', CU.uid), saveData, { merge: true });
    UD = { ...UD, ...saveData };
    renderSB(); renderProfile();
    Sheet.close('profile-edit');
    toast('Профиль сохранён', 'ok');
  } catch { toast('Ошибка', 'err'); }
};

// ─── Cloudinary: загрузка аватара (нативный выбор файла) ────────
// Виджет на мобиле не работает — используем скрытый input + fetch

// Сжимает фото до maxPx × maxPx перед загрузкой (экономим место в Cloudinary)
function _resizeAvatar(file, maxPx = 800) {
  return new Promise(resolve => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else        { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      // JPEG 85% — хороший баланс качество/размер
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.src = blobUrl;
  });
}

window.openAvWidget = function () {
  if (!CU) { requireAuth('Войдите для изменения фото'); return; }

  // Используем постоянный input из DOM — динамически созданные не работают в WebView
  const inp = document.getElementById('av-file-inp');
  if (!inp) return;
  inp.value = ''; // сброс, чтобы то же фото можно было выбрать повторно

  inp.onchange = async function () {
    const file = inp.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Файл слишком большой (макс 20 МБ)', 'err'); return; }

    toast('Загрузка фото…');

    try {
      // Сжимаем до 800px перед отправкой — в Cloudinary хранится компактный файл
      const blob = await _resizeAvatar(file, 800);

      // Прямая загрузка на Cloudinary без сервера (unsigned preset)
      const fd = new FormData();
      fd.append('file',          blob, 'avatar.jpg');
      fd.append('upload_preset', 'dastdaroz_avatars');

      const res  = await fetch('https://api.cloudinary.com/v1_1/epgcpmjt/image/upload', {
        method: 'POST',
        body:   fd,
      });
      const data = await res.json();

      if (!res.ok || !data.secure_url) throw new Error(data.error?.message || 'upload failed');

      // Добавляем трансформацию прямо в URL: 200×200, по лицу, авто-качество
      const url = data.secure_url.replace('/upload/', '/upload/w_200,h_200,c_thumb,g_face,q_auto,f_auto/');

      // Сохраняем в Firestore
      await setDoc(
        doc(db, 'users', CU.uid),
        { avatarUrl: url, updatedAt: serverTimestamp() },
        { merge: true }
      );
      UD.avatarUrl = url;
      renderSB();
      renderProfile();
      // Обновляем аватар прямо в открытом шите
      const shAv = document.getElementById('prof-sh-av');
      if (shAv) shAv.innerHTML = `<img src="${url}" alt="">`;
      toast('Фото обновлено ✓', 'ok');

    } catch (e) {
      console.error('Avatar upload error:', e);
      toast('Ошибка загрузки фото', 'err');
    }
  };

  inp.click();
};

// ─── Редактирование профиля (sheet) ───────────────────────────
window.openProfileEditSheet = function () {
  if (!CU) { requireAuth('Войдите для редактирования профиля'); return; }
  const name  = UD?.displayName?.trim() || '';
  const phone = UD?.phone || phoneFromPseudoEmail(CU.email) || '';
  const init  = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (phone ? phone.replace(/\D/g, '').slice(3, 5) : '?');
  const avHtml = UD?.avatarUrl ? `<img src="${UD.avatarUrl}" alt="">` : init;

  Sheet.body('profile-edit').innerHTML = `
    <div class="prof-sh-body">
      <div class="prof-sh-av-row">
        <div class="prof-sh-av-wrap" onclick="openAvWidget()">
          <div class="prof-sh-av" id="prof-sh-av">${avHtml}</div>
          <div class="prof-sh-av-cam">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
        </div>
        <div class="prof-sh-av-sub">Нажмите на фото чтобы изменить</div>
      </div>

      <div class="prof-sh-field">
        <div class="prof-sh-lbl">Имя и фамилия</div>
        <input class="prof-sh-inp" id="prof-sh-name" type="text" value="${name}" placeholder="Ваше имя">
      </div>

      <div class="prof-sh-field">
        <div class="prof-sh-lbl">Номер телефона</div>
        <input class="prof-sh-inp prof-sh-inp--ro" type="tel" value="${phone}" readonly>
        <div style="font-size:.62rem;color:var(--tx3);margin-top:5px;line-height:1.5">Номер телефона — идентификатор вашего аккаунта, изменить невозможно</div>
      </div>

      <button class="prof-sh-save" onclick="saveProfile()">Сохранить изменения</button>
    </div>`;

  Sheet.open('profile-edit');
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
        <div class="paddr-item-info">
          <div class="paddr-item-text">${esc(a.text)}</div>
          ${a.lat != null && a.lng != null
            ? `<div class="paddr-item-coords paddr-item-coords--ok">${(+a.lat).toFixed(5)}, ${(+a.lng).toFixed(5)}</div>`
            : `<div class="paddr-item-coords paddr-item-coords--missing">⚠ Без координат</div>`
          }
        </div>
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

// ── Карта выбора координат адреса ─────────────────────────────
let _addrPickerMap    = null;
let _addrPickerMarker = null;
let _addrPickerLat    = null;
let _addrPickerLng    = null;

const _ADDR_DEFAULT_LAT = 38.5598;  // Душанбе
const _ADDR_DEFAULT_LNG = 68.7870;

// Вызывается Sheet-ом после завершения анимации открытия
function _onAddrSheetOpen() {
  const s1 = document.getElementById('addaddr-step1');
  const s2 = document.getElementById('addaddr-step2');
  if (s1) s1.style.display = '';
  if (s2) s2.style.display = 'none';
  // Даём шиту полностью отрисоваться, потом инициализируем карту
  setTimeout(_initAddrPickerMap, 320);
}

function _initAddrPickerMap() {
  const mapEl = document.getElementById('addaddr-map');
  if (!mapEl) {
    console.error('[addaddr] #addaddr-map не найден в DOM');
    return;
  }

  // Если карта уже есть — просто обновляем размер
  if (_addrPickerMap) {
    _addrPickerMap.invalidateSize();
    return;
  }

  // Leaflet не загрузился (CDN недоступен)
  if (typeof L === 'undefined') {
    console.error('[addaddr] Leaflet (L) не загружен — CDN недоступен');
    mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:.8rem;font-weight:600;gap:6px">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      'Карта недоступна — нет соединения</div>';
    return;
  }

  try {
    _addrPickerMap = L.map('addaddr-map', {
      center:             [_ADDR_DEFAULT_LAT, _ADDR_DEFAULT_LNG],
      zoom:               14,
      zoomControl:        false,
      attributionControl: false
    });

    // Кнопки зума — снизу справа, чтобы не перекрывать hint
    L.control.zoom({ position: 'bottomright' }).addTo(_addrPickerMap);

    // CartoDB Voyager — бесплатно, без API-ключа, стабильно по всему миру
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' })
      .addTo(_addrPickerMap);

    // Пин-иконка
    const pinHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" style="display:block">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 10.32 15 27 15 27S30 25.32 30 15C30 6.716 23.284 0 15 0z" fill="var(--acc,#7c3aed)"/>
      <circle cx="15" cy="15" r="6.5" fill="#fff"/>
    </svg>`;
    const pinIcon = L.divIcon({ className: '', html: pinHtml, iconSize: [30, 42], iconAnchor: [15, 42] });

    _addrPickerLat = _ADDR_DEFAULT_LAT;
    _addrPickerLng = _ADDR_DEFAULT_LNG;

    _addrPickerMarker = L.marker([_ADDR_DEFAULT_LAT, _ADDR_DEFAULT_LNG], { draggable: true, icon: pinIcon })
      .addTo(_addrPickerMap);

    _addrPickerMarker.on('dragend', e => {
      const p = e.target.getLatLng();
      _addrPickerLat = p.lat;
      _addrPickerLng = p.lng;
      _renderAddrPickerCoords();
    });

    _addrPickerMap.on('click', e => {
      _addrPickerMarker.setLatLng(e.latlng);
      _addrPickerLat = e.latlng.lat;
      _addrPickerLng = e.latlng.lng;
      _renderAddrPickerCoords();
    });

    _renderAddrPickerCoords();

    // Несколько попыток invalidateSize на случай если анимация ещё идёт
    setTimeout(() => _addrPickerMap?.invalidateSize(), 100);
    setTimeout(() => _addrPickerMap?.invalidateSize(), 400);

  } catch (e) {
    console.error('[addaddr] Ошибка инициализации карты:', e);
    mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:.8rem;font-weight:600;gap:6px">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      'Не удалось загрузить карту</div>';
  }
}

function _renderAddrPickerCoords() {
  const txt = document.getElementById('addaddr-map-coords-txt');
  if (txt && _addrPickerLat !== null) {
    txt.textContent = `${_addrPickerLat.toFixed(5)}, ${_addrPickerLng.toFixed(5)}`;
  }
  // Подсвечиваем бейдж когда координата выбрана
  const badge = document.getElementById('addaddr-coords-badge');
  if (badge) badge.classList.toggle('has-coords', _addrPickerLat !== null);
}

// Шаг 1 → Шаг 2: карта → ввод текста
window.goToAddrTextStep = function () {
  if (_addrPickerLat === null || _addrPickerLng === null) {
    toast('Укажите точку на карте', 'warn');
    return;
  }
  // Показываем выбранные координаты в шаге 2
  const sel = document.getElementById('addaddr-sel-coords');
  if (sel) sel.textContent = `${_addrPickerLat.toFixed(5)}, ${_addrPickerLng.toFixed(5)}`;

  document.getElementById('addaddr-step1').style.display = 'none';
  document.getElementById('addaddr-step2').style.display = '';
  setTimeout(() => document.getElementById('addaddr-inp')?.focus(), 180);
};

// Шаг 2 → Шаг 1: назад к карте
window.goToAddrMapStep = function () {
  document.getElementById('addaddr-step1').style.display = '';
  document.getElementById('addaddr-step2').style.display = 'none';
  setTimeout(() => _addrPickerMap?.invalidateSize(), 120);
};

function _destroyAddrPickerMap() {
  if (_addrPickerMap) { _addrPickerMap.remove(); _addrPickerMap = null; }
  _addrPickerMarker = null;
  _addrPickerLat    = null;
  _addrPickerLng    = null;
}

window.openAddAddrSheet = function () {
  const inp = document.getElementById('addaddr-inp');
  if (inp) inp.value = '';
  _destroyAddrPickerMap();
  Sheet.open('addaddr');
  // _onAddrSheetOpen инициирует карту после анимации открытия
};

window.closeAddAddrSheet = () => {
  _destroyAddrPickerMap();
  Sheet.close('addaddr');
};

window.saveProfileAddr = async function () {
  if (!CU) return;
  const text = document.getElementById('addaddr-inp')?.value.trim();
  if (!text) { toast('Введите адрес', 'warn'); return; }
  if (_addrPickerLat === null || _addrPickerLng === null) {
    toast('Укажите точку на карте', 'warn'); return;
  }
  const btn = document.getElementById('addaddr-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await addDoc(collection(db, 'users', CU.uid, 'addresses'), {
      text,
      lat: _addrPickerLat,
      lng: _addrPickerLng,
      createdAt: serverTimestamp()
    });
    closeAddAddrSheet();
    toast('Адрес добавлен', 'ok');
    await _loadProfAddrs();
  } catch (e) {
    console.error('saveProfileAddr:', e);
    toast('Ошибка сохранения', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; }
  }
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


// ─── 22. Выбор города ─────────────────────────────────────────
// DOM-структура и open/close управляются через sheet.js (Sheet 'city')
window.openPartnerSheet  = () => Sheet.open('partner');
window.closePartnerSheet = () => Sheet.close('partner');
window.openBookingsSheet = () => {
  const r = orders.find(o => o.status === 'reserved');
  if (r) { openOrderModal(r.id); }
  else   { Sheet.open('bookings'); }
};
window.openCitySheet  = () => Sheet.open('city');
window.closeCitySheet = () => Sheet.close('city');
window.openLikesSheet = () => Sheet.open('likes');
window.closeLikesSheet= () => Sheet.close('likes');

// ─── Оплата (Alif Pay / Google Pay) ────────────────────────
window.openAlifPaySheet = async function () {
  if (!activeOid) return toast('Заказ не найден', 'err');

  const btn = document.querySelector('.booking-btn-pay');
  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = '<div class="spin" style="width:16px;height:16px;border-color:rgba(0,0,0,.15);border-top-color:var(--tx);margin:0 auto"></div>';
  }

  try {
    const r    = await fetch('https://api.dastdaroz.shop/api/payment/init', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ orderId: activeOid }),
    });
    const data = await r.json();
    if (!r.ok || !data.paymentUrl) throw new Error(data.error || 'Ошибка платежа');
    listenBooked(activeOid);
    window.location.href = data.paymentUrl;
  } catch (err) {
    toast('Ошибка: ' + err.message, 'err');
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '<img class="booking-pay-ico" src="https://dastdaroz.shop/storage/others/alifpay.png" alt="Alif Pay"/> Alif Pay';
    }
  }
};
window.openGooglePaySheet = () => Sheet.open('googlepay');
window.openOfertaSheet    = () => SheetPdf.open('oferta');
window.closeOfertaSheet   = () => SheetPdf.close('oferta');
window.openPrivacySheet   = () => SheetPdf.open('privacy');
window.closePrivacySheet  = () => SheetPdf.close('privacy');

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
  setTimeout(closeCitySheet, 260);
};

// Геттеры выбранного города (для других модулей)
window.getSelectedCityId   = () => _selectedCityId;
window.getSelectedCityName = () => _selectedCityName;
