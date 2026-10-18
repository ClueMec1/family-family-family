/* HTML Runner — Settings app. */
(function () {
  'use strict';
  const HR = window.HR;
  const $ = (id) => document.getElementById(id);
  const { store, esc, toast, sheet } = HR;
  const win = $('view-settings');

  const ICON = {
    wall: ['#ff8a5c', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 16l5-5 4 4 2-2 5 5"/><circle cx="15.5" cy="8.5" r="1.5"/>'],
    grid: ['#5fd39a', '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>'],
    web: ['#5aa0ff', '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.6 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.6-3.6-8.5s1-5.9 3.6-8.5z"/>'],
    search: ['#5aa0ff', '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'],
    home: ['#5aa0ff', '<path d="M4 11l8-7 8 7v9H4z"/>'],
    hist: ['#ff6b7a', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'],
    mark: ['#ffb547', '<path d="M6 4h12v17l-6-4-6 4z"/>'],
    info: ['#8fc3ff', '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'],
    server: ['#2fb7c4', '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>'],
    nav: ['#a57bff', '<path d="M16 5v14L6 12z"/>'],
    bar: ['#a57bff', '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M5 7h14"/>'],
    install: ['#ffb547', '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>'],
    about: ['#8792a8', '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5"/>'],
  };
  const chev = '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
  const ico = (k) => `<i class="s-ico" style="background:${ICON[k][0]}"><svg viewBox="0 0 24 24">${ICON[k][1]}</svg></i>`;

  function row({ icon, title, sub, right = chev, onClick, id }) {
    const b = document.createElement(onClick ? 'button' : 'div');
    if (onClick) { b.type = 'button'; b.onclick = onClick; }
    b.className = 's-row'; if (id) b.id = id;
    b.innerHTML = `${ico(icon)}<span class="s-tx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${typeof right === 'string' ? right : ''}`;
    if (right && typeof right !== 'string') { b.append(right); if (!onClick) { b.style.cursor = 'pointer'; b.onclick = (e) => { if (!e.target.closest('.switch')) right.querySelector('input').click(); }; } }
    return b;
  }
  function toggle(on, onChange) {
    const l = document.createElement('label'); l.className = 'switch';
    l.innerHTML = '<input type="checkbox"><i></i>';
    const i = l.querySelector('input'); i.checked = on; i.onchange = () => onChange(i.checked);
    l.onclick = (e) => e.stopPropagation();
    return l;
  }
  function choose(title, options, current, onPick) {
    const wrap = document.createElement('div'); wrap.className = 'choices';
    options.forEach(([val, label, hint]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'choice';
      b.setAttribute('aria-pressed', String(val === current));
      b.innerHTML = `<i></i><span><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>`;
      b.onclick = () => { onPick(val); close(); draw(); };
      wrap.append(b);
    });
    const close = sheet({ title, body: wrap, actions: [{ label: 'Cancel' }] });
  }
  function group(title, id) {
    const g = document.createElement('section'); g.className = 's-group'; if (id) g.dataset.section = id;
    g.innerHTML = `<h2>${esc(title)}</h2><div class="s-card"></div>`;
    return g;
  }

  function draw() {
    const box = $('setScroll'); const keep = box.scrollTop; box.innerHTML = '';
    const home = HR.home.prefs(), sys = PHONE.system();

    // ---- look ----
    const look = group('Wallpaper & style', 'style');
    const walls = document.createElement('div'); walls.className = 's-walls';
    Object.entries(HR.home.walls).forEach(([k, v]) => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = v.css;
      b.setAttribute('aria-pressed', String(home.wall === k)); b.title = v.name;
      b.innerHTML = `<span>${esc(v.name)}</span>`;
      b.onclick = () => { HR.home.setPrefs({ wall: k }); draw(); };
      walls.append(b);
    });
    look.querySelector('.s-card').append(walls);
    const shapes = { squircle: 'Rounded square', circle: 'Circle', square: 'Soft square' };
    look.querySelector('.s-card').append(
      row({ icon: 'grid', title: 'Icon shape', sub: shapes[home.shape] || 'Rounded square', onClick: () => choose('Icon shape', Object.entries(shapes), home.shape, (v) => HR.home.setPrefs({ shape: v })) }),
      row({ icon: 'grid', title: 'Apps per row', sub: String(home.cols), onClick: () => choose('Apps per row', [[4, '4 apps'], [5, '5 apps']], home.cols, (v) => HR.home.setPrefs({ cols: v })) }),
      row({ icon: 'grid', title: 'Show app names', right: toggle(home.labels, (v) => HR.home.setPrefs({ labels: v })) }),
    );
    box.append(look);

    // ---- browser ----
    const br = group('Browser', 'browser');
    const eng = store.get('hr:bsearch', 'ddg'), E = HR.browser.engines;
    const bh = store.get('hr:bhome', HR.browser.START);
    const c = HR.browser.counts();
    br.querySelector('.s-card').append(
      row({ icon: 'search', title: 'Search engine', sub: (E[eng] || E.ddg).name, onClick: () => choose('Search engine', Object.entries(E).map(([k, v]) => [k, v.name, k === 'ddg' ? 'Works inside apps (recommended)' : '']), eng, (v) => store.set('hr:bsearch', v)) }),
      row({ icon: 'home', title: 'Home page', sub: bh === HR.browser.START ? 'New tab page' : bh, onClick: () => choose('Home page', [[HR.browser.START, 'New tab page', 'Search box, shortcuts and recent sites']].concat(bh !== HR.browser.START ? [[bh, bh, 'Set from ⋮ → Use as home page']] : []), bh, (v) => store.set('hr:bhome', v)) }),
      row({ icon: 'hist', title: 'Clear browsing history', sub: c.hist + ' pages', onClick: () => HR.browser.clearHistory() }),
      row({ icon: 'mark', title: 'Bookmarks', sub: c.marks + ' saved · tap to reset to the starter set', onClick: () => sheet({ title: 'Reset bookmarks?', body: '<p>Your bookmarks are replaced with the starter set (Wikipedia, DuckDuckGo, MDN, Can I use).</p>', actions: [{ label: 'Cancel' }, { label: 'Reset', primary: true, onClick: () => { HR.browser.resetBookmarks(); toast('Bookmarks reset'); draw(); } }] }) }),
      row({ icon: 'info', title: 'Why some sites stay blank', sub: 'Show the explanation in the browser again', onClick: () => { HR.browser.showInfo(); HR.showView('browser'); } }),
    );
    box.append(br);

    // ---- page server ----
    const ps = group('Page server', 'server');
    const pc = HR.proxy.get();
    ps.querySelector('.s-card').append(
      row({ icon: 'server', title: 'Load pages through my server', sub: HR.proxy.active() ? 'On · ' + (pc.url || '') : (pc.url ? 'Off · ' + pc.url : 'Not set up. Tap to add your server'), onClick: () => HR.proxySheet() }),
    );
    box.append(ps);

    // ---- system ----
    const sy = group('System', 'system');
    const navNames = { buttons: '3-button navigation', gesture: 'Gesture bar' };
    const sbNames = { auto: 'Automatic', always: 'Always show', never: 'Never show' };
    sy.querySelector('.s-card').append(
      row({ icon: 'nav', title: 'Navigation', sub: navNames[sys.nav] || navNames.buttons, onClick: () => choose('Navigation', [['buttons', '3-button navigation', 'Back, Home and Recent apps buttons'], ['gesture', 'Gesture bar', 'Tap: Home · Swipe up: recent apps · Swipe sideways: previous app']], sys.nav, (v) => PHONE.setSystem({ nav: v })) }),
      row({ icon: 'bar', title: 'Status bar', sub: sbNames[sys.status] || sbNames.auto, onClick: () => choose('Status bar (time, battery, Wi-Fi)', [['auto', 'Automatic', 'Only when your phone’s own status bar is hidden'], ['always', 'Always show'], ['never', 'Never show']], sys.status, (v) => PHONE.setSystem({ status: v })) }),
    );
    box.append(sy);

    // ---- install + about ----
    const ab = group('About', 'about');
    const st = HR.installState();
    ab.querySelector('.s-card').append(
      row({ icon: 'install', title: st.installed ? 'HTML Runner is installed' : 'Install HTML Runner', sub: st.installed ? 'You’re using the installed app' : st.ready ? 'Ready to install. Tap to install' : 'Tap to see what Chrome still needs', onClick: () => (st.ready ? HR.installSelf() : HR.installCheck()) }),
      row({ icon: 'about', title: 'HTML Runner', sub: 'Code, browse and run web apps. Your data stays on this phone.', right: '' }),
    );
    box.append(ab);
    box.scrollTop = keep;
  }

  PHONE.register('settings', {
    el: win, name: () => 'Settings', icon: (s) => HR.builtinIcon('settings', s), bar: () => '#0f131b',
    back: () => false, onShow: draw,
  });
  HR.proxy.onChange(() => { if (PHONE.current() === 'settings') draw(); });
  document.addEventListener('hr-installable', () => { if (PHONE.current() === 'settings') draw(); });

  HR.openSettings = (section) => {
    HR.showView('settings');
    setTimeout(() => {
      const el = section && win.querySelector(`[data-section="${section}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 340);
  };
})();
