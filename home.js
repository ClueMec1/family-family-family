/* HTML Runner — the home screen (launcher): clock, pages of apps, dock, app drawer,
   and the web apps you add, which open full screen like installed apps. */
(function () {
  'use strict';
  const HR = window.HR;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const COLORS = ['#ff8a3d', '#ffb547', '#5fd39a', '#2fb7c4', '#5b8cff', '#a57bff', '#ff6b9a', '#e05252', '#3b4256', '#f2efe8'];
  const WALLS = {
    aurora: { name: 'Aurora', css: 'radial-gradient(120% 60% at 0% 0%,#1f6b5c 0%,transparent 55%),radial-gradient(100% 60% at 100% 30%,#3b2a7a 0%,transparent 60%),radial-gradient(120% 70% at 50% 110%,#0f3b66 0%,transparent 60%),#070b14' },
    ember: { name: 'Ember', css: 'radial-gradient(120% 70% at 85% 0%,#7a3414 0%,transparent 60%),radial-gradient(90% 60% at 0% 100%,#4a1f45 0%,transparent 65%),#120d0c' },
    sunset: { name: 'Sunset', css: 'linear-gradient(175deg,#1b1640 0%,#5b2a5a 42%,#c4553a 78%,#f0a05a 100%)' },
    sea: { name: 'Deep sea', css: 'radial-gradient(110% 70% at 10% 0%,#0f5a66 0%,transparent 60%),radial-gradient(90% 60% at 100% 100%,#12306e 0%,transparent 65%),#060c16' },
    moss: { name: 'Moss', css: 'radial-gradient(100% 70% at 80% 10%,#3a5a2a 0%,transparent 60%),radial-gradient(90% 60% at 0% 90%,#1d4a40 0%,transparent 65%),#0a110d' },
    blush: { name: 'Blush', css: 'linear-gradient(160deg,#2a1830 0%,#6a3050 50%,#d27a8a 100%)' },
    dunes: { name: 'Dunes', css: 'radial-gradient(140% 60% at 50% 120%,#a0562a 0%,transparent 60%),linear-gradient(180deg,#141a2e 0%,#3a2a3a 60%,#7a4a30 100%)' },
    graphite: { name: 'Graphite', css: 'linear-gradient(180deg,#14171e,#0b0d12)' },
  };
  const MAX_RUNNING = 5;

  function sameUrl(u) { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/+$/, '') + x.search; } catch (e) { return u; } }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }
  // Clean up entries left by older versions of HTML Runner, which used the same storage name
  function cleanApps(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.filter((a) => {
      if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id) return false;
      if (a.kind === 'code') return true;
      if (typeof a.url !== 'string' || !/^https?:/i.test(a.url)) return false;
      const k = sameUrl(a.url); if (seen.has(k)) return false; seen.add(k);
      a.kind = 'web'; a.name = String(a.name || host(a.url)); return true;
    });
  }
  const rawApps = store.get('hr:apps', []);
  let apps = cleanApps(rawApps);
  if (!Array.isArray(rawApps) || apps.length !== rawApps.length) store.set('hr:apps', apps);
  let prefs = { wall: 'aurora', shape: 'squircle', labels: true, cols: 4, ...store.get('hr:homeprefs', {}) };
  if (!WALLS[prefs.wall]) prefs.wall = 'aurora';
  const running = new Map(); // id -> { win, frame, inframe, skip }
  const save = () => store.set('hr:apps', apps);
  const savePrefs = () => store.set('hr:homeprefs', prefs);
  const byId = (id) => apps.find((a) => a.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function hashColor(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % 8]; }
  const inkFor = (hex) => PHONE.inkFor(hex);

  /* ---------------- built-in apps ---------------- */
  const BUILTIN = {
    browser: { name: 'Browser', bg: 'linear-gradient(145deg,#5aa0ff,#1f5fe0)', glyph: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.6 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.6-3.6-8.5s1-5.9 3.6-8.5z"/>' },
    code: { name: 'Code', bg: 'linear-gradient(145deg,#ffc56b,#ff7a3d)', glyph: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5.5l-3 13"/>' },
    ai: { name: 'AI', bg: 'linear-gradient(145deg,#b693ff,#6a4bff)', glyph: '<path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>' },
    settings: { name: 'Settings', bg: 'linear-gradient(145deg,#8792a8,#454e63)', glyph: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>' },
  };
  const DOCK = ['browser', 'code', 'ai', 'settings'];
  function builtinIcon(id, size) {
    const b = BUILTIN[id];
    const i = document.createElement('i'); i.className = 'ico builtin';
    if (size) i.style.setProperty('--s', size + 'px');
    i.style.background = b.bg;
    i.innerHTML = `<svg viewBox="0 0 24 24">${b.glyph}</svg>`;
    return i;
  }

  /* ---------------- icons for your apps ---------------- */
  function iconEl(app, size) {
    const i = document.createElement('i');
    i.className = 'ico';
    if (size) i.style.setProperty('--s', size + 'px');
    const bg = app.color || hashColor(app.name || '?');
    i.style.background = bg;
    i.style.color = inkFor(bg);
    const letter = () => {
      i.textContent = '';
      i.classList.remove('img');
      if (app.kind === 'code') i.innerHTML = '<b class="code">&lt;/&gt;</b>';
      else i.innerHTML = `<b>${esc((app.name || '?').trim().charAt(0).toUpperCase())}</b>`;
    };
    if (app.icon) {
      const img = new Image();
      img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.draggable = false;
      img.onerror = letter;
      img.src = app.icon;
      i.classList.add('img');
      i.append(img);
    } else letter();
    return i;
  }
  const iconFor = (id, size) => (BUILTIN[id] ? builtinIcon(id, size) : iconEl(byId(id.replace(/^app:/, '')) || { name: '?' }, size));

  /* ---------------- launcher ---------------- */
  function tile(id, name, icon, onTap, onLong, withLabel = true) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'app'; b.setAttribute('role', 'listitem');
    b.dataset.launch = id;
    b.append(icon);
    if (withLabel) { const l = document.createElement('span'); l.textContent = name; b.append(l); }
    if (PHONE.isOpen(id)) b.classList.add('running');
    bindPress(b, onTap, onLong);
    return b;
  }
  const appTile = (app, withLabel) => tile('app:' + app.id, app.name, iconEl(app), (el) => openApp(app.id, el), (el) => appMenu(app.id, el), withLabel);
  const builtinTile = (id, withLabel) => tile(id, BUILTIN[id].name, builtinIcon(id), (el) => openBuiltin(id, el), (el) => builtinMenu(id, el), withLabel);

  function glance() {
    const g = document.createElement('div'); g.className = 'glance';
    g.innerHTML = '<div class="g-time" id="hTime"></div><div class="g-date" id="hDate"></div>';
    return g;
  }
  function tick() {
    const d = new Date();
    const t = $('hTime'), dt = $('hDate');
    if (t) t.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    if (dt) dt.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  setInterval(tick, 10000);

  let page = 0;
  function render() {
    const phone = $('phone');
    phone.style.setProperty('--wall', (WALLS[prefs.wall] || WALLS.aurora).css);
    phone.dataset.shape = prefs.shape;
    phone.classList.toggle('no-labels', !prefs.labels);
    phone.style.setProperty('--cols', prefs.cols);
    // dock
    const dock = $('dock'); dock.innerHTML = '';
    DOCK.forEach((id) => dock.append(builtinTile(id, false)));
    // pages: measure how many rows fit
    const box = $('lpages');
    const h = box.clientHeight || 500;
    const rowH = prefs.labels ? 92 : 78;
    const firstRows = Math.max(1, Math.floor((h - 190) / rowH));
    const rows = Math.max(1, Math.floor((h - 24) / rowH));
    const per0 = firstRows * prefs.cols, per = rows * prefs.cols;
    const chunks = [apps.slice(0, per0)];
    for (let i = per0; i < apps.length; i += per) chunks.push(apps.slice(i, i + per));
    box.innerHTML = '';
    chunks.forEach((list, n) => {
      const p = document.createElement('div'); p.className = 'lpage';
      if (n === 0) p.append(glance());
      const grid = document.createElement('div'); grid.className = 'grid'; grid.setAttribute('role', 'list');
      list.forEach((app) => grid.append(appTile(app, true)));
      if (n === 0 && !apps.length) {
        const e = document.createElement('div'); e.className = 'gempty';
        e.innerHTML = '<b>Make this phone yours</b><span>Open a site in <em>Browser</em>, tap ⋮ and choose <em>Add to Home screen</em>. It opens full screen from here, like an installed app. Your own code can be an app too: Code → ⋯ → Add to Home screen.</span>';
        grid.append(e);
      }
      p.append(grid);
      box.append(p);
    });
    const dots = $('ldots'); dots.innerHTML = '';
    if (chunks.length > 1) chunks.forEach((_, n) => { const d = document.createElement('i'); if (n === page) d.className = 'on'; dots.append(d); });
    page = Math.min(page, chunks.length - 1);
    box.scrollLeft = page * box.clientWidth;
    tick();
    drawDrawer();
  }
  $('lpages').addEventListener('scroll', () => {
    const box = $('lpages'), n = Math.round(box.scrollLeft / Math.max(1, box.clientWidth));
    if (n !== page) { page = n; [...$('ldots').children].forEach((d, i) => d.classList.toggle('on', i === n)); }
  }, { passive: true });
  let resizeT; addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(render, 150); });

  /* ---------------- app drawer (swipe up) ---------------- */
  let unDrawer = null;
  function openDrawer() {
    const d = $('adrawer'); if (d.classList.contains('open')) return;
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    $('adSearch').value = ''; drawDrawer();
    unDrawer = PHONE.overlay(() => closeDrawer(true));
  }
  function closeDrawer(fromBack) {
    const d = $('adrawer');
    d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); d.style.transform = '';
    $('adSearch').blur();
    if (unDrawer && !fromBack) unDrawer();
    unDrawer = null;
  }
  function drawDrawer() {
    const g = $('adGrid'); if (!g) return;
    const q = $('adSearch').value.trim().toLowerCase();
    const all = Object.keys(BUILTIN).map((id) => ({ name: BUILTIN[id].name, el: () => builtinTile(id, true) }))
      .concat(apps.map((a) => ({ name: a.name, el: () => appTile(a, true) })))
      .filter((x) => !q || x.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    g.innerHTML = '';
    all.forEach((x) => g.append(x.el()));
    if (q) {
      const w = document.createElement('button'); w.type = 'button'; w.className = 'ad-web';
      w.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span></span>';
      w.querySelector('span').textContent = 'Search the web for “' + $('adSearch').value.trim() + '”';
      w.onclick = () => { const v = $('adSearch').value.trim(); closeDrawer(); HR.openInBrowser(v); };
      g.append(w);
    }
  }
  $('adSearch').addEventListener('input', drawDrawer);
  $('adSearch').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = $('adGrid').querySelector('.app');
    if (first && $('adSearch').value.trim() && $('adGrid').querySelectorAll('.app').length === 1) first.click();
    else if ($('adSearch').value.trim()) { const v = $('adSearch').value.trim(); closeDrawer(); HR.openInBrowser(v); }
  });
  // swipe up on the home screen opens the drawer; swipe down at its top closes it
  (function swipes() {
    let sx = 0, sy = 0, on = false, target = null;
    const L = $('launcher');
    L.addEventListener('pointerdown', (e) => {
      if (e.target.closest('input,.hsearch')) return;
      sx = e.clientX; sy = e.clientY; on = true; target = $('adrawer').classList.contains('open') ? 'drawer' : 'home';
    });
    L.addEventListener('pointerup', (e) => {
      if (!on) return; on = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
      if (target === 'home' && dy < 0) openDrawer();
      else if (target === 'drawer' && dy > 0 && $('adScroll').scrollTop <= 0) closeDrawer();
    });
    L.addEventListener('pointercancel', () => { on = false; });
    // touch screens: pointer events stop once scrolling starts, so watch touches too
    let ty = 0, tx = 0;
    L.addEventListener('touchstart', (e) => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; target = $('adrawer').classList.contains('open') ? 'drawer' : 'home'; }, { passive: true });
    L.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]; const dx = t.clientX - tx, dy = t.clientY - ty;
      if (e.target.closest && e.target.closest('input')) return;
      if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
      if (target === 'home' && dy < 0) openDrawer();
      else if (target === 'drawer' && dy > 0 && $('adScroll').scrollTop <= 0) closeDrawer();
    }, { passive: true });
  })();

  /* ---------------- long press ---------------- */
  function bindPress(el, onTap, onLong) {
    let t = null, longed = false, sx = 0, sy = 0;
    el.addEventListener('pointerdown', (e) => {
      longed = false; sx = e.clientX; sy = e.clientY;
      t = setTimeout(() => { longed = true; el.classList.add('pressed'); if (navigator.vibrate) navigator.vibrate(12); onLong(el); setTimeout(() => el.classList.remove('pressed'), 200); }, 450);
    });
    el.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(t); t = null; } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => { clearTimeout(t); t = null; }));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!longed) { longed = true; onLong(el); } });
    el.addEventListener('click', (e) => { if (longed) { e.preventDefault(); longed = false; return; } onTap(el); });
  }

  // the little menu that pops up from an icon, like Android's
  let unPop = null;
  function popMenu(anchor, title, items) {
    const m = $('popmenu');
    m.innerHTML = '';
    const h = document.createElement('div'); h.className = 'pm-title'; h.textContent = title; m.append(h);
    items.forEach((it) => {
      const b = document.createElement('button'); b.type = 'button';
      if (it.danger) b.className = 'danger';
      b.innerHTML = (it.icon || '') + '<span></span>';
      b.querySelector('span').textContent = it.label;
      b.onclick = () => { closePop(); it.run(); };
      m.append(b);
    });
    m.hidden = false;
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 100, right: innerWidth / 2 + 100, top: innerHeight / 3, bottom: innerHeight / 3, width: 200 };
    const w = m.offsetWidth, hh = m.offsetHeight;
    let left = Math.min(Math.max(10, r.left + r.width / 2 - w / 2), innerWidth - w - 10);
    let top = r.top - hh - 8; if (top < 30) top = r.bottom + 8;
    if (top + hh > innerHeight - 10) top = innerHeight - hh - 10;
    m.style.left = left + 'px'; m.style.top = top + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    unPop = PHONE.overlay(() => closePop(true));
  }
  function outside(e) { if (!$('popmenu').contains(e.target)) closePop(); }
  function closePop(fromBack) {
    $('popmenu').hidden = true;
    document.removeEventListener('pointerdown', outside, true);
    if (unPop && !fromBack) unPop();
    unPop = null;
  }
  const I = {
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
    web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.6 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.6-3.6-8.5s1-5.9 3.6-8.5z"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    code: '<svg viewBox="0 0 24 24"><path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5"/></svg>',
    sync: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  function appMenu(id, anchor) {
    const app = byId(id); if (!app) return;
    const items = [{ label: 'Edit (name, icon, position)', icon: I.info, run: () => editApp(id) }];
    if (app.kind === 'code') {
      items.push({ label: 'Update with my current code', icon: I.sync, run: () => { snapshot(app.id); if (running.has(id)) closeApp(id, true); HR.toast('Updated “' + app.name + '”'); } });
      items.push({ label: 'Edit in Code', icon: I.code, run: () => HR.showCode('html') });
    } else {
      items.push({ label: 'Open in Browser', icon: I.web, run: () => HR.openInBrowser(app.url) });
      items.push({ label: 'Open in Chrome', icon: I.out, run: () => HR.openInChrome(app.url) });
    }
    if (running.has(id)) items.push({ label: 'Close app', icon: I.close, run: () => closeApp(id) });
    items.push({ label: 'Remove', icon: I.del, danger: true, run: () => removeApp(id) });
    popMenu(anchor, app.name, items);
  }
  function builtinMenu(id, anchor) {
    const items = [{ label: 'Open', icon: I.info, run: () => openBuiltin(id) }];
    if (PHONE.isOpen(id)) items.push({ label: 'Close app', icon: I.close, run: () => PHONE.close(id) });
    if (id === 'browser') items.push({ label: 'New tab', icon: I.web, run: () => { openBuiltin('browser'); HR.openInBrowser(HR.browser.START); } });
    popMenu(anchor, BUILTIN[id].name, items);
  }
  function removeApp(id) {
    const app = byId(id); if (!app) return;
    HR.sheet({ title: 'Remove “' + app.name + '”?', body: '<p>It disappears from your Home screen. You can add it again from the Browser any time.</p>', actions: [
      { label: 'Cancel' },
      { label: 'Remove', primary: true, onClick: () => {
        closeApp(id, true);
        apps = apps.filter((a) => a.id !== id); save(); store.del('hr:appcode:' + id);
        if ('caches' in window) caches.open('hr-apps').then((c) => c.delete(CODE_BASE() + id + '/index.html')).catch(() => {});
        render(); HR.toast('Removed “' + app.name + '”');
      } },
    ] });
  }

  /* ---------------- opening things ---------------- */
  function openBuiltin(id, from) {
    closeDrawer();
    HR.showView(id, from && from.querySelector ? from.querySelector('.ico') : null);
  }

  const CODE_BASE = () => new URL('apps/', location.href).href;
  const faviconFor = (url) => 'https://www.google.com/s2/favicons?sz=128&domain_url=' + encodeURIComponent(new URL(url).origin);
  async function codeUrl(app) {
    const html = store.get('hr:appcode:' + app.id, null);
    if (html == null) return { srcdoc: '<p style="font-family:system-ui;padding:24px">This app\'s code is missing. Long-press its icon and choose “Update with my current code”.</p>' };
    if (HR.canServe()) {
      try {
        const cache = await caches.open('hr-apps');
        const url = CODE_BASE() + app.id + '/index.html';
        await cache.put(url, new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }));
        return { src: url };
      } catch (e) { /* fall through */ }
    }
    return { srcdoc: html };
  }

  // Each web app gets its own window with a splash screen, like an installed app
  async function launch(app) {
    const wid = 'app:' + app.id;
    const win = document.createElement('section');
    win.className = 'webwin';
    win.setAttribute('aria-label', app.name);
    const bar = app.theme || app.color || '#121722';
    const splashBg = app.bg || bar;
    const splash = document.createElement('div'); splash.className = 'splash';
    splash.style.background = splashBg; splash.style.color = inkFor(splashBg);
    splash.append(iconEl(app, 96));
    const nm = document.createElement('span'); nm.textContent = app.name; splash.append(nm);
    win.append(splash);
    $('recents').before(win);
    const r = { win, frame: null, inframe: 0, skip: 0, initial: true };
    running.set(app.id, r);

    PHONE.register(wid, {
      el: win,
      name: () => (byId(app.id) || app).name,
      icon: (s) => iconEl(byId(app.id) || app, s),
      bar: () => { const a = byId(app.id) || app; return a.theme || a.color || '#121722'; },
      back: (fromSystem) => {
        // links tapped inside the app step back first (the phone's own Back already does this by itself)
        if (!fromSystem && r.inframe > 0) { r.inframe--; r.skip++; history.back(); return true; }
        return false;
      },
      onClose: () => { win.remove(); running.delete(app.id); PHONE.unregister(wid); render(); },
      menu: () => appMenu(app.id, null),
    });

    const hide = () => { if (!splash.isConnected) return; splash.classList.add('gone'); setTimeout(() => splash.remove(), 300); };
    const t0 = Date.now();
    const done = () => setTimeout(hide, Math.max(0, 450 - (Date.now() - t0)));
    const rule = app.kind === 'web' ? HR.siteRule(app.url) : null;
    if (rule && rule.blocked) {
      const card = HR.blockedCard(app.url, rule, { onVideo: (v) => HR.openInBrowser(v), onTry: () => { card.replaceWith(makeFrame(HR.proxy.wrap(app.url))); } });
      card.classList.add('wpage');
      win.prepend(card); r.frame = card; done();
    } else {
      let src = null, srcdoc = null;
      if (app.kind === 'code') { const t = await codeUrl(app); src = t.src; srcdoc = t.srcdoc; }
      else src = rule && rule.embed ? rule.embed : HR.proxy.wrap(app.url);
      const f = makeFrame(src, srcdoc);
      win.prepend(f); r.frame = f;
      setTimeout(hide, 4000);
    }
    function makeFrame(src, srcdoc) {
      const f = document.createElement('iframe');
      f.className = 'wpage'; f.title = app.name;
      f.setAttribute('allow', 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; web-share; payment; display-capture; picture-in-picture');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      f.addEventListener('load', () => {
        done();
        if (r.initial) r.initial = false; else if (r.skip > 0) r.skip--; else r.inframe++;
      });
      if (src) f.src = src; else f.srcdoc = srcdoc;
      r.frame = f;
      return f;
    }
    // keep memory in check: close the app used longest ago
    const open = [...running.keys()].filter((id) => id !== app.id);
    if (open.length >= MAX_RUNNING) {
      const order = PHONE.openList().filter((w) => w.startsWith('app:') && w !== wid);
      if (order[0]) closeApp(order[0].slice(4), true);
    }
    return win;
  }

  async function openApp(id, fromEl) {
    const app = byId(id); if (!app) return;
    closeDrawer();
    if (!running.has(id)) await launch(app);
    PHONE.show('app:' + id, fromEl && fromEl.querySelector ? fromEl.querySelector('.ico') : null);
    app.used = Date.now(); save();
    render();
  }
  function goHome() { PHONE.home(); }
  function closeApp(id, quiet) {
    if (!running.has(id)) return;
    PHONE.close('app:' + id);
    if (!quiet) HR.toast('Closed ' + ((byId(id) || {}).name || 'app'));
  }

  /* ---------------- add / edit ---------------- */
  function addApp(a) {
    const app = { id: newId(), kind: a.kind || 'web', name: (a.name || 'App').slice(0, 30), url: a.url || '', icon: a.icon || null,
      color: a.color || hashColor(a.name || a.url || 'x'), theme: a.theme || null, bg: a.bg || null, added: Date.now() };
    apps.push(app); save(); render();
    HR.toast('Added “' + app.name + '” to Home');
    return app;
  }

  function appSheet({ title, app, actionsTop, primary, onSave, footer }) {
    const wrap = document.createElement('div'); wrap.className = 'asheet';
    const draft = { ...app };
    wrap.innerHTML = `<div class="aprev"></div>
      <label class="field"><span>Name on Home screen</span><input type="text" id="appNameInput" maxlength="30"></label>
      <div class="field"><span>Icon colour</span><div class="swatches"></div></div>
      ${app.url ? `<p class="addr-note">${esc(app.url)}</p>` : ''}
      <div class="aacts"></div>`;
    const prev = wrap.querySelector('.aprev');
    const paint = () => { prev.innerHTML = ''; prev.append(iconEl(draft, 64)); const s = document.createElement('span'); s.textContent = draft.name || ' '; prev.append(s); };
    const input = wrap.querySelector('input'); input.value = draft.name || '';
    input.oninput = () => { draft.name = input.value; paint(); };
    const sw = wrap.querySelector('.swatches');
    COLORS.forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.title = c;
      b.setAttribute('aria-pressed', String(c === draft.color));
      b.onclick = () => { draft.color = c; sw.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); paint(); };
      sw.append(b);
    });
    if (draft.icon) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'noimg'; b.textContent = 'Letter icon';
      b.onclick = () => { draft.icon = null; b.remove(); paint(); };
      sw.append(b);
    }
    const acts = wrap.querySelector('.aacts');
    (actionsTop || []).forEach((a) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (a.danger ? ' danger' : '');
      b.textContent = a.label;
      b.onclick = () => a.onClick(b, close);
      acts.append(b);
    });
    if (!acts.children.length) acts.remove();
    if (footer) wrap.append(footer);
    paint();
    const close = HR.sheet({ title, body: wrap, actions: [{ label: 'Cancel' }, { label: primary, primary: true, onClick: () => {
      draft.name = (draft.name || '').trim() || 'App'; onSave(draft);
    } }] });
    return { draft, paint, wrap, close };
  }

  function editApp(id) {
    const app = byId(id); if (!app) return;
    const top = [];
    if (running.has(id)) top.push({ label: 'Close app', onClick: (b, close) => { close(); closeApp(id); } });
    top.push({ label: 'Move left', onClick: (b) => { const k = apps.indexOf(app); if (k > 0) { apps.splice(k, 1); apps.splice(k - 1, 0, app); save(); render(); HR.toast('Moved'); } } });
    top.push({ label: 'Move right', onClick: (b) => { const k = apps.indexOf(app); if (k < apps.length - 1) { apps.splice(k, 1); apps.splice(k + 1, 0, app); save(); render(); HR.toast('Moved'); } } });
    if (app.kind === 'code') {
      top.push({ label: 'Update with my current code', onClick: (b, close) => { snapshot(app.id); if (running.has(id)) closeApp(id, true); close(); HR.toast('Updated “' + app.name + '”'); render(); } });
      top.push({ label: 'Edit in Code', onClick: (b, close) => { close(); HR.showCode('html'); } });
    } else {
      top.push({ label: 'Open in Browser', onClick: (b, close) => { close(); HR.openInBrowser(app.url); } });
      top.push({ label: 'Open in Chrome', onClick: (b, close) => { close(); HR.openInChrome(app.url); } });
    }
    top.push({ label: 'Remove from Home', danger: true, onClick: (b, close) => { close(); setTimeout(() => removeApp(id), 0); } });
    const blankTip = document.createElement('p'); blankTip.className = 'hint';
    blankTip.textContent = app.kind === 'code' ? 'Opens your saved code as an app. Firebase and logins work when HTML Runner is hosted on a website.'
      : 'App stays blank? That site refuses to be shown inside other apps. Use Open in Chrome for it, or Open full screen.';
    appSheet({ title: app.name, app, actionsTop: top, primary: 'Save', footer: blankTip, onSave: (d) => {
      Object.assign(app, { name: d.name, color: d.color, icon: d.icon }); save(); render();
      PHONE.refresh();
    } });
  }

  /* ---------------- install a web page ---------------- */
  async function withTimeout(p, ms) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]); }
  function testImage(src) {
    return new Promise((res) => {
      const img = new Image(); img.referrerPolicy = 'no-referrer';
      const t = setTimeout(() => res(false), 4000);
      img.onload = () => { clearTimeout(t); res(img.naturalWidth >= 16 ? src : false); };
      img.onerror = () => { clearTimeout(t); res(false); };
      img.src = src;
    });
  }
  function pickIcon(icons, base) {
    if (!icons || !icons.length) return null;
    const size = (s) => Math.max(...String(s.sizes || '0').split(/\s+/).map((x) => parseInt(x, 10) || (x === 'any' ? 512 : 0)));
    const any = icons.filter((i) => !/maskable|monochrome/.test(i.purpose || '') || /any/.test(i.purpose || ''));
    const best = (any.length ? any : icons).slice().sort((a, b) => size(b) - size(a))[0];
    try { return new URL(best.src, base).href; } catch (e) { return null; }
  }
  async function readDoc(doc, baseUrl) {
    const out = { title: doc.title || '' };
    const theme = doc.querySelector('meta[name="theme-color"]'); if (theme) out.theme = theme.content;
    const appName = doc.querySelector('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]'); if (appName) out.title = appName.content || out.title;
    const touch = doc.querySelector('link[rel~="apple-touch-icon"]'); if (touch) out.icons = [new URL(touch.getAttribute('href'), baseUrl).href];
    const ico = [...doc.querySelectorAll('link[rel~="icon"]')].map((l) => new URL(l.getAttribute('href'), baseUrl).href);
    out.icons = (out.icons || []).concat(ico);
    const m = doc.querySelector('link[rel="manifest"]');
    if (m) {
      const murl = new URL(m.getAttribute('href'), baseUrl).href;
      try {
        const man = await withTimeout(fetch(murl).then((r) => r.json()), 5000);
        out.manifest = true;
        out.title = man.short_name || man.name || out.title;
        out.theme = man.theme_color || out.theme; out.bg = man.background_color;
        if (man.start_url) out.start = new URL(man.start_url, murl).href;
        const best = pickIcon(man.icons, murl); if (best) out.icons.unshift(best);
      } catch (e) { /* manifest not readable from here */ }
    }
    return out;
  }
  async function discover(url, title, frame) {
    let info = { title: title || '', icons: [] };
    // 1. same-site page (e.g. your preview) can be read directly
    try { const d = frame && frame.contentDocument; if (d && d.documentElement) info = { ...info, ...(await readDoc(d, frame.contentWindow.location.href)) }; } catch (e) {}
    // 2. sites that allow it can be fetched
    // (through your page server when it's on: it can read sites that don't allow this)
    if (!info.manifest) {
      const via = HR.proxy.wrap(url);
      const real = (u) => (u && HR.proxy.unwrap(u)) || u;
      try {
        const html = await withTimeout(fetch(via, { credentials: 'omit' }).then((r) => (r.ok ? r.text() : Promise.reject())), 8000);
        const d = new DOMParser().parseFromString(html, 'text/html');
        const got = await readDoc(d, via);
        got.icons = got.icons.map(real); if (got.start) got.start = real(got.start);
        info = { ...info, ...got, title: got.title || info.title, icons: got.icons.concat(info.icons) };
      } catch (e) {}
    }
    // 3. common icon locations, then a favicon service
    let origin = ''; try { origin = new URL(url).origin; } catch (e) {}
    if (origin.startsWith('http')) info.icons.push(origin + '/apple-touch-icon.png', faviconFor(url));
    for (const src of info.icons) { const ok = await testImage(src); if (ok) { info.icon = ok; break; } }
    return info;
  }

  function addToHome(url, title, frame) {
    if (!url) return HR.toast('Open a web page first, then tap Add');
    const isPreview = url.startsWith('blob:') || url.includes('/preview/index.html');
    if (isPreview) return addCodeToHome();
    const a = apps.find((x) => x.kind === 'web' && sameUrl(x.url) === sameUrl(url));
    if (a) {
      return HR.sheet({ title: 'Already on Home', body: `<p>“${esc(a.name)}” is already on your Home screen.</p>`, actions: [
        { label: 'Close' }, { label: 'Open it', primary: true, onClick: () => openApp(a.id) }] });
    }
    const draft0 = { kind: 'web', url, name: (title || host(url)).replace(/\s+[-–|·:].*$/, '').slice(0, 30) || host(url), color: hashColor(host(url)), icon: null };
    const status = document.createElement('p'); status.className = 'hint'; status.textContent = 'Looking for the site’s app icon…';
    const s = appSheet({ title: 'Add to Home screen', app: draft0, primary: 'Add', footer: status, onSave: (d) => {
      addApp({ ...d, url: d.start || url });
    } });
    discover(url, title, frame).then((info) => {
      const nameTouched = s.wrap.querySelector('input').value !== draft0.name;
      if (info.icon) s.draft.icon = info.icon;
      if (info.theme) { s.draft.theme = info.theme; if (/^#[0-9a-f]{6}$/i.test(info.theme)) s.draft.color = info.theme; }
      if (info.bg) s.draft.bg = info.bg;
      if (info.start) s.draft.start = info.start;
      if (info.title && !nameTouched) { s.draft.name = info.title.slice(0, 30); s.wrap.querySelector('input').value = s.draft.name; }
      s.paint();
      status.textContent = info.manifest ? 'This site is a web app. It will open full screen with its own name and icon.' : 'It will open full screen from your Home screen. If it stays blank, the site refuses to run inside other apps.';
    });
  }

  function snapshot(id) {
    const html = HR.buildPage({ inline: true, withBridge: false });
    if (!store.set('hr:appcode:' + id, html)) { HR.toast('Not enough space on this phone to save the app'); return false; }
    return true;
  }
  function addCodeToHome() {
    const name = HR.projectName && HR.projectName() !== 'Untitled project' ? HR.projectName() : 'My app';
    appSheet({ title: 'Add your code to Home', app: { kind: 'code', name, color: '#ffb547' }, primary: 'Add',
      footer: Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Saves a copy of your current code as an app. Later changes don’t affect it until you choose “Update with my current code” on its icon.' }),
      onSave: (d) => {
        const app = addApp({ ...d, kind: 'code' });
        if (!snapshot(app.id)) { apps = apps.filter((a) => a.id !== app.id); save(); render(); }
      } });
  }

  /* ---------------- search bar ---------------- */
  $('hSearch').onsubmit = (e) => {
    e.preventDefault();
    const q = $('hSearchInput').value.trim(); if (!q) return;
    $('hSearchInput').value = ''; $('hSearchInput').blur();
    HR.openInBrowser(q);
  };
  $('hAskAI').onclick = () => {
    const q = $('hSearchInput').value.trim();
    HR.showView('ai');
    if (q) { $('prompt').value = q; $('hSearchInput').value = ''; $('prompt').dispatchEvent(new Event('input')); }
    setTimeout(() => $('prompt').focus(), 320);
  };

  /* ---------------- Code and AI windows ---------------- */
  PHONE.register('code', {
    el: $('view-code'), name: () => 'Code', icon: (s) => builtinIcon('code', s), bar: () => '#121722',
    back: () => {
      if (!$('menu').hidden) { $('menu').hidden = true; return true; }
      if ($('split').dataset.pane === 'preview') { document.querySelector('#paneSwitch [data-pane="editor"]').click(); return true; }
      return false;
    },
  });
  PHONE.register('ai', {
    el: $('view-ai'), name: () => 'AI', icon: (s) => builtinIcon('ai', s), bar: () => '#121722',
    back: () => { if ($('aiSide').classList.contains('open')) { $('aiSide').classList.remove('open'); return true; } return false; },
  });

  PHONE.onChange(() => {
    // green dot under apps that are open
    document.querySelectorAll('[data-launch]').forEach((b) => b.classList.toggle('running', PHONE.isOpen(b.dataset.launch)));
    $('sbProxy').hidden = !HR.proxy.active();
  });
  // page server turned on or off: website apps restart the next time they're opened
  HR.proxy.onChange(() => { [...running.keys()].forEach((id) => { const a = byId(id); if (a && a.kind === 'web' && PHONE.current() !== 'app:' + id) closeApp(id, true); }); PHONE.refresh(); });

  Object.assign(HR, {
    addToHome, addCodeToHome, goHome, openApp, builtinIcon,
    home: {
      walls: WALLS, prefs: () => ({ ...prefs }),
      setPrefs: (p) => { prefs = { ...prefs, ...p }; savePrefs(); render(); },
      count: () => apps.length,
    },
  });

  /* ---------------- start ---------------- */
  render();
  const want = new URLSearchParams(location.search).get('view');
  if (want && want !== 'home') HR.showView(want);
  PHONE.refresh();
})();
