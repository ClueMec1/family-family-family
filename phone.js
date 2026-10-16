/* HTML Runner — the phone shell.
   Status bar, app windows that open from their icon, Back / Home / Recents, the recent-apps view,
   and the phone's own Back button (Android back, or Back in an app made from HTML Runner). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  const apps = new Map();   // id -> { el, name, icon(), bar(), back(), onShow, onHide, onClose, closable }
  let order = [];           // open apps, most recent last
  let fg = null;            // app in front, or null for the home screen
  let inRecents = false;
  const overlays = [];      // things Back closes first (sheets, menus, the app drawer)
  const hooks = [];

  /* ---------------- settings ---------------- */
  let sys = store.get('hr:system', { nav: 'buttons', status: 'auto' });
  function applySys() {
    const phone = $('phone');
    phone.dataset.nav = sys.nav === 'gesture' ? 'gesture' : 'buttons';
    const fullscreenish = matchMedia('(display-mode: fullscreen)').matches || (screen.height - innerHeight < 40 && innerWidth < 900);
    const show = sys.status === 'always' || (sys.status !== 'never' && fullscreenish);
    phone.classList.toggle('with-status', show);
  }
  addEventListener('resize', applySys);

  /* ---------------- status bar ---------------- */
  function inkFor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14161c' : '#fff';
  }
  function tickClock() {
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    $('sbTime').textContent = t;
  }
  function netState() { $('sbNet').classList.toggle('off', !navigator.onLine); $('sbNet').title = navigator.onLine ? 'Online' : 'Offline'; }
  addEventListener('online', netState); addEventListener('offline', netState);
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      const draw = () => {
        const pct = Math.round(b.level * 100);
        $('sbBatt').hidden = false;
        $('sbBatt').style.setProperty('--lvl', pct + '%');
        $('sbBatt').classList.toggle('low', pct <= 15 && !b.charging);
        $('sbBatt').classList.toggle('charging', b.charging);
        $('sbBattPct').textContent = pct + '%';
      };
      draw(); b.addEventListener('levelchange', draw); b.addEventListener('chargingchange', draw);
    }).catch(() => {});
  }
  // The status bar (and Chrome's own, through theme-color) takes the colour of the app in front
  function paintBars() {
    let bar = 'transparent', ink = '#fff';
    if (fg && !inRecents) {
      const a = apps.get(fg);
      bar = (a && a.bar && a.bar()) || '#121722';
      ink = inkFor(bar);
    }
    const sb = $('statusbar');
    sb.style.background = bar; sb.style.color = ink;
    const nav = $('navbar');
    nav.classList.toggle('over-home', !fg || inRecents);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = bar === 'transparent' ? '#0c0f15' : bar;
  }

  /* ---------------- windows ---------------- */
  function register(id, def) {
    apps.set(id, def);
    def.el.classList.add('win');
    def.el.dataset.win = id;
    def.el.setAttribute('aria-hidden', 'true');
  }
  function unregister(id) {
    order = order.filter((x) => x !== id);
    apps.delete(id);
    if (fg === id) fg = null;
    if (inRecents) layoutRecents();
    changed();
  }
  function changed() { paintBars(); hooks.forEach((f) => { try { f({ fg, order: order.slice() }); } catch (e) {} }); }

  function screenRect() { return $('screen').getBoundingClientRect(); }
  function iconRect(id) {
    const els = document.querySelectorAll(`[data-launch="${CSS.escape(id)}"] .ico`);
    for (const el of els) { const r = el.getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < innerHeight && el.offsetParent) return r; }
    return null;
  }
  function fromRectTransform(r) {
    const s = screenRect();
    const k = r.width / s.width;
    return `translate(${r.left - s.left}px, ${r.top - s.top}px) scale(${k})`;
  }

  function setVisible(id, on) {
    const a = apps.get(id); if (!a) return;
    a.el.classList.toggle('fg', on);
    a.el.setAttribute('aria-hidden', String(!on));
  }

  function show(id, fromEl) {
    const a = apps.get(id); if (!a) return;
    if (inRecents) exitRecents(id);
    const prev = fg;
    order = order.filter((x) => x !== id); order.push(id);
    fg = id;
    $('phone').classList.add('app-open');
    if (prev && prev !== id) { setVisible(prev, false); const p = apps.get(prev); p && p.onHide && p.onHide(); }
    setVisible(id, true);
    a.el.style.transform = '';
    if (prev !== id && !reduced) {
      const r = fromEl ? fromEl.getBoundingClientRect() : (!prev ? iconRect(id) : null);
      const frames = r && r.width
        ? [{ transform: fromRectTransform(r), borderRadius: '40px', opacity: .4 }, { transform: 'none', borderRadius: '0px', opacity: 1 }]
        : [{ transform: 'scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }];
      a.el.style.transformOrigin = r && r.width ? '0 0' : '50% 50%';
      a.el.animate(frames, { duration: 300, easing: EASE });
    }
    a.onShow && a.onShow();
    guard();
    changed();
  }

  function home() {
    if (overlays.length) closeOverlays();
    if (inRecents) { exitRecents(null); return; }
    if (!fg) { changed(); return; }
    const id = fg, a = apps.get(id);
    fg = null;
    $('phone').classList.remove('app-open');
    const finish = () => { setVisible(id, false); a.el.style.transform = ''; };
    if (!reduced && a) {
      const r = iconRect(id);
      a.el.style.transformOrigin = r ? '0 0' : '50% 50%';
      const anim = a.el.animate(r
        ? [{ transform: 'none', borderRadius: '0px', opacity: 1 }, { transform: fromRectTransform(r), borderRadius: '40px', opacity: 0 }]
        : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.9)', opacity: 0 }], { duration: 260, easing: EASE });
      anim.onfinish = finish;
    } else finish();
    a && a.onHide && a.onHide();
    changed();
  }

  function close(id) {
    const a = apps.get(id); if (!a) return;
    order = order.filter((x) => x !== id);
    if (fg === id) { fg = null; $('phone').classList.remove('app-open'); }
    setVisible(id, false);
    a.el.style.transform = '';
    if (a.onClose) a.onClose();
    if (inRecents) layoutRecents();
    changed();
  }

  function back(fromSystem) {
    if (overlays.length) { const o = overlays.pop(); o.close(); return true; }
    if (inRecents) { exitRecents(fg); return true; }
    if (fg) {
      const a = apps.get(fg);
      if (a && a.back && a.back(fromSystem)) return true;
      home(); return true;
    }
    if (homeBack && homeBack()) return true;
    return false;
  }
  let homeBack = null;

  /* ---------------- overlays (closed by Back first) ---------------- */
  function overlay(closeFn) {
    const o = { close: closeFn };
    overlays.push(o);
    guard();
    return () => { const i = overlays.indexOf(o); if (i >= 0) overlays.splice(i, 1); };
  }
  function closeOverlays() { while (overlays.length) overlays.pop().close(); }

  /* ---------------- the phone's own Back button ----------------
     One extra history entry sits on top while something is open. The phone's Back removes it,
     we handle that as Back, and put it back if something is still open.
     Pages inside the browser add their own entries above it, so Back steps through those first, like Chrome. */
  let guarded = false;
  function guard() {
    if (guarded) return;
    try { history.pushState({ hrGuard: Date.now() }, ''); guarded = true; } catch (e) {}
  }
  addEventListener('popstate', () => {
    guarded = false;
    back(true);
    if (fg || overlays.length || inRecents) guard();
  });

  /* ---------------- recent apps ----------------
     The real app windows shrink into cards, so you see them live. */
  function enterRecents() {
    if (overlays.length) closeOverlays();
    inRecents = true;
    const phone = $('phone');
    phone.classList.add('recents-on');
    buildStrip();
    order.forEach((id) => setVisible(id, true));
    // start on the app that was in front (or the newest)
    const strip = $('rstrip');
    const target = fg || order[order.length - 1];
    const idx = Math.max(0, order.indexOf(target));
    requestAnimationFrame(() => {
      const card = strip.children[idx];
      if (card) strip.scrollLeft = card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2;
      animateWindows(true);
    });
    guard();
    changed();
  }
  function exitRecents(openId) {
    const phone = $('phone');
    inRecents = false;
    const keep = openId && apps.has(openId) ? openId : null;
    // animate cards back
    order.forEach((id) => {
      const a = apps.get(id); if (!a) return;
      a.el.classList.add('animating');
      a.el.style.transform = id === keep ? '' : a.el.style.transform;
    });
    phone.classList.remove('recents-on');
    setTimeout(() => {
      order.forEach((id) => { const a = apps.get(id); if (!a) return; a.el.classList.remove('animating', 'in-recents'); a.el.style.transform = ''; if (id !== keep) setVisible(id, false); });
    }, 260);
    if (keep) {
      if (fg && fg !== keep) { const p = apps.get(fg); p && p.onHide && p.onHide(); }
      fg = keep;
      order = order.filter((x) => x !== keep); order.push(keep);
      phone.classList.add('app-open');
      const a = apps.get(keep); a.onShow && a.onShow();
    } else {
      fg = null; phone.classList.remove('app-open');
    }
    changed();
  }
  function buildStrip() {
    const strip = $('rstrip'); strip.innerHTML = '';
    const sr = screenRect(); strip.style.setProperty('--ratio', sr.width + ' / ' + sr.height);
    $('rempty').hidden = order.length > 0;
    $('rclear').hidden = order.length === 0;
    order.forEach((id) => {
      const a = apps.get(id);
      const card = document.createElement('div'); card.className = 'rcard'; card.dataset.id = id;
      const head = document.createElement('div'); head.className = 'rhead';
      const ic = a.icon ? a.icon(26) : document.createElement('i');
      head.append(ic);
      const n = document.createElement('span'); n.textContent = a.name(); head.append(n);
      if (a.menu) {
        const m = document.createElement('button'); m.className = 'rbtn'; m.type = 'button'; m.title = 'App options';
        m.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>';
        m.onclick = (e) => { e.stopPropagation(); a.menu(); };
        head.append(m);
      }
      const x = document.createElement('button'); x.className = 'rbtn'; x.type = 'button'; x.title = 'Close';
      x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.onclick = (e) => { e.stopPropagation(); dismissCard(card, id); };
      head.append(x);
      const slot = document.createElement('div'); slot.className = 'rslot';
      card.append(head, slot);
      bindCard(slot, card, id);
      strip.append(card);
    });
  }
  function bindCard(slot, card, id) {
    let sy = 0, sx = 0, dy = 0, dragging = false, pid = null;
    slot.addEventListener('pointerdown', (e) => { sy = e.clientY; sx = e.clientX; dy = 0; dragging = false; pid = e.pointerId; });
    slot.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      const ddy = e.clientY - sy, ddx = e.clientX - sx;
      if (!dragging && ddy < -12 && Math.abs(ddy) > Math.abs(ddx)) { dragging = true; try { slot.setPointerCapture(pid); } catch (er) {} }
      if (dragging) { dy = Math.min(0, ddy); card.style.transform = `translateY(${dy}px)`; card.style.opacity = String(1 + dy / 400); layoutRecents(); }
    });
    const end = () => {
      if (pid == null) return;
      pid = null;
      if (dragging) {
        if (dy < -120) dismissCard(card, id);
        else { card.style.transform = ''; card.style.opacity = ''; requestAnimationFrame(layoutRecents); }
      }
    };
    slot.addEventListener('pointerup', (e) => { const wasDrag = dragging; end(); if (!wasDrag && Math.abs(e.clientX - sx) < 8 && Math.abs(e.clientY - sy) < 8) exitRecents(id); });
    slot.addEventListener('pointercancel', end);
  }
  function dismissCard(card, id) {
    card.style.transition = 'transform .2s, opacity .2s';
    card.style.transform = 'translateY(-110%)'; card.style.opacity = '0';
    const a = apps.get(id);
    if (a) { a.el.classList.add('animating'); a.el.style.opacity = '0'; }
    setTimeout(() => {
      if (a) { a.el.style.opacity = ''; a.el.classList.remove('animating'); }
      card.remove(); close(id);
      $('rempty').hidden = order.length > 0; $('rclear').hidden = order.length === 0;
      if (!order.length) setTimeout(() => exitRecents(null), 150);
    }, 200);
  }
  function layoutRecents() {
    if (!inRecents) return;
    const s = screenRect();
    document.querySelectorAll('#rstrip .rcard').forEach((card) => {
      const a = apps.get(card.dataset.id); if (!a) return;
      const r = card.querySelector('.rslot').getBoundingClientRect();
      const k = r.width / s.width;
      a.el.classList.add('in-recents');
      a.el.style.transformOrigin = '0 0';
      a.el.style.transform = `translate(${r.left - s.left}px, ${r.top - s.top}px) scale(${k})`;
      a.el.style.opacity = card.style.opacity || '';
    });
  }
  function animateWindows() {
    order.forEach((id) => { const a = apps.get(id); a && a.el.classList.add('animating'); });
    layoutRecents();
    setTimeout(() => order.forEach((id) => { const a = apps.get(id); a && a.el.classList.remove('animating'); }), 280);
  }

  /* ---------------- nav bar ---------------- */
  function bindNav() {
    $('navBack').onclick = () => back(false);
    $('navHome').onclick = () => home();
    $('navRecents').onclick = () => (inRecents ? exitRecents(fg) : enterRecents());
    $('rstrip').addEventListener('scroll', () => requestAnimationFrame(layoutRecents), { passive: true });
    addEventListener('resize', () => requestAnimationFrame(layoutRecents));
    $('rclear').onclick = () => { [...order].forEach((id) => close(id)); exitRecents(null); };
    $('recents').addEventListener('click', (e) => { if (e.target === $('recents') || e.target === $('rstrip')) exitRecents(null); });
    // gesture bar: tap = Home, swipe up = Recents, swipe sideways = previous app
    const pill = $('navPill');
    let sx = 0, sy = 0, t0 = 0;
    pill.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; t0 = Date.now(); try { pill.setPointerCapture(e.pointerId); } catch (er) {} });
    pill.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (dy < -30 && Math.abs(dy) > Math.abs(dx)) { if (Date.now() - t0 > 350 || fg) enterRecents(); else home(); }
      else if (Math.abs(dx) > 40) { const prev = order.filter((x) => x !== fg).pop(); if (prev) show(prev); }
      else home();
    });
  }

  window.PHONE = {
    register, unregister, show, home, back, close, overlay, closeOverlays,
    recents: (on) => (on === false ? exitRecents(fg) : enterRecents()),
    current: () => fg, isOpen: (id) => order.includes(id), openList: () => order.slice(),
    onChange: (f) => hooks.push(f), refresh: changed, setHomeBack: (f) => { homeBack = f; },
    system: () => ({ ...sys }), setSystem: (next) => { sys = { ...sys, ...next }; store.set('hr:system', sys); applySys(); },
    inkFor,
  };

  document.addEventListener('DOMContentLoaded', () => {
    applySys(); tickClock(); netState(); bindNav(); paintBars();
    // a focused text box can make the browser scroll containers that should never move
    ['phone', 'screen', 'launcher'].forEach((id) => { const el = $(id); el.addEventListener('scroll', () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } }); });
    document.querySelectorAll('.win').forEach((w) => w.addEventListener('scroll', () => { if (w.scrollTop) w.scrollTop = 0; }));
    addEventListener('scroll', () => { if (scrollY) scrollTo(0, 0); });
    setInterval(tickClock, 10000);
  });
})();
