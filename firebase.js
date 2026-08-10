// ============================================================
//  firebase.js — Firebase конфигурация и инициализация
//
//  Импорт:
//    import { auth, db, storage } from './firebase.js';
//    import { COL, ROLES, ORDER_STATUS } from './firebase.js';
// ============================================================

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js';

// ─── Firebase конфиг ─────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCjIAMFuwLKwmjChCuiz-MHLv5WZOczAAE',
  authDomain:        'delivery-galelium.firebaseapp.com',
  projectId:         'delivery-galelium',
  storageBucket:     'delivery-galelium.firebasestorage.app',
  messagingSenderId: '982466555080',
  appId:             '1:982466555080:web:c77ccabff0e71e540ddc9fd',
};

// ─── Инициализация ────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ─── Имена коллекций Firestore ────────────────────────────────
export const COL = {
  USERS:           'users',
  PRODUCTS:        'products',
  ORDERS:          'orders',
  CART:            'cart',
  COURIERS:        'couriers',
  REVIEWS:         'reviews',
  CATEGORIES:      'categories',
  RETAILERS:       'retailers',
  CITIES:          'cities',
  GENERAL_CATS:    'generalCatalogs',
  SUPPORT_CHATS:   'supportChats',
  MAVSIMI_QUEUE:   'mavsimiQueue',
  CONFIG:          'config',
};

// ─── Роли пользователей ───────────────────────────────────────
export const ROLES = {
  CLIENT:  'client',
  COURIER: 'courier',
  ADMIN:   'admin',
};

// ─── Статусы заказов ──────────────────────────────────────────
export const ORDER_STATUS = {
  PENDING:    'pending',     // Ожидает подтверждения
  CONFIRMED:  'confirmed',   // Подтверждён
  PREPARING:  'preparing',   // Готовится
  DELIVERING: 'delivering',  // В доставке
  DELIVERED:  'delivered',   // Доставлен
  CANCELLED:  'cancelled',   // Отменён
};

// ─── Методы оплаты ────────────────────────────────────────────
export const PAYMENT_METHOD = {
  CASH:   'cash',
  CARD:   'card',
  ONLINE: 'online',
};
