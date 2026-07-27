// ============================================================
//  ПАТЧ для app.js — Логика транзакции (добавить в app.js)
//  Автор: Dastdaroz · dastdaroz.shop
// ============================================================
//
//  1. ЗАМЕНИТЬ функцию doCheckout (строки ~1163–1217 в app.js)
//  2. ДОБАВИТЬ функцию createOrder и хэш-обработчик в конец app.js
//
// ============================================================


// ══════════════════════════════════════════════════════════════
//  [1] ЗАМЕНА doCheckout
//  Найди в app.js:   window.doCheckout = async function () {
//  Замени всю функцию (до закрывающей };) на эту:
// ══════════════════════════════════════════════════════════════

window.doCheckout = async function () {
  if (!requireAuth('Барои фармоиш ворид шавед')) return;
  if (!cart.length) return;

  const addr = document.getElementById('cart-addr').value.trim();
  const lat  = parseFloat(document.getElementById('cart-lat')?.value) || null;
  const lng  = parseFloat(document.getElementById('cart-lng')?.value) || null;

  if (!addr) {
    toast('Суроғи расониданро нишон диҳед', 'err');
    return;
  }

  const payMethod = document.getElementById('cart-pay').value;
  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spin" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;width:14px;height:14px"></div> Расмикунонӣ…';

  try {
    const sub    = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const total  = sub + DFEE;
    const oNum   = nextOrderNum();
    const confirmCode = Math.floor(1000 + Math.random() * 9000).toString();

    // reserved_until = now + 10 minutes
    const reservedUntil = new Date(Date.now() + 10 * 60 * 1000);

    const ref = await addDoc(collection(db, 'orders'), {
      clientId:      CU.uid,
      clientName:    UD?.displayName || '',
      orderNumber:   oNum,
      confirmCode:   confirmCode,
      items:         cart.map(c => ({ productId: c.productId, name: c.name, price: c.price, quantity: c.quantity })),
      subtotal:      sub,
      deliveryFee:   DFEE,
      total:         total,
      address:       addr,
      lat:           lat,
      lng:           lng,
      comment:       document.getElementById('cart-comment').value.trim(),
      paymentMethod: payMethod,
      // Payment statuses
      status:        payMethod === 'card' ? 'awaiting_payment' : 'pending',
      paymentStatus: payMethod === 'card' ? 'pending' : null,
      reserved_until: payMethod === 'card' ? reservedUntil : null,
      externalId:    null,
      paidAt:        null,
      courierId:     null,
      courierName:   null,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    });

    // Clear cart
    activeOid = ref.id;
    const b = writeBatch(db);
    cart.forEach(c => b.delete(doc(db, 'users', CU.uid, 'cart', c.productId)));
    await b.commit();
    cart = [];
    renderCart(); updateBadges();

    if (payMethod === 'card') {
      // ── Online payment: redirect to transaction page ──────────
      toast('Фармоиш №' + oNum + ' созда шуд! Ба пардохт гузаред 💳', 'ok');
      setTimeout(() => {
        window.location.href = `transaction.html?order_id=${ref.id}&amount=${total}`;
      }, 800);
    } else {
      // ── Cash payment: existing flow ───────────────────────────
      toast('Фармоиш №' + oNum + ' расмикунонӣ шуд! 🎉', 'ok');
      listenLive(ref.id);
      await loadOrders();
      goPage('status');
    }

  } catch (e) {
    toast('Хато: ' + e.message, 'err');
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Фармоиш расмикунонӣ';
  }
};


// ══════════════════════════════════════════════════════════════
//  [2] ДОБАВИТЬ в конец app.js — обновление статусов в SL/SC
//  Найди в app.js:  const SL = { ... };
//  Добавь новые статусы внутрь объектов:
// ══════════════════════════════════════════════════════════════

// Добавить в SL:
//   awaiting_payment: 'Интизори пардохт',
//   payment_failed:   'Пардохт нокомёб шуд',
//   paid:             'Пардохт шуд',

// Добавить в SC:
//   awaiting_payment: 'var(--blue)',
//   payment_failed:   'var(--red)',
//   paid:             'var(--acc)',


// ══════════════════════════════════════════════════════════════
//  [3] ДОБАВИТЬ в конец app.js — хэш-навигация для home.html
//      Открывает конкретный заказ по URL: home.html#order-{orderId}
// ══════════════════════════════════════════════════════════════

