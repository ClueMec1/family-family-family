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
  const isPhone = () => true; // built for phones

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
    let un = null;
    const close = () => { s.hidden = true; document.removeEventListener('keydown', onKey); if (un) { un(); un = null; } };
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
    if (sheet.un) sheet.un();
    un = sheet.un = window.PHONE ? PHONE.overlay(() => { un = null; close(); }) : null; // the phone's Back closes it
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

  /* ---------------- views ----------------
     Each part of HTML Runner (Browser, Code, AI, Settings) is an app window on the phone shell (phone.js). */
  function showView(name, from) {
    if (name === 'home') { PHONE.home(); return; }
    if (!$('view-' + name)) return PHONE.home();
    store.set('hr:view', name);
    PHONE.show(name, from);
    if (name === 'code' && editor.layout) setTimeout(() => editor.layout(), 320);
    viewHooks.forEach((fn) => fn(name));
  }
  const viewHooks = [];

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
        quickSuggestions: { other: true, comments: false, strings: true }, quickSuggestionsDelay: 0, suggestOnTriggerCharacters: true,
        wordBasedSuggestions: 'off', tabCompletion: 'on',
        suggest: { filterGraceful: true, localityBonus: true, snippetsPreventQuickSuggestions: false, showWords: false, preview: true, selectionMode: 'always', insertMode: 'replace' },
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
  $('toBrowser').onclick = async () => { const u = await previewLink(); HR.openInBrowser(u); };
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
    else if (act === 'home') { window.HR.addCodeToHome && HR.addCodeToHome(); }
    else if (act === 'format') { if (ed) ed.getAction('editor.action.formatDocument').run(); else toast('Formatting needs the full editor'); }
  });

  /* ---------------- page server ----------------
     When it's on, the built-in browser and Home screen apps load websites through your own
     HTML Runner page server (server/server.js) instead of straight from each site. */
  const proxy = (function () {
    let cfg = store.get('hr:proxy', { on: false, url: '' });
    const clean = (u) => String(u || '').trim().replace(/\/+$/, '');
    const b64 = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unb64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); };
    const active = () => !!(cfg.on && cfg.url);
    function wrap(url) {
      if (!active() || !url) return url;
      let u; try { u = new URL(url); } catch (e) { return url; }
      if (!/^https?:$/.test(u.protocol) || u.origin === location.origin || url.startsWith(cfg.url + '/')) return url;
      return cfg.url + '/p/' + b64(u.origin) + u.pathname + u.search + u.hash;
    }
    function unwrap(url) {
      if (!cfg.url || !url || !String(url).startsWith(cfg.url + '/p/')) return null;
      const rest = String(url).slice(cfg.url.length + 3), i = rest.indexOf('/');
      try { const o = unb64(i < 0 ? rest : rest.slice(0, i)); return /^https?:\/\/[^/]+$/.test(o) ? o + (i < 0 ? '/' : rest.slice(i)) : null; } catch (e) { return null; }
    }
    async function test(url) {
      url = clean(url);
      let u; try { u = new URL(url); } catch (e) { throw new Error('That isn’t a full address. It should start with http:// or https://'); }
      if (location.protocol === 'https:' && u.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) {
        throw new Error('HTML Runner is on https, so the page server must be on https too (Chrome blocks http pages inside https ones).');
      }
      let r;
      try { r = await fetch(url + '/__hr/ping', { cache: 'no-store' }); } catch (e) { throw new Error('Couldn’t reach the server. Is it running, and is the address right?'); }
      if (r.status === 404) throw new Error('The server answered, but not as a page server. Check the address and the key (/k/…).');
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error('That address isn’t an HTML Runner page server.');
      return true;
    }
    function set(next) { cfg = { ...cfg, ...next, url: clean(next.url != null ? next.url : cfg.url) }; store.set('hr:proxy', cfg); changed(); }
    const hooks = [];
    function changed() { hooks.forEach((f) => f(cfg)); }
    // Running everything from server/server.js? It tells us where the page server is.
    if (!cfg.url && location.protocol.startsWith('http')) {
      fetch('hr-proxy.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (j && j.proxy && !cfg.url) set({ on: true, url: j.proxy });
      }).catch(() => {});
    }
    return { get: () => ({ ...cfg }), set, wrap, unwrap, active, test, onChange: (f) => hooks.push(f),
      host: () => { try { return new URL(cfg.url).host; } catch (e) { return ''; } } };
  })();

  function proxySheet() {
    const c = proxy.get();
    const wrap = document.createElement('div'); wrap.className = 'asheet';
    wrap.innerHTML = `
      <p class="hint" style="margin:0 0 10px">Your page server fetches websites for HTML Runner and sends them back, so the browser and your Home screen apps get every page from one address: your server. Start it with <code>node server/server.js</code> (see the README).</p>
      <label class="menu-check" style="padding:4px 0 10px"><input type="checkbox" id="pxOn"> Load web pages through my page server</label>
      <label class="field"><span>Page server address</span><input id="pxUrl" type="url" placeholder="https://your-server.example.com/k/your-key" spellcheck="false" autocapitalize="off"></label>
      <p class="hint" id="pxMsg" style="margin:8px 0 0"></p>`;
    const on = wrap.querySelector('#pxOn'), url = wrap.querySelector('#pxUrl'), msg = wrap.querySelector('#pxMsg');
    on.checked = c.on; url.value = c.url;
    const check = async () => {
      msg.textContent = 'Checking…';
      try { await proxy.test(url.value); msg.textContent = '✓ Connected to your page server.'; return true; }
      catch (e) { msg.textContent = e.message; return false; }
    };
    const close = sheet({ title: 'Page server', body: wrap, actions: [
      { label: 'Test', onClick: () => { check(); return true; } },
      { label: 'Cancel' },
      { label: 'Save', primary: true, onClick: () => {
        const want = on.checked;
        if (want && !url.value.trim()) { msg.textContent = 'Enter your page server’s address first.'; return true; }
        if (!want) { proxy.set({ on: false, url: url.value }); toast('Page server off'); return; }
        check().then((ok) => {
          if (!ok) return;
          proxy.set({ on: true, url: url.value }); toast('Pages now load through your server');
          close();
        });
        return true;
      } },
    ] });
  }

  /* ---------------- sites that refuse to be shown inside other apps ----------------
     These send a "don't show me inside another app" instruction, and Chrome / Android then shows
     "blocked by response" (ERR_BLOCKED_BY_RESPONSE). It has nothing to do with your IP address.
     YouTube videos have an official player made for showing inside other apps, so videos play through that.
     Everything else on these sites gets a screen with ways to open it full screen. */
  const NO_FRAME = ['youtube.com', 'google.com', 'gmail.com', 'facebook.com', 'instagram.com', 'threads.net', 'x.com', 'twitter.com',
    'tiktok.com', 'linkedin.com', 'netflix.com', 'amazon.com', 'paypal.com', 'github.com', 'twitch.tv', 'discord.com', 'whatsapp.com',
    'spotify.com', 'chatgpt.com', 'openai.com', 'microsoft.com', 'live.com', 'office.com', 'apple.com', 'icloud.com', 'pinterest.com',
    'snapchat.com', 'messenger.com', 'disneyplus.com', 'hulu.com', 'primevideo.com', 'ebay.com', 'claude.ai', 'roblox.com', 'chase.com',
    'bankofamerica.com', 'wellsfargo.com'];
  const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, ''); } catch (e) { return ''; } };
  const onSite = (h, d) => h === d || h.endsWith('.' + d);
  function youtubeVideo(url) {
    let u; try { u = new URL(url); } catch (e) { return null; }
    const h = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    let id = null;
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{6,})/); if (m) id = m[2]; }
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    const p = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', modestbranding: '1' });
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    if (t) { const m = String(t).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/); if (m) p.set('start', String((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0))); }
    if (u.searchParams.get('list')) p.set('list', u.searchParams.get('list'));
    return 'https://www.youtube-nocookie.com/embed/' + id + '?' + p;
  }
  /* What to do with an address: { embed } plays it in an official player, { blocked } shows the
     "open full screen" screen, null loads it normally (through the page server when that's on). */
  function siteRule(url) {
    const yt = youtubeVideo(url);
    if (yt) return { embed: yt, title: 'YouTube' };
    const h = hostOf(url);
    if (!h) return null;
    // YouTube checks server addresses and stops them as bots, so it never goes through the page server
    if (onSite(h, 'youtube.com') || onSite(h, 'youtu.be')) return { blocked: true, name: 'YouTube', youtube: true };
    const d = NO_FRAME.find((x) => onSite(h, x));
    if (d && !proxy.active()) return { blocked: true, name: d.replace(/\.\w+$/, '').replace(/^./, (c) => c.toUpperCase()) };
    return null;
  }
  function openFullScreen(url) {
    // Loads the site in the whole app window. In an app made from HTML Runner, the phone's Back button comes back here.
    toast('Opening ' + hostOf(url) + '… use Back to return');
    setTimeout(() => { location.href = url; }, 400);
  }
  function blockedCard(url, rule, opts = {}) {
    const div = document.createElement('div'); div.className = 'blocked';
    div.innerHTML = `<div class="blocked-in">
      <div class="bk-badge"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M4 9h16M9 13l6 4M15 13l-6 4"/></svg></div>
      <h2></h2>
      <p class="why"></p>
      <form class="bk-video" hidden><label class="field"><span>Play a YouTube video here</span>
        <input type="url" placeholder="Paste a video link (youtube.com/watch… or youtu.be/…)" spellcheck="false" autocapitalize="off"></label>
        <button class="btn run" type="submit">Play video</button></form>
      <div class="bk-actions">
        <button type="button" class="btn run big" data-a="full">Open full screen</button>
        <button type="button" class="btn big" data-a="chrome">Open in Chrome</button>
        <button type="button" class="btn ghost big" data-a="try" hidden>Try loading it here anyway</button>
      </div>
      <p class="hint">“Open full screen” loads the site in the whole window. Use your phone’s Back button to come back.</p>
    </div>`;
    div.querySelector('h2').textContent = rule.name + ' doesn’t open inside apps';
    div.querySelector('.why').textContent = rule.youtube
      ? 'YouTube sends a security header (X-Frame-Options) that stops its pages being shown inside other apps. That’s the “blocked by response” message, not your internet address. Videos still play here through YouTube’s own player.'
      : rule.name + ' sends a security header (X-Frame-Options) that stops its pages being shown inside other apps, so it would stay blank or say “blocked by response”. Open it full screen instead' + (proxy.get().url ? '.' : ', or turn on your page server in Settings.');
    div.querySelector('[data-a="full"]').onclick = () => openFullScreen(url);
    div.querySelector('[data-a="chrome"]').onclick = () => openInChrome(url);
    const tryBtn = div.querySelector('[data-a="try"]');
    if (opts.onTry) { tryBtn.hidden = false; tryBtn.onclick = opts.onTry; }
    const vf = div.querySelector('.bk-video');
    if (rule.youtube && opts.onVideo) {
      vf.hidden = false;
      vf.onsubmit = (e) => {
        e.preventDefault();
        const v = vf.querySelector('input').value.trim();
        if (!youtubeVideo(v)) return toast('That isn’t a YouTube video link');
        opts.onVideo(v);
      };
    }
    return div;
  }

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

  /* ---------------- installing HTML Runner itself ----------------
     Chrome sends "beforeinstallprompt" once per page load. A small script in <head> catches it
     before anything else loads (window.__hrInstall), so it can no longer be missed. */
  const IS = window.__hrInstall || { evt: null, installed: false, start: Date.now(), clicked: false, seen: 0 };
  const ready = () => !!IS.evt;
  function updateInstallButton() {
    const b = $('installApp');
    b.hidden = standalone || IS.installed || !ready();
    b.querySelector('b').textContent = ready() ? 'Install HTML Runner' : 'Install HTML Runner on this device';
    b.querySelector('small').textContent = ready() ? 'Opens full screen and works offline' : 'Tap to see what Chrome still needs';
    b.classList.toggle('ready', ready());
  }
  document.addEventListener('hr-installable', () => { updateInstallButton(); refreshCheck && refreshCheck(); });
  document.addEventListener('hr-installed', () => { updateInstallButton(); toast('HTML Runner is installed'); refreshCheck && refreshCheck(); });
  $('installApp').onclick = () => (ready() ? installSelf() : installCheck());
  updateInstallButton();

  async function installedPerChrome() {
    if (!navigator.getInstalledRelatedApps) return null;
    try { const apps = await navigator.getInstalledRelatedApps(); return apps.some((a) => a.platform === 'webapp'); } catch (e) { return null; }
  }

  /* Install check: live list of what Chrome needs before it lets you install */
  let swError = '', refreshCheck = null;
  async function installCheck() {
    let man = null, homeJs = false;
    try { man = await (await fetch('manifest.webmanifest', { cache: 'no-store' })).json(); } catch (e) {}
    try { const r = await fetch('home.js', { cache: 'no-store' }); homeJs = r.ok && /hr:apps/.test(await r.text()); } catch (e) {}
    const isChromium = !!window.chrome || /Chrome|Edg|SamsungBrowser/.test(UA);
    async function render() {
      const rows = [];
      const add = (ok, label, detail) => rows.push(`<li class="${ok === true ? 'ok' : ok === false ? 'bad' : 'warn'}"><b>${esc(label)}</b>${detail ? '<span>' + detail + '</span>' : ''}</li>`);
      add(location.protocol === 'https:' || location.hostname === 'localhost', 'Served over https',
        location.protocol === 'file:' ? 'Opened from a file. Upload the folder to a host (see README) and open its https address.' : esc(location.origin));
      add(!!(man && man.id), 'App manifest found', man ? 'App id: <code>' + esc(man.id) + '</code>' : 'manifest.webmanifest did not load. The files were not all uploaded, or the host serves a different app at this address.');
      add(homeJs, 'All app files uploaded', homeJs ? '' : 'home.js is missing or the host returns a different page for it.');
      const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
      add(!!(reg && reg.active), 'Offline support (service worker) running', reg && reg.active ? '' : (swError ? esc(swError) : 'Not running yet. Reload the page once.'));
      if (!isChromium) add(false, 'This browser can install apps', 'Use Chrome or Edge. Firefox on a computer and in-app browsers cannot install web apps.');
      if (standalone) { add(true, 'You are using the installed app', ''); return { rows, done: true }; }
      const inst = await installedPerChrome();
      if (inst === true || IS.installed) add(false, 'Chrome says HTML Runner is already installed on this device', 'If you can\'t find or open it, Chrome is keeping a record of an old copy. Follow the steps below.');
      const secs = Math.round(IS.seen + (document.hidden ? 0 : (Date.now() - IS.start) / 1000));
      const engaged = IS.clicked && secs >= 30;
      add(engaged || ready(), 'You tapped the page and used it for 30 seconds',
        engaged || ready() ? '' : `Chrome waits for this before it offers to install. ${IS.clicked ? 'Tapped ✓' : 'Tap anywhere'} · ${Math.min(secs, 30)} of 30 seconds.`);
      if (ready()) add(true, 'Chrome is ready to install', 'Tap Install below.');
      else if (engaged) add(false, 'Chrome is still not offering to install',
        'Everything Chrome asks for is in place, so Chrome believes a copy is already installed for this address, or it remembers you dismissed the install. Follow the steps below.');
      else add(null, 'Waiting for Chrome to offer the install', 'This turns green by itself. Keep this open.');
      return { rows, done: ready() };
    }
    const fixes = `<p><b>Chrome won't offer it, or says “already installed” but it won't open:</b></p>
      <ol><li>Phone: long-press every old HTML Runner icon and uninstall it, then check Android Settings → Apps for a leftover “HTML Runner”.</li>
      <li>Computer: open <code>chrome://apps</code>, right-click HTML Runner, choose <b>Remove from Chrome</b>.</li>
      <li>Close Chrome completely and open this address again.</li>
      <li>Still blocked? Chrome's old record covers this whole address. Put HTML Runner on a <b>new address</b> (README → “Fresh address”) and install from there. This always works.</li></ol>`;
    const draw = async () => {
      const { rows } = await render();
      const body = $('sheetBody'); if (!body || $('sheet').hidden || $('sheetTitle').textContent !== 'Install check') return false;
      body.innerHTML = `<ul class="checks">${rows.join('')}</ul>${ready() || standalone ? '' : fixes}`;
      const acts = $('sheetActions');
      if (ready() && !acts.querySelector('.run')) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn run'; b.textContent = 'Install';
        b.onclick = () => { $('sheet').hidden = true; installSelf(); }; acts.append(b);
      }
      return true;
    };
    sheet({ title: 'Install check', body: '<p>Checking…</p>', actions: [{ label: 'Close' }] });
    await draw();
    clearInterval(installCheck.t);
    refreshCheck = draw;
    installCheck.t = setInterval(async () => { if (!(await draw())) { clearInterval(installCheck.t); refreshCheck = null; } }, 1000);
  }

  async function installSelf() {
    if (IS.evt) {
      const e = IS.evt; IS.evt = null;
      e.prompt();
      const choice = await e.userChoice.catch(() => ({}));
      if (choice.outcome === 'dismissed') toast('Install cancelled. Chrome may wait a while before offering it again.');
      updateInstallButton();
      return;
    }
    installCheck();
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
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch((e) => { swError = 'Could not start: ' + (e && e.message || e); console.warn('Service worker failed', e); });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && mode === 'connected') { reloaded = true; run(); } });
  }

  const pendingOpen = [];
  /* ---------------- public API for the other files ---------------- */
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
    onView: (fn) => viewHooks.push(fn),
    buildPage, previewLink, installSelf, installSheet, installCheck,
    canServe: () => swActive() && 'caches' in window,
    openInBrowser: (url) => { pendingOpen.push(url); showView('browser'); }, // replaced by browser.js
    proxy, proxySheet, siteRule, blockedCard, openFullScreen, youtubeVideo, toUrlHost: hostOf,
    store, esc, isAndroid, isIOS, standalone: !!standalone,
    installState: () => ({ ready: ready(), installed: !!(standalone || IS.installed) }),
    pendingOpen: () => pendingOpen.splice(0),
    projectName: () => work.name,
  };

  /* ---------------- start ---------------- */
  initMonaco();
  run();
  // the first screen is shown by home.js once every part has loaded
})();
