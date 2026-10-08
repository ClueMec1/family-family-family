/* HTML Runner — editor, live preview, built-in browser, projects, install. AI lives in ai.js. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const MONACO = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min';
  const FILES = { html: 'index.html', css: 'style.css', js: 'script.js' };
  const LANG = { html: 'html', css: 'css', js: 'javascript' };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isPhone = () => matchMedia('(max-width:820px)').matches;

  /* ---------------- templates ---------------- */
  const TEMPLATES = {
    starter: {
      name: 'Starter',
      html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My page</title>
</head>
<body>
  <main>
    <h1>Hello from HTML Runner</h1>
    <p>Edit index.html, style.css and script.js, then press Run.</p>
    <button id="count">Clicked 0 times</button>
    <button id="quote">Fetch from the internet</button>
    <p id="out"></p>
  </main>
</body>
</html>`,
      css: `body {
  font-family: system-ui, sans-serif;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
  background: #f3efe6;
  color: #222;
}
main { text-align: center; padding: 24px; }
button {
  font-size: 16px;
  padding: 12px 20px;
  margin: 4px;
  border: 0;
  border-radius: 10px;
  background: #2b59ff;
  color: #fff;
  cursor: pointer;
}
#out { color: #555; min-height: 1.5em; }`,
      js: `let n = 0;
const countBtn = document.getElementById('count');

countBtn.addEventListener('click', () => {
  n++;
  countBtn.textContent = \`Clicked \${n} times\`;
  console.log('click', n, { even: n % 2 === 0 });
});

// Real network requests work in Connected mode
document.getElementById('quote').addEventListener('click', async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading…';
  try {
    const res = await fetch('https://api.github.com/zen');
    out.textContent = await res.text();
    console.info('Fetched with status', res.status);
  } catch (err) {
    out.textContent = 'Request failed';
    console.error(err);
  }
});`,
    },
    blank: {
      name: 'Blank',
      html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Untitled</title>
</head>
<body>

</body>
</html>`,
      css: '', js: '',
    },
    firebase: {
      name: 'Firebase guestbook',
      html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Guestbook</title>
</head>
<body>
  <main>
    <h1>Guestbook</h1>
    <p id="status">Paste your Firebase config into script.js, then press Run.</p>
    <button id="login">Sign in with Google</button>
    <form id="form">
      <input id="msg" placeholder="Leave a message" maxlength="200" required>
      <button>Post</button>
    </form>
    <ul id="list"></ul>
  </main>
</body>
</html>`,
      css: `body { font-family: system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 0 16px; }
form { display: flex; gap: 8px; margin: 16px 0; }
input { flex: 1; padding: 10px; font-size: 16px; }
button { padding: 10px 16px; font-size: 15px; cursor: pointer; }
li { padding: 8px 0; border-bottom: 1px solid #eee; }
li small { color: #888; }`,
      js: `// Uses ES modules, so HTML Runner loads this file with type="module".
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. Firebase console → Project settings → Your apps → Config. Paste it here.
// 2. Authentication → Settings → Authorized domains → add the domain HTML Runner is hosted on.
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "PASTE_YOUR_APP_ID",
};

const status = document.getElementById('status');

if (firebaseConfig.apiKey.startsWith('PASTE')) {
  console.warn('Add your Firebase config to script.js first.');
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let user = null;

  document.getElementById('login').onclick = () =>
    signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => console.error(e.code, e.message));

  onAuthStateChanged(auth, (u) => {
    user = u;
    status.textContent = u ? 'Signed in as ' + u.displayName : 'Not signed in';
  });

  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('msg');
    await addDoc(collection(db, 'guestbook'), {
      text: input.value,
      name: user ? user.displayName : 'Guest',
      at: serverTimestamp(),
    });
    input.value = '';
  };

  const q = query(collection(db, 'guestbook'), orderBy('at', 'desc'), limit(20));
  onSnapshot(q, (snap) => {
    const list = document.getElementById('list');
    list.innerHTML = '';
    snap.forEach((doc) => {
      const d = doc.data();
      const li = document.createElement('li');
      li.innerHTML = '<b></b> <small></small><br>';
      li.querySelector('b').textContent = d.name;
      li.querySelector('small').textContent = d.at ? d.at.toDate().toLocaleString() : '';
      li.append(d.text);
      list.append(li);
    });
  }, (err) => console.error('Firestore:', err.message));
}`,
    },
  };

  /* ---------------- small UI helpers ---------------- */
  function toast(text) {
    const el = $('toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200);
  }
  function sheet({ title, body, actions = [] }) {
    const s = $('sheet');
    $('sheetTitle').textContent = title;
    const b = $('sheetBody'); b.innerHTML = '';
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body);
    const a = $('sheetActions'); a.innerHTML = '';
    const close = () => { s.hidden = true; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    actions.forEach((act) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (act.primary ? ' run' : '');
      btn.textContent = act.label;
      btn.onclick = () => { const keep = act.onClick && act.onClick(); if (keep !== true) close(); };
      a.append(btn);
    });
    s.hidden = false;
    document.addEventListener('keydown', onKey);
    s.onclick = (e) => { if (e.target === s) close(); };
    setTimeout(() => { const f = b.querySelector('input') || a.querySelector('.run'); f && f.focus(); }, 30);
    return close;
  }
  function ask(title, label, value) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<label class="field"><span>${esc(label)}</span><input type="text" id="askInput"></label>`;
      const input = wrap.querySelector('input'); input.value = value || '';
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const close = sheet({ title, body: wrap, actions: [
        { label: 'Cancel', onClick: () => finish(null) },
        { label: 'OK', primary: true, onClick: () => finish(input.value.trim() || null) },
      ] });
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim() || null); close(); } };
    });
  }

  /* ---------------- views ---------------- */
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.toggleAttribute('data-active', v.id === 'view-' + name));
    document.querySelectorAll('#views button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.view === name)));
    store.set('hr:view', name);
    if (name === 'code' && editor.layout) editor.layout();
    if (name === 'browser') browser.ensureTab();
  }
  $('views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showView(b.dataset.view); });

  function showPane(p) {
    $('split').dataset.pane = p;
    document.querySelectorAll('#paneSwitch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pane === p)));
    if (p === 'editor' && editor.layout) editor.layout();
  }
  $('paneSwitch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { showPane(b.dataset.pane); if (b.dataset.pane === 'preview' && !runs) run(); } });

  /* ---------------- project state ---------------- */
  let work = store.get('hr:work', null);
  if (!work || !work.files) work = { name: 'Untitled project', files: { html: TEMPLATES.starter.html, css: TEMPLATES.starter.css, js: TEMPLATES.starter.js } };
  let current = 'html';
  const saveWork = () => store.set('hr:work', work);
  $('projName').textContent = work.name;

  /* ---------------- editor (Monaco, with a plain fallback) ---------------- */
  const editor = { ready: false, listeners: [] };
  let monacoRef = null, ed = null;
  const models = {}, viewStates = {};

  function onEdited() {
    for (const k in models) work.files[k] = models[k].getValue();
    saveWork();
    if ($('autoRun').checked) { clearTimeout(onEdited.t); onEdited.t = setTimeout(run, 700); }
  }

  function initMonaco() {
    if (typeof require === 'undefined' || !require.config) return initFallback('The code editor could not load. You are offline or the CDN is blocked.');
    window.MonacoEnvironment = {
      getWorkerUrl() {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
          `self.MonacoEnvironment={baseUrl:'${MONACO}/'};importScripts('${MONACO}/vs/base/worker/workerMain.js');`);
      },
    };
    require.config({ paths: { vs: MONACO + '/vs' } });
    const timer = setTimeout(() => { if (!editor.ready) initFallback('The code editor is taking too long to load, so a basic editor is shown.'); }, 20000);
    require(['vs/editor/editor.main'], (monaco) => {
      clearTimeout(timer);
      if (editor.ready) return;
      monacoRef = window.monaco || monaco;
      const m = monacoRef;
      m.editor.defineTheme('runner', {
        base: 'vs-dark', inherit: true, rules: [],
        colors: {
          'editor.background': '#0c0f15', 'editorGutter.background': '#0c0f15',
          'editor.lineHighlightBackground': '#141a26', 'editorLineNumber.foreground': '#3e4860',
          'editorLineNumber.activeForeground': '#ffb547', 'editorCursor.foreground': '#ffb547',
          'editorSuggestWidget.background': '#1a2130', 'editorSuggestWidget.border': '#252e40',
          'editorSuggestWidget.selectedBackground': '#2a3550', 'editorWidget.background': '#1a2130',
        },
      });
      m.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: m.languages.typescript.ScriptTarget.ESNext, allowNonTsExtensions: true, allowJs: true,
        module: m.languages.typescript.ModuleKind.ESNext, moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs,
      });
      m.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false, diagnosticCodesToIgnore: [2792, 2307] });
      try { if (window.emmetMonaco) { emmetMonaco.emmetHTML(m, ['html']); emmetMonaco.emmetCSS(m, ['css']); } } catch (e) { console.warn('Emmet unavailable', e); }

      for (const k in FILES) {
        models[k] = m.editor.createModel(work.files[k] || '', LANG[k], m.Uri.parse('file:///' + FILES[k]));
        models[k].onDidChangeContent(onEdited);
      }
      $('editorLoading').remove();
      ed = m.editor.create($('editorHost'), {
        model: models[current], theme: 'runner', automaticLayout: true,
        fontFamily: 'IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace', fontSize: isPhone() ? 14 : 13, lineHeight: 21,
        minimap: { enabled: !isPhone() }, tabSize: 2, wordWrap: store.get('hr:wrap', false) ? 'on' : 'off',
        quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'smart', snippetSuggestions: 'top', parameterHints: { enabled: true },
        inlineSuggest: { enabled: true }, bracketPairColorization: { enabled: true }, autoClosingBrackets: 'always',
        formatOnPaste: true, linkedEditing: true, fixedOverflowWidgets: true, scrollBeyondLastLine: false,
        padding: { top: 10 }, smoothScrolling: true, stickyScroll: { enabled: false },
      });
      ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, runAndShow);
      ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, saveProject);
      ed.addAction({
        id: 'hr-ask-ai', label: 'Ask AI about this code', contextMenuGroupId: 'navigation', contextMenuOrder: 0,
        keybindings: [m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.KeyA],
        run: (e) => { const sel = e.getModel().getValueInRange(e.getSelection()); window.HR.askAI && window.HR.askAI(sel || e.getValue(), FILES[current]); },
      });
      editor.ready = true;
      editor.listeners.forEach((fn) => fn(m, ed));
      editor.listeners = [];
    }, (err) => { clearTimeout(timer); initFallback('The code editor could not load (' + (err && err.message || 'network error') + ').'); });
  }

  function initFallback(reason) {
    if (editor.ready) return;
    editor.ready = true; editor.fallback = true;
    const host = $('editorHost'); host.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.id = 'plainEditor'; ta.spellcheck = false;
    ta.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;resize:none;border:0;outline:0;background:var(--bg);color:var(--fg);font:13px/1.6 var(--code);padding:12px 14px;tab-size:2;white-space:pre';
    ta.value = work.files[current] || '';
    ta.oninput = () => { work.files[current] = ta.value; saveWork(); if ($('autoRun').checked) { clearTimeout(onEdited.t); onEdited.t = setTimeout(run, 700); } };
    ta.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); ta.oninput(); }
    };
    host.append(ta);
    toast(reason);
  }

  editor.layout = () => ed && ed.layout();
  editor.get = (k) => (models[k] ? models[k].getValue() : work.files[k] || '');
  editor.set = (k, text) => {
    work.files[k] = text;
    if (models[k]) models[k].setValue(text);
    else if (editor.fallback && k === current) $('plainEditor').value = text;
    saveWork();
  };
  editor.whenReady = (fn) => (monacoRef && ed ? fn(monacoRef, ed) : editor.listeners.push(fn));

  function switchFile(k) {
    if (k === current) return;
    if (ed) viewStates[current] = ed.saveViewState();
    current = k;
    document.querySelectorAll('#fileTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.file === k)));
    if (ed) { ed.setModel(models[k]); if (viewStates[k]) ed.restoreViewState(viewStates[k]); ed.focus(); }
    else if (editor.fallback) $('plainEditor').value = work.files[k] || '';
  }
  $('fileTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) switchFile(b.dataset.file); });

  /* ---------------- preview ---------------- */
  let runs = 0, token = 0, frame = null, lines = 0, errs = 0;
  let mode = store.get('hr:mode', 'connected');
  const previewUrl = () => new URL('preview/index.html', location.href).href;
  const swActive = () => !!(navigator.serviceWorker && navigator.serviceWorker.controller);

  function bridge(t) {
    return `<script>(function(){if(window.parent===window)return;var T=${t},P=window.parent;
function f(x){if(x instanceof Error)return x.name+': '+x.message;if(typeof x==='object'&&x!==null){try{return JSON.stringify(x,null,1)}catch(e){return String(x)}}return String(x)}
function s(k,a){try{P.postMessage({__hr:T,k:k,a:a},'*')}catch(e){}}
['log','info','warn','error','debug'].forEach(function(k){var o=console[k];console[k]=function(){s(k,[].map.call(arguments,f));o&&o.apply(console,arguments)}});
addEventListener('error',function(e){if(e.message)s('error',[e.message+(e.lineno?'  ('+(e.filename||'').split('/').pop()+':'+e.lineno+')':'')]);else if(e.target&&e.target.src)s('error',['Failed to load '+e.target.src])},true);
addEventListener('unhandledrejection',function(e){s('error',['Unhandled promise rejection: '+f(e.reason)])});})();<\/script>`;
  }
  const isModule = (js) => /^\s*(import|export)\s/m.test(js);

  /** Build the page. inline=true puts CSS/JS into the HTML (used by Isolated mode and downloads). */
  function buildPage({ inline, withBridge, t }) {
    const html = editor.get('html'), css = editor.get('css'), js = editor.get('js');
    const head = [], tail = [];
    if (withBridge) head.push(bridge(t));
    if (css.trim() && !/href=["']?\.?\/?style\.css/i.test(html)) head.push(inline ? `<style>\n${css}\n</style>` : '<link rel="stylesheet" href="style.css">');
    if (js.trim() && !/src=["']?\.?\/?script\.js/i.test(html)) {
      const type = isModule(js) ? ' type="module"' : '';
      tail.push(inline ? `<script${type}>\n${js.replace(/<\/script/gi, '<\\/script')}\n<\/script>` : `<script${type} src="script.js"><\/script>`);
    }
    let out = html;
    if (!/<html[\s>]/i.test(out) && !/<head[\s>]/i.test(out) && !/<body[\s>]/i.test(out)) {
      out = `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n${head.join('\n')}\n</head><body>\n${out}\n${tail.join('\n')}\n</body></html>`;
      return out;
    }
    const headIns = head.join('\n');
    if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => m + '\n' + headIns);
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => m + '\n<head>' + headIns + '</head>');
    else out = headIns + out;
    const tailIns = tail.join('\n');
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>(?![\s\S]*<\/body>)/i, tailIns + '\n</body>');
    else out += tailIns;
    return out;
  }

  async function publishToServiceWorker(t) {
    const cache = await caches.open('hr-preview');
    const put = (name, body, type) => cache.put(new URL('preview/' + name, location.href).href,
      new Response(body, { headers: { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' } }));
    await Promise.all([
      put('index.html', buildPage({ inline: false, withBridge: true, t }), 'text/html'),
      put('style.css', editor.get('css'), 'text/css'),
      put('script.js', editor.get('js'), 'text/javascript'),
    ]);
  }

  async function run() {
    const t = ++token;
    runs++;
    clearLog(true);
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = 'Preview of your page';
    frame.setAttribute('allow', 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; display-capture; web-share; payment');
    frame.setAttribute('allowfullscreen', '');
    let how;
    if (mode === 'isolated') {
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock allow-downloads');
      frame.srcdoc = buildPage({ inline: true, withBridge: true, t });
      how = 'isolated sandbox';
    } else if (swActive() && 'caches' in window) {
      try {
        await publishToServiceWorker(t);
        if (t !== token) return;
        frame.src = previewUrl() + '?run=' + t;
        how = 'connected · ' + new URL(previewUrl()).host;
      } catch (e) {
        frame.srcdoc = buildPage({ inline: true, withBridge: true, t }); how = 'connected (basic)';
      }
    } else {
      frame.srcdoc = buildPage({ inline: true, withBridge: true, t });
      how = 'connected (basic)';
      if (location.protocol === 'file:') addLine('sys', ['Opened from a file: host HTML Runner on a website so Firebase sign-in and installs work.']);
      else addLine('sys', ['Reload HTML Runner once to switch on full Connected mode (needed for Firebase sign-in).']);
    }
    $('frameWrap').append(frame);
    frame.addEventListener('load', () => {
      if (t !== token) return;
    });
    $('runInfo').textContent = `Run ${runs} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    $('runInfo').title = how;
    addLine('sys', ['Running in ' + how]);
  }
  function runAndShow() { run(); if (isPhone()) showPane('preview'); }

  addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.__hr !== token || !frame || e.source !== frame.contentWindow) return;
    addLine(m.k === 'debug' ? 'log' : m.k, m.a);
    lines++;
    if (m.k === 'error') { errs++; $('console').classList.remove('closed'); $('conHead').setAttribute('aria-expanded', 'true'); }
    updCount();
  });
  function addLine(k, a) {
    const log = $('log'); const em = log.querySelector('.empty'); if (em) em.remove();
    const d = document.createElement('div'); d.className = k; d.textContent = a.join(' ');
    log.append(d); log.scrollTop = log.scrollHeight;
  }
  function clearLog(quiet) { $('log').innerHTML = quiet ? '' : '<div class="empty">Console cleared.</div>'; lines = 0; errs = 0; updCount(); }
  function updCount() { const c = $('count'); c.textContent = lines; c.classList.toggle('err', errs > 0); }
  $('conHead').addEventListener('click', (e) => {
    if (e.target.id === 'conClear') { clearLog(); return; }
    const closed = $('console').classList.toggle('closed'); $('conHead').setAttribute('aria-expanded', String(!closed));
  });

  function setMode(m) {
    mode = m; store.set('hr:mode', m);
    document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
    run();
  }
  $('mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  $('device').onchange = () => { $('frameWrap').style.width = $('device').value; store.set('hr:device', $('device').value); };
  $('device').value = store.get('hr:device', '100%'); $('frameWrap').style.width = $('device').value;

  async function previewLink() {
    if (swActive()) { await publishToServiceWorker(0); return previewUrl(); }
    const blob = new Blob([buildPage({ inline: true, withBridge: false })], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }
  $('popOut').onclick = async () => { const u = await previewLink(); window.open(u, '_blank'); };
  $('toBrowser').onclick = async () => { const u = await previewLink(); showView('browser'); browser.open(u, true); };
  $('runBtn').onclick = runAndShow;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !(ed && ed.hasTextFocus())) { e.preventDefault(); runAndShow(); }
  });

  /* ---------------- project menu ---------------- */
  const menu = $('menu');
  $('menuBtn').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
  $('autoRun').checked = store.get('hr:autorun', false);
  $('autoRun').onchange = () => store.set('hr:autorun', $('autoRun').checked);
  $('wrapLines').checked = store.get('hr:wrap', false);
  $('wrapLines').onchange = () => { store.set('hr:wrap', $('wrapLines').checked); ed && ed.updateOptions({ wordWrap: $('wrapLines').checked ? 'on' : 'off' }); };

  function loadFiles(files, name) {
    work.name = name; $('projName').textContent = name;
    for (const k in FILES) editor.set(k, files[k] || '');
    saveWork(); run();
  }
  function saveProject() {
    const all = store.get('hr:projects', {});
    all[work.name] = { files: { ...work.files, html: editor.get('html'), css: editor.get('css'), js: editor.get('js') }, updated: Date.now() };
    store.set('hr:projects', all); toast('Saved “' + work.name + '”');
  }
  function openProjects() {
    const all = store.get('hr:projects', {});
    const names = Object.keys(all).sort((a, b) => all[b].updated - all[a].updated);
    const wrap = document.createElement('div'); wrap.className = 'plist';
    if (!names.length) wrap.innerHTML = '<p>No saved projects yet. Use “Save project” to keep one here.</p>';
    let close;
    names.forEach((n) => {
      const row = document.createElement('div');
      row.innerHTML = `<button class="btn" type="button"></button><button class="btn icon" type="button" title="Delete">✕</button>`;
      row.children[0].textContent = n + ' · ' + new Date(all[n].updated).toLocaleDateString();
      row.children[0].onclick = () => { loadFiles(all[n].files, n); close(); toast('Opened “' + n + '”'); };
      let armed = false;
      row.children[1].onclick = () => {
        if (!armed) { armed = true; row.children[1].textContent = 'Delete?'; return; }
        delete all[n]; store.set('hr:projects', all); row.remove();
      };
      wrap.append(row);
    });
    close = sheet({ title: 'Saved projects', body: wrap, actions: [{ label: 'Close' }] });
  }
  function newProject() {
    const wrap = document.createElement('div'); wrap.className = 'plist';
    let close;
    Object.entries(TEMPLATES).forEach(([key, tpl]) => {
      const row = document.createElement('div');
      const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = tpl.name;
      b.onclick = async () => { close(); const n = await ask('Name your project', 'Project name', tpl.name === 'Blank' ? 'Untitled project' : tpl.name); if (n) { loadFiles(tpl, n); toast('Started “' + n + '”'); } };
      row.append(b); wrap.append(row);
    });
    close = sheet({ title: 'New project', body: wrap, actions: [{ label: 'Cancel' }] });
  }
  function download() {
    const blob = new Blob([buildPage({ inline: true, withBridge: false })], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (work.name || 'page').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.html';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function upload(fileList) {
    [...fileList].forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        const ext = f.name.split('.').pop().toLowerCase();
        const k = ext === 'css' ? 'css' : (ext === 'js' || ext === 'mjs') ? 'js' : 'html';
        editor.set(k, r.result); switchFile(k); toast('Loaded ' + f.name); run();
      };
      r.readAsText(f);
    });
  }
  $('fileInput').onchange = function () { upload(this.files); this.value = ''; };
  $('editorHost').addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  $('editorHost').addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); upload(e.dataTransfer.files); } });

  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    menu.hidden = true;
    const act = b.dataset.act;
    if (act === 'new') newProject();
    else if (act === 'save') saveProject();
    else if (act === 'saveas') { const n = await ask('Save as', 'Project name', work.name); if (n) { work.name = n; $('projName').textContent = n; saveWork(); saveProject(); } }
    else if (act === 'open') openProjects();
    else if (act === 'upload') $('fileInput').click();
    else if (act === 'download') download();
    else if (act === 'format') { if (ed) ed.getAction('editor.action.formatDocument').run(); else toast('Formatting needs the full editor'); }
  });

  /* ---------------- built-in browser ---------------- */
  const browser = (function () {
    let tabs = [], active = null, seq = 0;
    const DEFAULT_MARKS = [
      { title: 'Wikipedia', url: 'https://en.m.wikipedia.org/' },
      { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
      { title: 'Can I use', url: 'https://caniuse.com/' },
    ];
    let marks = store.get('hr:marks', DEFAULT_MARKS);
    const saveMarks = () => store.set('hr:marks', marks);

    function toUrl(input) {
      const s = input.trim();
      if (!s) return '';
      if (/^(https?|blob|data):/i.test(s)) return s;
      if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(s)) return 'http://' + s;
      if (/^[^\s]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s)) return 'https://' + s;
      return 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(s);
    }
    function label(url) {
      if (!url) return 'New tab';
      if (url.startsWith('blob:') || url.includes('/preview/index.html')) return 'Your preview';
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
    }

    function renderTabs() {
      const strip = $('btabs'); strip.innerHTML = '';
      tabs.forEach((t) => {
        const el = document.createElement('div');
        el.className = 'btab'; el.setAttribute('role', 'tab'); el.setAttribute('aria-selected', String(t === active)); el.tabIndex = 0;
        el.innerHTML = `<span></span><button class="x" title="Close tab" type="button"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
        el.querySelector('span').textContent = t.title || label(t.url);
        el.onclick = (e) => { if (e.target.closest('.x')) close(t); else select(t); };
        el.onkeydown = (e) => { if (e.key === 'Enter') select(t); };
        strip.append(el);
      });
    }
    function startPage(t) {
      const div = document.createElement('div'); div.className = 'start';
      div.innerHTML = `<div class="start-inner">
        <h2>Where to?</h2>
        <p>Type a web address or a search above. Sites that refuse to be shown inside other apps (Google, YouTube, most banks and social sites) will stay blank here. Use Open in Chrome for those.</p>
        <div class="marks"></div>
        <p>To install a website as an app, open it and press <b>Install</b>.</p></div>`;
      const grid = div.querySelector('.marks');
      const prev = document.createElement('button'); prev.className = 'mark'; prev.type = 'button';
      prev.innerHTML = '<i class="fav">&lt;/&gt;</i><span>Your code preview</span>';
      prev.onclick = async () => { const u = await previewLink(); navigate(t, u); };
      grid.append(prev);
      marks.forEach((m, i) => {
        const b = document.createElement('div'); b.className = 'mark'; b.tabIndex = 0; b.setAttribute('role', 'button');
        b.innerHTML = `<i class="fav"></i><span></span><button class="rm" type="button" title="Remove bookmark">✕</button>`;
        b.querySelector('.fav').textContent = (m.title || '?')[0].toUpperCase();
        b.querySelector('span').textContent = m.title;
        b.onclick = (e) => { if (e.target.closest('.rm')) { marks.splice(i, 1); saveMarks(); const fresh = startPage(t); t.el.replaceWith(fresh); t.el = fresh; show(t); return; } navigate(t, m.url); };
        b.onkeydown = (e) => { if (e.key === 'Enter') navigate(t, m.url); };
        grid.append(b);
      });
      return div;
    }
    function newTab(url, focus = true) {
      const t = { id: ++seq, url: '', title: '', hist: [], idx: -1, el: null };
      t.el = startPage(t); $('bstage').append(t.el);
      tabs.push(t);
      if (url) navigate(t, url);
      if (focus) select(t); else { t.el.hidden = true; renderTabs(); }
      saveTabs();
      return t;
    }
    function load(t, url) {
      t.url = url; t.title = '';
      const f = document.createElement('iframe');
      f.setAttribute('allow', 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; web-share; payment');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      f.src = url;
      f.addEventListener('load', () => {
        try { const d = f.contentDocument; if (d && d.title) { t.title = d.title; renderTabs(); } } catch (e) {}
      });
      t.el.replaceWith(f); t.el = f;
      show(t); renderTabs(); saveTabs();
    }
    function navigate(t, input) {
      const url = toUrl(input); if (!url) return;
      t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(url); t.idx = t.hist.length - 1;
      load(t, url);
    }
    function show(t) {
      tabs.forEach((x) => (x.el.hidden = x !== active));
      if (t === active) { $('addrInput').value = t.url && !t.url.startsWith('blob:') ? t.url : (t.url ? 'Your preview' : ''); }
      $('bStar').classList.toggle('on', !!(t.url && marks.some((m) => m.url === t.url)));
      $('bBack').disabled = !(active && active.idx > 0);
      $('bFwd').disabled = !(active && active.idx < active.hist.length - 1);
    }
    function select(t) { active = t; show(t); renderTabs(); }
    function close(t) {
      const i = tabs.indexOf(t); tabs.splice(i, 1); t.el.remove();
      if (!tabs.length) newTab();
      else if (t === active) select(tabs[Math.max(0, i - 1)]);
      else renderTabs();
      saveTabs();
    }
    function saveTabs() { store.set('hr:tabs', tabs.filter((t) => t.url && !t.url.startsWith('blob:')).map((t) => t.url)); }
    function ensureTab() {
      if (tabs.length) return;
      const saved = store.get('hr:tabs', []);
      if (saved.length) { saved.forEach((u, i) => newTab(u, i === saved.length - 1)); } else newTab();
    }

    $('newTab').onclick = () => { newTab(); $('addrInput').focus(); };
    $('addrForm').onsubmit = (e) => { e.preventDefault(); if (!active) newTab(); navigate(active, $('addrInput').value); $('addrInput').blur(); };
    $('addrInput').onfocus = function () { this.select(); };
    $('bBack').onclick = () => { if (active && active.idx > 0) { active.idx--; load(active, active.hist[active.idx]); } };
    $('bFwd').onclick = () => { if (active && active.idx < active.hist.length - 1) { active.idx++; load(active, active.hist[active.idx]); } };
    $('bReload').onclick = () => { if (active && active.url) load(active, active.url); };
    $('bStar').onclick = async () => {
      if (!active || !active.url || active.url.startsWith('blob:')) return toast('Open a web page first');
      const i = marks.findIndex((m) => m.url === active.url);
      if (i >= 0) { marks.splice(i, 1); saveMarks(); toast('Bookmark removed'); }
      else { const n = await ask('Add bookmark', 'Name', active.title || label(active.url)); if (!n) return; marks.push({ title: n, url: active.url }); saveMarks(); toast('Bookmarked'); }
      show(active);
    };
    const currentUrl = () => (active && active.url) || '';
    $('bChrome').onclick = () => { const u = currentUrl(); if (!u) return toast('Open a page first'); openInChrome(u); };
    $('bStatusChrome').onclick = $('bChrome').onclick;
    $('bInstall').onclick = () => installSheet(currentUrl());

    return { open: (url, fresh) => { ensureTab(); const t = fresh ? newTab(url) : active; if (!fresh) navigate(t, url); }, ensureTab };
  })();

  /* ---------------- Open in Chrome + installing ---------------- */
  const UA = navigator.userAgent;
  const isAndroid = /Android/i.test(UA), isIOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  function openInChrome(url) {
    if (url.startsWith('blob:')) return toast('This preview only exists inside HTML Runner. Host HTML Runner on a website to open previews in Chrome.');
    let u; try { u = new URL(url); } catch (e) { return toast('That address is not valid'); }
    if (isAndroid) {
      location.href = `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    } else if (isIOS) {
      location.href = url.replace(/^https:/, 'googlechromes:').replace(/^http:/, 'googlechrome:');
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  let deferredInstall = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('installApp').hidden = false; });
  addEventListener('appinstalled', () => { deferredInstall = null; $('installApp').hidden = true; toast('HTML Runner is installed'); });
  if (isIOS && !standalone) $('installApp').hidden = false;
  $('installApp').onclick = installSelf;

  async function installSelf() {
    if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; return; }
    sheet({
      title: 'Install HTML Runner',
      body: isIOS
        ? '<ol><li>Open this page in Safari.</li><li>Tap the Share button.</li><li>Choose <b>Add to Home Screen</b>.</li></ol>'
        : '<ol><li>Open the browser menu (⋮).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li></ol><p>If you don\'t see it, make sure HTML Runner is opened from its website address (https), not from a file.</p>',
      actions: [{ label: 'OK', primary: true }],
    });
  }

  function installSheet(url) {
    const isPreview = url && (url.includes('/preview/index.html') || url.startsWith('blob:'));
    if (!url) return installSelf();
    const steps = isAndroid
      ? '<ol><li>Tap <b>Open in Chrome</b>.</li><li>In Chrome, tap ⋮ then <b>Install app</b> (or <b>Add to Home screen</b>).</li></ol>'
      : isIOS
        ? '<ol><li>Copy the address and open it in Safari.</li><li>Tap Share, then <b>Add to Home Screen</b>.</li></ol>'
        : '<ol><li>Click <b>Open in Chrome</b>. It opens in a new tab.</li><li>Click the install icon at the right end of Chrome\'s address bar, or ⋮ → <b>Cast, save and share</b> → <b>Install page as app</b>.</li></ol>';
    sheet({
      title: 'Install this site as an app',
      body: `<p>Installing apps is handled by Chrome itself, so no app running inside another app can do it. HTML Runner hands the page to Chrome, where installing takes one tap.</p>${steps}` +
        (isPreview ? '<p>Your own code installs the same way once it has a manifest and is hosted on a website.</p>' : '') +
        `<p style="font-family:var(--code);font-size:12px;word-break:break-all">${esc(url.startsWith('blob:') ? 'Your preview' : url)}</p>`,
      actions: [
        { label: 'Copy address', onClick: () => { navigator.clipboard && navigator.clipboard.writeText(url).then(() => toast('Address copied'), () => toast('Could not copy')); return true; } },
        { label: 'Open in Chrome', primary: true, onClick: () => openInChrome(url) },
      ],
    });
  }

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker failed', e));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && mode === 'connected') { reloaded = true; run(); } });
  }

  /* ---------------- public API for ai.js ---------------- */
  window.HR = {
    FILES, toast, sheet, ask, showView, run: runAndShow, openInChrome,
    getFiles: () => ({ html: editor.get('html'), css: editor.get('css'), js: editor.get('js') }),
    currentFile: () => current,
    setFile: (k, text) => { editor.set(k, text); switchFile(k); },
    insertAtCursor: (text) => {
      if (ed) { const sel = ed.getSelection(); ed.executeEdits('ai', [{ range: sel, text, forceMoveMarkers: true }]); ed.focus(); }
      else editor.set(current, editor.get(current) + '\n' + text);
    },
    whenEditor: editor.whenReady,
    showCode: (k) => { showView('code'); showPane('editor'); if (k) switchFile(k); },
  };

  /* ---------------- start ---------------- */
  initMonaco();
  showView(new URLSearchParams(location.search).get('view') || store.get('hr:view', 'code'));
  run();
})();
