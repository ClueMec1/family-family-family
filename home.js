/* HTML Runner — Home screen: installed web apps that open full screen inside HTML Runner. */
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
    ember: { name: 'Ember', css: 'radial-gradient(120% 70% at 85% 0%,#5a2a12 0%,transparent 60%),radial-gradient(90% 60% at 0% 100%,#3a1f3a 0%,transparent 65%),#120d0c' },
    sea: { name: 'Deep sea', css: 'radial-gradient(110% 70% at 10% 0%,#0f4a55 0%,transparent 60%),radial-gradient(90% 60% at 100% 100%,#12305e 0%,transparent 65%),#070d16' },
    dusk: { name: 'Dusk', css: 'linear-gradient(170deg,#2b1840 0%,#5b2a4a 45%,#b8573a 100%)' },
    moss: { name: 'Moss', css: 'radial-gradient(100% 70% at 80% 10%,#2f4a2a 0%,transparent 60%),radial-gradient(90% 60% at 0% 90%,#1d3a36 0%,transparent 65%),#0b110d' },
    graphite: { name: 'Graphite', css: '#0c0f15' },
  };
  const MAX_RUNNING = 5;

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
  function sameUrl(u) { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/+$/, '') + x.search; } catch (e) { return u; } }
  const rawApps = store.get('hr:apps', []);
  let apps = cleanApps(rawApps);
  if (!Array.isArray(rawApps) || apps.length !== rawApps.length) store.set('hr:apps', apps);
  let prefs = store.get('hr:homeprefs', { wall: 'ember' });
  const running = new Map(); // id -> { frame, last }
  let openId = null;
  const save = () => store.set('hr:apps', apps);
  const savePrefs = () => store.set('hr:homeprefs', prefs);
  const byId = (id) => apps.find((a) => a.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function hashColor(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % 8]; }
  function inkFor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14161c' : '#fff';
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }

  /* ---------------- clock ---------------- */
  function tick() {
    const d = new Date();
    $('hTime').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    $('hDate').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tick(); setInterval(tick, 15000);

  /* ---------------- icons ---------------- */
  function iconEl(app, size) {
    const i = document.createElement('i');
    i.className = 'ico';
    if (size) i.style.setProperty('--s', size + 'px');
    i.style.background = app.color || hashColor(app.name);
    i.style.color = inkFor(app.color || hashColor(app.name));
    const letter = () => {
      i.textContent = '';
      if (app.kind === 'code') i.innerHTML = '<b class="code">&lt;/&gt;</b>';
      else i.innerHTML = `<b>${esc((app.name || '?').trim().charAt(0).toUpperCase())}</b>`;
    };
    if (app.icon) {
      const img = new Image();
      img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.onerror = letter;
      img.src = app.icon;
      i.append(img);
    } else letter();
    return i;
  }

  /* ---------------- grid ---------------- */
  function render() {
    const grid = $('appGrid'); grid.innerHTML = '';
    $('home').style.setProperty('--wall', (WALLS[prefs.wall] || WALLS.ember).css);
    if (!apps.length) {
      const e = document.createElement('div'); e.className = 'gempty';
      e.innerHTML = '<b>No apps yet</b><span>Open a site in Browser and tap <em>Add</em> to put it here. Your own code can become an app too: Code → ⋯ → Add to Home screen.</span>';
      grid.append(e);
    }
    apps.forEach((app) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'app'; b.setAttribute('role', 'listitem');
      b.dataset.id = app.id;
      b.append(iconEl(app));
      const l = document.createElement('span'); l.textContent = app.name; b.append(l);
      if (running.has(app.id)) b.classList.add('running');
      bindPress(b, () => openApp(app.id), () => editApp(app.id));
      grid.append(b);
    });
  }
  const faviconFor = (url) => 'https://www.google.com/s2/favicons?sz=128&domain_url=' + encodeURIComponent(new URL(url).origin);

  function bindPress(el, onTap, onLong) {
    let t = null, longed = false, sx = 0, sy = 0;
    el.addEventListener('pointerdown', (e) => {
      longed = false; sx = e.clientX; sy = e.clientY;
      t = setTimeout(() => { longed = true; el.classList.add('pressed'); if (navigator.vibrate) navigator.vibrate(12); onLong(); setTimeout(() => el.classList.remove('pressed'), 200); }, 480);
    });
    el.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(t); t = null; } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => { clearTimeout(t); t = null; }));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!longed) { longed = true; onLong(); } });
    el.addEventListener('click', (e) => { if (longed) { e.preventDefault(); longed = false; return; } onTap(); });
  }

  /* ---------------- running apps ---------------- */
  const CODE_BASE = () => new URL('apps/', location.href).href;
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

  async function launch(app) {
    const f = document.createElement('iframe');
    f.title = app.name;
    f.setAttribute('allow', 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; web-share; payment; display-capture');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    if (app.kind === 'code') { const t = await codeUrl(app); if (t.src) f.src = t.src; else f.srcdoc = t.srcdoc; }
    else f.src = app.url;
    f.hidden = true;
    $('appStage').append(f);
    running.set(app.id, { frame: f, last: Date.now() });
    // keep memory in check: close the app used longest ago
    if (running.size > MAX_RUNNING) {
      const oldest = [...running.entries()].filter(([id]) => id !== app.id).sort((a, b) => a[1].last - b[1].last)[0];
      if (oldest) closeApp(oldest[0], true);
    }
    return f;
  }

  async function openApp(id) {
    const app = byId(id); if (!app) return;
    HR.showView('home');
    const fresh = !running.has(id);
    const r = running.get(id);
    if (r) r.last = Date.now();
    openId = id;
    // app bar takes the app's own colour, like an installed app's title bar
    const bar = app.theme || app.color || '#121722';
    $('appBar').style.background = bar; $('appBar').style.color = inkFor(bar);
    $('appTitle').textContent = app.name;
    $('appWin').hidden = false; $('home').hidden = true;
    if (fresh) {
      const sp = $('appSplash');
      sp.style.background = app.bg || bar; sp.style.color = inkFor(app.bg || bar);
      $('splashIcon').replaceWith(Object.assign(iconEl(app, 84), { id: 'splashIcon' }));
      $('splashName').textContent = app.name;
      sp.hidden = false;
      const f = await launch(app);
      const hide = () => { sp.hidden = true; };
      f.addEventListener('load', () => setTimeout(hide, 250), { once: true });
      setTimeout(hide, 2500);
    }
    running.forEach((x, k) => (x.frame.hidden = k !== id));
    app.used = Date.now(); save();
    render();
  }

  function goHome() {
    if (openId && running.has(openId)) running.get(openId).frame.hidden = true;
    openId = null;
    $('appWin').hidden = true; $('home').hidden = false;
    $('appSplash').hidden = true;
    render();
  }
  function closeApp(id, quiet) {
    const r = running.get(id); if (!r) return;
    r.frame.remove(); running.delete(id);
    if (openId === id) goHome();
    if (!quiet) { HR.toast('Closed ' + (byId(id) || {}).name); render(); }
  }

  $('appHome').onclick = goHome;
  $('appReload').onclick = async () => {
    const app = byId(openId); if (!app) return;
    closeApp(app.id, true); await openApp(app.id);
  };
  $('appMore').onclick = () => { if (openId) editApp(openId); };

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
      top.push({ label: 'Edit in Code', onClick: (b, close) => { close(); goHome(); HR.showCode('html'); } });
    } else {
      top.push({ label: 'Open in Browser', onClick: (b, close) => { close(); goHome(); HR.openInBrowser(app.url); } });
      top.push({ label: 'Open in Chrome', onClick: (b, close) => { close(); HR.openInChrome(app.url); } });
    }
    let armed = false;
    top.push({ label: 'Remove from Home', danger: true, onClick: (b, close) => {
      if (!armed) { armed = true; b.textContent = 'Tap again to remove'; return; }
      close(); closeApp(id, true);
      apps = apps.filter((a) => a.id !== id); save(); store.del('hr:appcode:' + id);
      if ('caches' in window) caches.open('hr-apps').then((c) => c.delete(CODE_BASE() + id + '/index.html')).catch(() => {});
      render(); HR.toast('Removed “' + app.name + '”');
    } });
    const blankTip = document.createElement('p'); blankTip.className = 'hint';
    blankTip.textContent = app.kind === 'code' ? 'Opens your saved code as an app. Firebase and logins work when HTML Runner is hosted on a website.'
      : 'App stays blank? That site refuses to be shown inside other apps. Use Open in Chrome for it.';
    appSheet({ title: app.name, app, actionsTop: top, primary: 'Save', footer: blankTip, onSave: (d) => {
      Object.assign(app, { name: d.name, color: d.color, icon: d.icon }); save(); render();
      if (openId === id) { $('appTitle').textContent = app.name; }
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
    if (!info.manifest) {
      try {
        const html = await withTimeout(fetch(url, { credentials: 'omit' }).then((r) => (r.ok ? r.text() : Promise.reject())), 5000);
        const d = new DOMParser().parseFromString(html, 'text/html');
        const got = await readDoc(d, url);
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

  /* ---------------- search + settings ---------------- */
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
    $('prompt').focus();
  };
  $('hSettings').onclick = () => {
    const wrap = document.createElement('div'); wrap.className = 'asheet';
    wrap.innerHTML = '<div class="field"><span>Wallpaper</span><div class="walls"></div></div>';
    const w = wrap.querySelector('.walls');
    Object.entries(WALLS).forEach(([k, v]) => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = v.css; b.setAttribute('aria-pressed', String(prefs.wall === k));
      b.innerHTML = `<span>${esc(v.name)}</span>`;
      b.onclick = () => { prefs.wall = k; savePrefs(); render(); w.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); };
      w.append(b);
    });
    const acts = [{ label: 'Done', primary: true }];
    acts.unshift({ label: 'Install check', onClick: () => { HR.installCheck(); } });
    HR.sheet({ title: 'Home screen', body: wrap, actions: acts });
  };

  HR.onView((name) => { if (name !== 'home' && openId && running.has(openId)) running.get(openId).frame.hidden = true; else if (name === 'home' && openId && running.has(openId)) running.get(openId).frame.hidden = false; });
  Object.assign(HR, { addToHome, addCodeToHome, goHome, openApp });

  render();
})();
