/* HTML Runner — Browser app.
   Tabs, address bar, loading bar, bookmarks, history, a new-tab page, and Back that follows links
   tapped inside pages (it uses the phone's own history, the same way Chrome does). */
(function () {
  'use strict';
  const HR = window.HR;
  const $ = (id) => document.getElementById(id);
  const { store, esc, toast, sheet, ask, proxy } = HR;
  const win = $('view-browser');

  /* ---------------- saved things ---------------- */
  const DEFAULT_MARKS = [
    { title: 'Wikipedia', url: 'https://en.m.wikipedia.org/' },
    { title: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
    { title: 'Can I use', url: 'https://caniuse.com/' },
  ];
  let marks = store.get('hr:marks', DEFAULT_MARKS);
  let hist = store.get('hr:history', []);
  const saveMarks = () => store.set('hr:marks', marks);
  const saveHist = () => store.set('hr:history', hist);
  const START = 'hr:start';
  const ENGINES = {
    ddg: { name: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/?q=' },
    ddglite: { name: 'DuckDuckGo Lite', url: 'https://lite.duckduckgo.com/lite/?q=' },
    wiki: { name: 'Wikipedia', url: 'https://en.m.wikipedia.org/w/index.php?search=' },
  };
  const engine = () => ENGINES[store.get('hr:bsearch', 'ddg')] || ENGINES.ddg;
  const homeUrl = () => store.get('hr:bhome', START);

  /* ---------------- addresses ---------------- */
  function toUrl(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    if (s === START) return START;
    if (/^(https?|blob|data):/i.test(s)) return s;
    if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([\/?#].*)?$/i.test(s)) return 'http://' + s;
    if (!/\s/.test(s) && /^[^\s\/]+\.[a-z]{2,}(:\d+)?([\/?#].*)?$/i.test(s)) return 'https://' + s;
    return engine().url + encodeURIComponent(s);
  }
  const isPreview = (u) => !!u && (u.startsWith('blob:') || u.includes('/preview/index.html'));
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\.|^m\./, ''); } catch (e) { return ''; } }
  function label(t) {
    if (!t.url || t.url === START) return 'New tab';
    if (isPreview(t.url)) return 'Your preview';
    return t.title || hostOf(t.url) || t.url;
  }
  function shortUrl(u) {
    if (!u || u === START) return '';
    if (isPreview(u)) return 'Your code preview';
    try { const x = new URL(u); return (x.host.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname) + x.search).slice(0, 200); } catch (e) { return u; }
  }
  function letterIcon(text, size) {
    const i = document.createElement('i'); i.className = 'fav';
    if (size) i.style.setProperty('--s', size + 'px');
    const s = (text || '?').replace(/^www\./, '').trim();
    let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    i.style.background = ['#3b6fe0', '#c2563a', '#2f9e6e', '#8a5cd6', '#c99a1d', '#2a93a8', '#c9467d'][h % 7];
    i.textContent = s.charAt(0).toUpperCase();
    return i;
  }

  /* ---------------- tabs ---------------- */
  let tabs = [], active = null, seq = 0;
  // Every link tapped inside a page adds an entry to the phone's own history. jstack remembers whose
  // entry is on top, so Back can step through them like Chrome does.
  let jstack = [];

  function newTab(url, focus = true, opener = null) {
    const t = { id: ++seq, url: '', title: '', hist: [], idx: -1, el: null, loading: false, skip: 0, initial: true, opener, force: false };
    t.el = document.createElement('div'); t.el.className = 'bpage';
    $('bstage').append(t.el);
    tabs.push(t);
    if (url) navigate(t, url); else { t.hist = [START]; t.idx = 0; load(t, START); }
    if (focus) select(t); else { t.el.hidden = true; }
    renderTabs(); saveTabs();
    return t;
  }
  function select(t) {
    active = t;
    tabs.forEach((x) => (x.el.hidden = x !== t));
    paint();
  }
  function closeTab(t) {
    const i = tabs.indexOf(t); if (i < 0) return;
    tabs.splice(i, 1); t.el.remove();
    jstack = jstack.filter((id) => id !== t.id);
    if (!tabs.length) newTab();
    else if (t === active) select(tabs.find((x) => x === t.opener) || tabs[Math.max(0, i - 1)]);
    renderTabs(); saveTabs();
  }
  function saveTabs() { store.set('hr:tabs', tabs.filter((t) => t.url && t.url !== START && !t.url.startsWith('blob:')).map((t) => t.url)); }
  function ensureTab() {
    if (tabs.length) return;
    const saved = store.get('hr:tabs', []);
    if (saved.length) saved.forEach((u, i) => newTab(u, i === saved.length - 1));
    else newTab();
  }

  /* ---------------- loading a page into a tab ---------------- */
  function frameFor(t, src) {
    const f = document.createElement('iframe');
    f.className = 'bpage';
    f.title = 'Web page';
    f.setAttribute('allow', 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; web-share; payment; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.addEventListener('load', () => onFrameLoad(t, f));
    f.src = src;
    return f;
  }
  function load(t, url) {
    t.url = url; t.title = ''; t.fresh = true; t.initial = true; t.skip = 0;
    jstack = jstack.filter((id) => id !== t.id); // the old frame's entries go with it
    let el;
    if (url === START) { el = startPage(t); setLoading(t, false); }
    else {
      const rule = t.force ? null : HR.siteRule(url);
      t.force = false;
      if (rule && rule.blocked) {
        el = HR.blockedCard(url, rule, {
          onVideo: (v) => navigate(t, v),
          onTry: () => { t.force = true; load(t, url); },
        });
        el.classList.add('bpage');
        t.title = rule.name;
        setLoading(t, false);
      } else {
        if (rule && rule.embed) t.title = rule.title;
        el = frameFor(t, rule && rule.embed ? rule.embed : proxy.wrap(url));
        setLoading(t, true);
      }
      addHistory(url, t.title);
    }
    el.hidden = t !== active;
    t.el.replaceWith(el); t.el = el;
    paint(); renderTabs(); saveTabs();
  }
  function navigate(t, input) {
    const url = toUrl(input); if (!url) return;
    t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1;
    load(t, url);
  }
  function onFrameLoad(t, f) {
    if (t.el !== f) return;
    setLoading(t, false);
    if (t.initial) t.initial = false;               // the page we asked for
    else if (t.skip > 0) t.skip--;                   // Back / Refresh we started
    else { jstack.push(t.id); t.fresh = false; }      // a link tapped inside the page
    try { const d = f.contentDocument; if (d && d.title) { t.title = d.title; renderTabs(); } } catch (e) {}
    if (t === active) paint();
  }

  /* ---------------- loading bar ---------------- */
  let progT = null;
  function setLoading(t, on) {
    t.loading = on;
    clearTimeout(t.loadTimer);
    if (on) t.loadTimer = setTimeout(() => setLoading(t, false), 20000);
    if (t === active) drawProgress();
  }
  function drawProgress() {
    const bar = $('bProg');
    clearTimeout(progT);
    if (active && active.loading) {
      if (!bar.classList.contains('run')) { bar.className = 'bprog'; void bar.offsetWidth; bar.className = 'bprog run'; }
    } else if (bar.classList.contains('run')) {
      bar.className = 'bprog done'; progT = setTimeout(() => (bar.className = 'bprog'), 600);
    }
  }

  /* ---------------- Back / Forward / Refresh ---------------- */
  function back(fromSystem) {
    if (!active) return false;
    if (closePanels()) return true;
    const t = active;
    // 1. links tapped inside this page: let the phone's history step back (not when the phone's own Back sent us here)
    if (!fromSystem && jstack.length && jstack[jstack.length - 1] === t.id) {
      jstack.pop(); t.skip++; setLoading(t, true);
      setTimeout(() => { if (t.skip > 0) t.skip = 0; }, 3000);
      history.back();
      return true;
    }
    // 2. pages opened from the address bar
    if (t.idx > 0) { t.idx--; load(t, t.hist[t.idx]); return true; }
    // 3. a tab opened from another tab closes and returns to it, like Chrome
    if (t.opener && tabs.includes(t.opener)) { closeTab(t); return true; }
    return false;
  }
  function forward() {
    const t = active; if (!t || t.idx >= t.hist.length - 1) return toast('Nothing to go forward to');
    t.idx++; load(t, t.hist[t.idx]);
  }
  function reload() {
    const t = active; if (!t) return;
    if (t.el.tagName !== 'IFRAME') return load(t, t.url);
    t.skip++; setLoading(t, true);
    try { t.el.contentWindow.location.reload(); }
    catch (e) { t.el.src = t.el.src; } // the same address again reloads without a new history entry
  }

  /* ---------------- painting the bar ---------------- */
  function paint() {
    const t = active; if (!t) return;
    const inp = $('addrInput');
    if (document.activeElement !== inp) inp.value = shortUrl(t.url);
    const secure = /^https:/.test(t.url);
    $('bLock').classList.toggle('show', !!t.url && t.url !== START);
    $('bLock').classList.toggle('insecure', !!t.url && t.url !== START && !secure && !isPreview(t.url));
    $('bTabCount').textContent = tabs.length > 99 ? ':D' : String(tabs.length);
    $('bmStar').classList.toggle('on', !!t.url && marks.some((m) => m.url === t.url));
    $('bmFwd').disabled = t.idx >= t.hist.length - 1;
    $('bmProxyState').textContent = proxy.active() ? 'On' : 'Off';
    drawProgress();
  }
  $('addrInput').addEventListener('focus', function () {
    if (active && active.url && active.url !== START && !isPreview(active.url)) this.value = active.url;
    win.classList.add('typing');
    setTimeout(() => this.select(), 0);
  });
  $('addrInput').addEventListener('blur', () => { win.classList.remove('typing'); setTimeout(paint, 100); });
  $('addrForm').onsubmit = (e) => {
    e.preventDefault();
    const v = $('addrInput').value;
    if (!active) newTab();
    navigate(active, v);
    $('addrInput').blur();
  };

  /* ---------------- new tab page ---------------- */
  function startPage(t) {
    const div = document.createElement('div'); div.className = 'bpage ntp';
    div.innerHTML = `<div class="ntp-in">
      <div class="ntp-logo"><span>HTML</span> Runner</div>
      <form class="ntp-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input type="text" placeholder="Search ${esc(engine().name)} or type a web address" enterkeyhint="go" autocomplete="off" spellcheck="false" autocapitalize="off"></form>
      <div class="ntp-tiles"></div>
      <div class="ntp-recent"></div>
    </div>`;
    div.querySelector('form').onsubmit = (e) => { e.preventDefault(); navigate(t, div.querySelector('input').value); };
    const tiles = div.querySelector('.ntp-tiles');
    const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'tile';
    prev.innerHTML = '<i class="fav code">&lt;/&gt;</i><span>Your preview</span>';
    prev.onclick = async () => navigate(t, await HR.previewLink());
    tiles.append(prev);
    marks.slice(0, 7).forEach((m) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tile';
      b.append(letterIcon(m.title || hostOf(m.url)));
      const s = document.createElement('span'); s.textContent = m.title || hostOf(m.url); b.append(s);
      b.onclick = () => navigate(t, m.url);
      tiles.append(b);
    });
    const recent = div.querySelector('.ntp-recent');
    const seen = new Set(), rec = [];
    for (const h of hist) { const k = hostOf(h.url); if (!seen.has(k)) { seen.add(k); rec.push(h); } if (rec.length >= 4) break; }
    if (rec.length) {
      recent.innerHTML = '<h3>Recently visited</h3>';
      rec.forEach((h) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'lrow';
        b.append(letterIcon(hostOf(h.url), 32));
        const tx = document.createElement('span'); tx.className = 'tx';
        tx.innerHTML = `<b></b><small></small>`; tx.querySelector('b').textContent = h.title || hostOf(h.url); tx.querySelector('small').textContent = shortUrl(h.url);
        b.append(tx); b.onclick = () => navigate(t, h.url);
        recent.append(b);
      });
    }
    return div;
  }

  /* ---------------- history ---------------- */
  function addHistory(url, title) {
    if (!/^https?:/.test(url)) return;
    if (hist[0] && hist[0].url === url) { if (title) hist[0].title = title; saveHist(); return; }
    hist.unshift({ url, title: title || '', time: Date.now() });
    if (hist.length > 400) hist.length = 400;
    saveHist();
  }

  /* ---------------- pages loaded through the page server report where they are ---------------- */
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.__hrProxy !== 1 || typeof m.url !== 'string') return;
    const t = tabs.find((x) => x.el && x.el.contentWindow === e.source);
    if (!t) return;
    if (m.title) { t.title = String(m.title).slice(0, 200); if (hist[0] && hist[0].url === t.url) { hist[0].title = t.title; saveHist(); } }
    if (/^https?:/.test(m.url) && m.url !== t.url) {
      if (t.fresh) t.hist[t.idx] = m.url;
      else { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(m.url); t.idx = t.hist.length - 1; }
      t.url = m.url; addHistory(m.url, t.title); saveTabs();
    }
    t.fresh = false;
    if (t === active) paint();
    renderTabs();
  });

  /* ---------------- panels: menu, tabs, library ---------------- */
  let unOverlay = null;
  function openPanel(id) {
    closePanels();
    $(id).hidden = false;
    unOverlay = PHONE.overlay(() => { $(id).hidden = true; unOverlay = null; });
  }
  function closePanels() {
    let any = false;
    ['bMenuPanel', 'bTabsPanel', 'bLibrary'].forEach((id) => { if (!$(id).hidden) { $(id).hidden = true; any = true; } });
    if (unOverlay) { unOverlay(); unOverlay = null; }
    return any;
  }
  $('bMenu').onclick = (e) => { e.stopPropagation(); if (!$('bMenuPanel').hidden) closePanels(); else { paint(); openPanel('bMenuPanel'); } };
  win.addEventListener('click', (e) => {
    if (!$('bMenuPanel').hidden && !$('bMenuPanel').contains(e.target) && !e.target.closest('#bMenu')) closePanels();
  });
  $('bHome').onclick = () => { if (!active) newTab(); navigate(active, homeUrl()); };
  $('bmFwd').onclick = () => { closePanels(); forward(); };
  $('bmReload').onclick = () => { closePanels(); reload(); };
  $('bmChrome').onclick = () => { closePanels(); if (!active || !active.url || active.url === START) return toast('Open a web page first'); HR.openInChrome(active.url); };
  $('bmStar').onclick = async () => {
    closePanels();
    const t = active;
    if (!t || !t.url || t.url === START || t.url.startsWith('blob:')) return toast('Open a web page first');
    const i = marks.findIndex((m) => m.url === t.url);
    if (i >= 0) { marks.splice(i, 1); saveMarks(); toast('Bookmark removed'); }
    else {
      const n = await ask('Add bookmark', 'Name', t.title || hostOf(t.url)); if (!n) return;
      marks.unshift({ title: n, url: t.url }); saveMarks(); toast('Bookmarked');
    }
    paint();
  };
  $('bMenuPanel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const m = b.dataset.m, t = active;
    closePanels();
    if (m === 'newtab') { newTab(); setTimeout(() => $('addrInput').focus(), 50); }
    else if (m === 'bookmarks' || m === 'history') showLibrary(m);
    else if (m === 'add') { if (!t || !t.url || t.url === START) return toast('Open a web page first'); HR.addToHome(t.url, t.title, t.el); }
    else if (m === 'full') { if (!t || !t.url || t.url === START) return toast('Open a web page first'); HR.openFullScreen(t.url); }
    else if (m === 'sethome') { if (!t || !t.url || t.url === START) return toast('Open a web page first'); store.set('hr:bhome', t.url); toast('Home page set to ' + hostOf(t.url)); }
    else if (m === 'proxy') HR.proxySheet();
    else if (m === 'settings') HR.openSettings && HR.openSettings('browser');
  });

  // tabs overview
  function renderTabs() {
    $('bTabCount').textContent = String(tabs.length);
    const g = $('tgrid'); if ($('bTabsPanel').hidden) return;
    g.innerHTML = '';
    tabs.forEach((t) => {
      const c = document.createElement('div'); c.className = 'tcard' + (t === active ? ' on' : '');
      c.innerHTML = `<div class="tc-head"><span></span><button type="button" class="tc-x" aria-label="Close tab"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="tc-body"></div>`;
      c.querySelector('.tc-head').prepend(letterIcon(t.url === START ? '+' : hostOf(t.url) || '?', 18));
      c.querySelector('.tc-head span').textContent = label(t);
      const body = c.querySelector('.tc-body');
      body.append(letterIcon(t.url === START ? 'N' : hostOf(t.url) || '?', 52));
      const u = document.createElement('small'); u.textContent = t.url === START ? 'New tab' : shortUrl(t.url); body.append(u);
      c.onclick = (e) => { if (e.target.closest('.tc-x')) { closeTab(t); renderTabs(); return; } select(t); closePanels(); };
      g.append(c);
    });
  }
  $('bTabs').onclick = () => { if (!$('bTabsPanel').hidden) return closePanels(); openPanel('bTabsPanel'); renderTabs(); };
  $('bNewTab').onclick = () => { closePanels(); newTab(); setTimeout(() => $('addrInput').focus(), 50); };
  $('bCloseAll').onclick = () => { [...tabs].forEach((t) => { t.el.remove(); }); tabs = []; jstack = []; closePanels(); newTab(); };

  // bookmarks + history
  let libTab = 'bookmarks';
  function showLibrary(which) { libTab = which; openPanel('bLibrary'); drawLibrary(); }
  $('bLibBack').onclick = closePanels;
  document.querySelectorAll('[data-lib]').forEach((b) => (b.onclick = () => { libTab = b.dataset.lib; drawLibrary(); }));
  function dayLabel(t) {
    const d = new Date(t), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function drawLibrary() {
    document.querySelectorAll('[data-lib]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lib === libTab)));
    $('libClear').hidden = libTab !== 'history';
    const list = $('libList'); list.innerHTML = '';
    const items = libTab === 'bookmarks' ? marks : hist;
    if (!items.length) { list.innerHTML = `<p class="lib-empty">${libTab === 'bookmarks' ? 'No bookmarks yet. Open a page, tap ⋮ and then ★.' : 'No history yet.'}</p>`; return; }
    let lastDay = '';
    items.forEach((it, i) => {
      if (libTab === 'history') { const d = dayLabel(it.time); if (d !== lastDay) { lastDay = d; const h = document.createElement('h3'); h.textContent = d; list.append(h); } }
      const row = document.createElement('div'); row.className = 'lrow';
      row.append(letterIcon(hostOf(it.url) || it.title, 36));
      const tx = document.createElement('span'); tx.className = 'tx';
      tx.innerHTML = '<b></b><small></small>';
      tx.querySelector('b').textContent = (libTab === 'bookmarks' ? it.title : it.title || hostOf(it.url)) || it.url;
      tx.querySelector('small').textContent = (libTab === 'history' ? new Date(it.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · ' : '') + shortUrl(it.url);
      row.append(tx);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'lx'; x.setAttribute('aria-label', 'Remove');
      x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      row.append(x);
      row.onclick = (e) => {
        if (e.target.closest('.lx')) { items.splice(i, 1); libTab === 'bookmarks' ? saveMarks() : saveHist(); drawLibrary(); paint(); return; }
        closePanels(); if (!active) newTab(); navigate(active, it.url);
      };
      list.append(row);
    });
  }
  function clearHistory(after) {
    if (!hist.length) return toast('History is already empty');
    sheet({ title: 'Clear browsing history?', body: '<p>This removes every page from History on this phone. Bookmarks stay.</p>', actions: [
      { label: 'Cancel' },
      { label: 'Clear history', primary: true, onClick: () => { hist = []; saveHist(); toast('History cleared'); after && after(); } },
    ] });
  }
  $('libClear').onclick = () => clearHistory(drawLibrary);

  /* ---------------- info banner ---------------- */
  if (!store.get('hr:binfoSeen', false)) $('bInfo').hidden = false;
  $('bInfoClose').onclick = () => { $('bInfo').hidden = true; store.set('hr:binfoSeen', true); };

  /* ---------------- page server on/off: reload what's open ---------------- */
  proxy.onChange(() => { tabs.forEach((t) => { if (t.url && t.url !== START) load(t, t.url); }); paint(); });

  /* ---------------- register with the phone ---------------- */
  PHONE.register('browser', {
    el: win,
    name: () => 'Browser',
    icon: (s) => HR.builtinIcon('browser', s),
    bar: () => '#121722',
    back: (fromSystem) => back(fromSystem),
    onShow: () => { ensureTab(); paint(); },
    onClose: () => { closePanels(); },
    menu: null,
  });

  Object.assign(HR, {
    openInBrowser(url, from) {
      ensureTab();
      const blank = active && active.url === START && active.idx <= 0;
      if (url) { if (blank) navigate(active, url); else newTab(url, true, active); }
      HR.showView('browser', from);
    },
    browser: {
      current: () => (active ? { url: active.url, title: active.title, frame: active.el } : null),
      clearHistory: () => clearHistory(),
      clearBookmarks: () => { marks = []; saveMarks(); paint(); },
      resetBookmarks: () => { marks = DEFAULT_MARKS.slice(); saveMarks(); },
      showInfo: () => { $('bInfo').hidden = false; store.set('hr:binfoSeen', false); },
      engines: ENGINES, START,
      counts: () => ({ marks: marks.length, hist: hist.length, tabs: tabs.length }),
    },
  });
  HR.pendingOpen().forEach((u) => HR.openInBrowser(u));
})();