// ─── Hash navigation: open specific order after payment ───────
(function initHashNav() {
  function handleHash() {
    const hash = location.hash; // e.g. "#order-abc123" or "#orders"
    if (!hash) return;

    if (hash === '#orders') {
      // Just open orders tab
      goPage('orders');
      return;
    }

    const orderMatch = hash.match(/^#order-(.+)$/);
    if (!orderMatch) return;

    const targetOrderId = orderMatch[1];

    // Navigate to orders page
    goPage('orders');

    // Wait for orders to be loaded, then highlight/open the target order
    function tryOpen(attempts) {
      if (attempts <= 0) return;
      const order = orders.find(o => o.id === targetOrderId);
      if (order) {
        // Open the order modal
        openOrderModal(targetOrderId);

        // Highlight the card in the list
        setTimeout(() => {
          const card = document.querySelector(`.oc[data-id="${targetOrderId}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.transition = 'box-shadow .3s, outline .3s';
            card.style.outline    = '2.5px solid var(--acc)';
            card.style.boxShadow  = '0 0 0 5px rgba(26,158,74,.18)';
            setTimeout(() => {
              card.style.outline   = '';
              card.style.boxShadow = '';
            }, 2800);
          }
        }, 200);

        // Clean up hash without page reload
        history.replaceState(null, '', location.pathname);
      } else {
        // Orders not yet loaded — retry
        setTimeout(() => tryOpen(attempts - 1), 400);
      }
    }

    tryOpen(12); // up to ~5 seconds of retries
  }

  // Run on page load
  window.addEventListener('load', () => {
    // Small delay so auth & orders have time to load
    setTimeout(handleHash, 1200);
  });

  // Also handle hash changes (browser back/forward)
  window.addEventListener('hashchange', handleHash);
})();


// ══════════════════════════════════════════════════════════════
//  [4] ОБНОВИТЬ renderOrders() — добавить data-id на карточку
//      Найди в app.js:  return `<div class="oc st-${o.status}"
//      Замени строку на:
// ══════════════════════════════════════════════════════════════

// БЫЛО:
//   return `<div class="oc st-${o.status}" onclick="openOrderModal('${o.id}')" style="cursor:pointer">
// СТАЛО:
//   return `<div class="oc st-${o.status}" data-id="${o.id}" onclick="openOrderModal('${o.id}')" style="cursor:pointer">

// ══════════════════════════════════════════════════════════════
//  [5] ОБНОВИТЬ filterOrders() — добавить awaiting_payment
//      в список активных заказов
// ══════════════════════════════════════════════════════════════

// БЫЛО:
//   if (currentOTab === 'active') return orders.filter(o => ['pending','confirmed','preparing','delivering'].includes(o.status));
// СТАЛО:
//   if (currentOTab === 'active') return orders.filter(o => ['awaiting_payment','pending','confirmed','preparing','delivering'].includes(o.status));


// ══════════════════════════════════════════════════════════════
//  [6] ОБНОВИТЬ loadOrders() — listenLive тоже должен включать
//      awaiting_payment
// ══════════════════════════════════════════════════════════════

// БЫЛО:
//   const live = orders.find(o => ['pending','confirmed','preparing','delivering'].includes(o.status));
// СТАЛО:
//   const live = orders.find(o => ['awaiting_payment','pending','confirmed','preparing','delivering'].includes(o.status));


// ══════════════════════════════════════════════════════════════
//  [7] ДОБАВИТЬ кнопку "Пардохт" на карточке заказа в renderOrders
//      Когда статус awaiting_payment — показываем кнопку "Пардохт"
// ══════════════════════════════════════════════════════════════

// В renderOrders(), после строки с `isActive`, добавить:
//
//   const awaitingPay = o.status === 'awaiting_payment';
//   const payBtn = awaitingPay
//     ? `<button
//          onclick="event.stopPropagation();window.location.href='transaction.html?order_id=${o.id}&amount=${o.total}'"
//          style="margin-top:10px;width:100%;padding:10px;background:linear-gradient(135deg,var(--acc),var(--acc2));border:none;border-radius:10px;color:#fff;font-family:var(--fd);font-weight:800;font-size:.74rem;cursor:pointer;box-shadow:0 3px 10px var(--acc-shadow)">
//          💳 Пардохт кунед
//        </button>`
//     : '';
//
// И в HTML карточки заказа добавить ${payBtn} после закрывающего </div> "oc-footer":
//   ...${payBtn}
//   </div>`  ← закрывающий тег карточки
