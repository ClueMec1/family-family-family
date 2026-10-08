/* HTML Runner — AI assistant: many providers, live model lists, auto-switch when one runs out, AI autocomplete. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const HR = window.HR;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const PROVIDERS = [
    { id: 'puter', name: 'Puter — no key needed', kind: 'puter',
      note: 'Free to use with a Puter account. Your first message opens a Puter sign-in window. Gives access to models from OpenAI, Anthropic, Google, Meta, Mistral, xAI, DeepSeek and more.',
      fallback: ['gpt-4o-mini', 'claude-sonnet-4', 'gemini-2.5-flash'] },
    { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', publicModels: true,
      note: 'Free key. Models marked FREE cost nothing; free use has daily limits.', fallback: ['openrouter/auto'] },
    { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey',
      note: 'Free key from Google AI Studio with daily limits.', fallback: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
    { id: 'groq', name: 'Groq', base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys',
      note: 'Free key. Very fast open models.', fallback: ['llama-3.3-70b-versatile'] },
    { id: 'cerebras', name: 'Cerebras', base: 'https://api.cerebras.ai/v1', keyUrl: 'https://cloud.cerebras.ai/',
      note: 'Free key with a daily token allowance.', fallback: ['llama-3.3-70b'] },
    { id: 'mistral', name: 'Mistral', base: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys',
      note: 'Free “Experiment” plan. Codestral is their coding model.', fallback: ['mistral-small-latest', 'codestral-latest'] },
    { id: 'github', name: 'GitHub Models', base: 'https://models.github.ai/inference', modelsUrl: 'https://models.github.ai/catalog/models',
      keyUrl: 'https://github.com/settings/personal-access-tokens', note: 'Free with a GitHub token that has the “Models: read” permission.', fallback: ['openai/gpt-4.1-mini'] },
    { id: 'hf', name: 'Hugging Face', base: 'https://router.huggingface.co/v1', keyUrl: 'https://huggingface.co/settings/tokens',
      note: 'Free monthly credits with a Hugging Face token.', fallback: ['meta-llama/Llama-3.3-70B-Instruct'] },
    { id: 'nvidia', name: 'NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', keyUrl: 'https://build.nvidia.com/',
      note: 'Free key. NVIDIA may refuse requests made from a web page.', fallback: ['meta/llama-3.3-70b-instruct'] },
    { id: 'cohere', name: 'Cohere', base: 'https://api.cohere.ai/compatibility/v1', keyUrl: 'https://dashboard.cohere.com/api-keys',
      note: 'Free trial key, non-commercial use.', fallback: ['command-a-03-2025'] },
    { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys',
      note: 'New accounts get trial credit.', fallback: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'custom', name: 'Custom (any OpenAI-compatible)', base: '', custom: true,
      note: 'Any service with an OpenAI-style /chat/completions endpoint, including Ollama (http://localhost:11434/v1) or LM Studio on your computer.', fallback: [] },
  ];
  const byId = (id) => PROVIDERS.find((p) => p.id === id);

  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const S = Object.assign({ provider: 'puter', keys: {}, bases: {}, models: {}, freeOnly: true, autoSwitch: true }, load('hr:ai', {}));
  const saveS = () => save('hr:ai', S);
  let modelCache = load('hr:ai-models', {});
  let history = load('hr:chat', []);
  let busy = null;

  const P = () => byId(S.provider) || PROVIDERS[0];
  const baseOf = (p) => (p.custom ? (S.bases.custom || '').replace(/\/+$/, '') : p.base);
  const isReady = (p) => p.kind === 'puter' || (p.custom ? !!S.bases.custom : !!S.keys[p.id]);
  const modelOf = (p) => S.models[p.id] || (modelCache[p.id] && modelCache[p.id].list[0] && modelCache[p.id].list[0].id) || p.fallback[0] || '';

  /* ---------------- Puter loader ---------------- */
  let puterLoading = null;
  function loadPuter() {
    if (window.puter) return Promise.resolve(window.puter);
    if (!puterLoading) puterLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = () => (window.puter ? res(window.puter) : rej(new Error('Puter did not start')));
      s.onerror = () => { puterLoading = null; rej(new Error('Could not load Puter. Check your connection.')); };
      document.head.append(s);
    });
    return puterLoading;
  }

  /* ---------------- model lists ---------------- */
  async function fetchModels(p) {
    if (p.kind === 'puter') {
      const puter = await loadPuter();
      const list = await puter.ai.listModels();
      return list.map((m) => ({ id: m.id, name: m.name || m.id, by: m.provider || '', free: null }));
    }
    const base = baseOf(p);
    if (!base) throw new Error('Enter a base URL first.');
    const headers = {};
    if (S.keys[p.id]) headers.Authorization = 'Bearer ' + S.keys[p.id];
    else if (!p.publicModels) throw new Error('Add your API key to see this provider’s models.');
    const res = await fetch(p.modelsUrl || base + '/models', { headers });
    if (!res.ok) throw new Error(await errorText(res));
    const data = await res.json();
    const arr = Array.isArray(data) ? data : data.data || data.models || [];
    return arr.map((m) => {
      const id = String(m.id || m.name || '').replace(/^models\//, '');
      let free = null;
      if (m.pricing) free = Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
      if (/:free$/.test(id)) free = true;
      return { id, name: m.name && m.name !== m.id ? m.name : id, by: m.owned_by || m.publisher || '', free };
    }).filter((m) => m.id && !/embed|whisper|tts|guard|moderation|dall-e|imagen|veo|rerank/i.test(m.id))
      .sort((a, b) => (b.free === true) - (a.free === true) || a.id.localeCompare(b.id));
  }

  async function refreshModels(force) {
    const p = P();
    const cached = modelCache[p.id];
    if (!force && cached && Date.now() - cached.at < 6 * 3600e3) return renderModels();
    $('modelStatus').className = 'hint'; $('modelStatus').textContent = 'Loading models…';
    try {
      const list = await fetchModels(p);
      modelCache[p.id] = { at: Date.now(), list }; save('hr:ai-models', modelCache);
      $('modelStatus').textContent = list.length + ' models available.';
    } catch (e) {
      $('modelStatus').className = 'hint err';
      $('modelStatus').textContent = 'Could not load the model list: ' + friendly(e) + ' You can still type a model name in the filter box and pick it.';
    }
    renderModels();
  }

  function renderModels() {
    const p = P(), box = $('modelList'), q = $('modelSearch').value.trim().toLowerCase();
    let list = (modelCache[p.id] && modelCache[p.id].list) || p.fallback.map((id) => ({ id, name: id, by: '', free: null }));
    const pricesKnown = list.some((m) => m.free !== null);
    if (S.freeOnly && pricesKnown) list = list.filter((m) => m.free !== false);
    if (q) list = list.filter((m) => (m.id + ' ' + m.name + ' ' + m.by).toLowerCase().includes(q));
    const sel = modelOf(p);
    box.innerHTML = '';
    list.slice(0, 400).forEach((m) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(m.id === sel));
      b.innerHTML = `<b></b><small>${m.free === true ? '<span class="tag">FREE</span> · ' : ''}${esc(m.by ? m.by + ' · ' : '')}${esc(m.id)}</small>`;
      b.querySelector('b').textContent = m.name;
      b.onclick = () => pickModel(m.id);
      box.append(b);
    });
    if (q && !list.some((m) => m.id.toLowerCase() === q)) {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `<b>Use “${esc($('modelSearch').value.trim())}”</b><small>Type an exact model name the provider accepts</small>`;
      b.onclick = () => pickModel($('modelSearch').value.trim());
      box.append(b);
    }
    if (!box.children.length) box.innerHTML = '<p class="hint" style="padding:8px">No models match. Clear the filter or untick “Free models only”.</p>';
    updateHeader();
  }
  function pickModel(id) {
    S.models[S.provider] = id; saveS(); renderModels();
    $('aiSide').classList.remove('open');
  }
  function updateHeader() {
    const p = P();
    $('currentModel').textContent = (p.kind === 'puter' ? 'Puter' : p.name) + ' · ' + (modelOf(p) || 'choose a model');
  }

  /* ---------------- provider panel ---------------- */
  const sel = $('provider');
  PROVIDERS.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.append(o); });
  function showProvider() {
    const p = P();
    sel.value = p.id;
    $('providerNote').textContent = p.note;
    $('keyField').hidden = p.kind === 'puter';
    $('apiKey').value = S.keys[p.id] || '';
    $('apiKey').placeholder = p.custom ? 'Key (leave empty if not needed)' : 'Paste your ' + p.name + ' key';
    $('keyLink').hidden = !p.keyUrl; if (p.keyUrl) $('keyLink').href = p.keyUrl;
    $('baseField').hidden = !p.custom; $('baseUrl').value = S.bases.custom || '';
    $('modelSearch').value = '';
    $('modelStatus').textContent = '';
    refreshModels(false);
  }
  sel.onchange = () => { S.provider = sel.value; saveS(); showProvider(); };
  let keyT;
  $('apiKey').oninput = () => { S.keys[S.provider] = $('apiKey').value.trim(); saveS(); clearTimeout(keyT); keyT = setTimeout(() => refreshModels(true), 800); };
  $('baseUrl').oninput = () => { S.bases.custom = $('baseUrl').value.trim(); saveS(); clearTimeout(keyT); keyT = setTimeout(() => refreshModels(true), 800); };
  $('modelSearch').oninput = renderModels;
  $('refreshModels').onclick = () => refreshModels(true);
  $('freeOnly').checked = S.freeOnly; $('freeOnly').onchange = () => { S.freeOnly = $('freeOnly').checked; saveS(); renderModels(); };
  $('autoSwitch').checked = S.autoSwitch; $('autoSwitch').onchange = () => { S.autoSwitch = $('autoSwitch').checked; saveS(); };
  $('aiSideToggle').onclick = () => $('aiSide').classList.toggle('open');

  /* ---------------- calling models ---------------- */
  async function errorText(res) {
    let t = ''; try { t = await res.text(); const j = JSON.parse(t); t = (j.error && (j.error.message || j.error)) || j.message || t; } catch (e) {}
    const err = String(t || res.statusText).slice(0, 300);
    return res.status + ' ' + err;
  }
  function friendly(e) {
    const m = (e && e.message) || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'The request was blocked or the network is down (some providers refuse requests from web pages).';
    return m;
  }
  const isQuota = (e) => e && (e.status === 429 || e.status === 402 || /quota|rate.?limit|insufficient|credits|exceeded|too many requests|limit reached/i.test(e.message || ''));
  const isNetwork = (e) => e && /Failed to fetch|NetworkError|Load failed|blocked/i.test(e.message || '');

  /** Streams a reply. onText(fullTextSoFar). Returns the full text. */
  async function callModel(p, model, messages, { onText, signal, maxTokens, stream = true } = {}) {
    if (!model) throw new Error('Choose a model first.');
    if (p.kind === 'puter') {
      const puter = await loadPuter();
      if (!stream) {
        const r = await puter.ai.chat(messages, { model, max_tokens: maxTokens });
        return textOf(r);
      }
      const resp = await puter.ai.chat(messages, { model, stream: true, max_tokens: maxTokens });
      let text = '';
      for await (const part of resp) {
        if (signal && signal.aborted) break;
        if (part && part.text) { text += part.text; onText && onText(text); }
      }
      return text;
    }
    const base = baseOf(p);
    if (!base) throw new Error('Enter a base URL for the custom provider.');
    if (!S.keys[p.id] && !p.custom) throw new Error('Add your ' + p.name + ' key first.');
    const headers = { 'Content-Type': 'application/json' };
    if (S.keys[p.id]) headers.Authorization = 'Bearer ' + S.keys[p.id];
    if (p.id === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'HTML Runner'; }
    const body = { model, messages, stream };
    if (maxTokens) body.max_tokens = maxTokens;
    const res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!res.ok) { const e = new Error(await errorText(res)); e.status = res.status; throw e; }
    if (!stream || !res.body) { const j = await res.json(); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (d === '[DONE]') continue;
        try {
          const j = JSON.parse(d);
          if (j.error) { const e = new Error(j.error.message || JSON.stringify(j.error)); e.status = j.error.code; throw e; }
          const piece = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (piece) { text += piece; onText && onText(text); }
        } catch (e) { if (e.status || /quota|limit/i.test(e.message)) throw e; }
      }
    }
    return text;
  }
  function textOf(r) {
    if (typeof r === 'string') return r;
    const c = r && r.message && r.message.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((x) => x.text || '').join('');
    return r && r.text ? r.text : String(r || '');
  }

  /* ---------------- chat UI ---------------- */
  const SYSTEM = `You are the coding assistant inside HTML Runner, a web playground with three files: index.html, style.css and script.js.
When you write code, put each file in its own fenced code block labeled html, css or js, and give complete file contents unless the user asks for a snippet.
script.js is loaded at the end of the body (as a module if it uses import). Keep explanations short and practical.`;

  function codeContext() {
    const f = HR.getFiles();
    return `My current project:\n\n\`\`\`html\n${f.html}\n\`\`\`\n\n\`\`\`css\n${f.css}\n\`\`\`\n\n\`\`\`js\n${f.js}\n\`\`\``;
  }

  const LANGFILE = (l) => (/^(html?|xml|svg|xhtml)$/i.test(l) ? 'html' : /^(css|scss)$/i.test(l) ? 'css' : /^(js|javascript|mjs|jsx|ts|typescript)$/i.test(l) ? 'js' : null);
  function guessFile(code) {
    if (/<\/?[a-z][\s\S]*>/i.test(code) && /<(html|body|div|head|main|section|!doctype)/i.test(code)) return 'html';
    if (/^[\s\S]*[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(code) && !/function|=>|const |let /.test(code)) return 'css';
    return 'js';
  }

  function renderText(t) {
    return t.split(/\n{2,}/).map((para) => {
      let h = esc(para)
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/^#{1,6}\s+(.*)$/gm, '<b>$1</b>')
        .replace(/\n/g, '<br>');
      return h ? `<p>${h}</p>` : '';
    }).join('');
  }

  function renderBody(el, text, final) {
    el.innerHTML = '';
    const parts = text.split(/```/);
    const blocks = [];
    parts.forEach((part, i) => {
      if (i % 2 === 0) { if (part.trim()) el.insertAdjacentHTML('beforeend', renderText(part)); return; }
      const nl = part.indexOf('\n');
      const lang = nl >= 0 ? part.slice(0, nl).trim() : '';
      const code = (nl >= 0 ? part.slice(nl + 1) : part).replace(/\n$/, '');
      const file = LANGFILE(lang) || guessFile(code);
      blocks.push({ file, code });
      const box = document.createElement('div'); box.className = 'codeblock';
      box.innerHTML = `<div class="cb-head"><span class="lang">${esc(lang || HR.FILES[file])}</span>
        <button type="button" data-a="copy">Copy</button>
        <button type="button" data-a="insert">Insert at cursor</button>
        <button type="button" data-a="use">Use as ${HR.FILES[file]}</button></div><pre></pre>`;
      box.querySelector('pre').textContent = code;
      box.querySelector('.cb-head').onclick = (e) => {
        const a = e.target.dataset && e.target.dataset.a; if (!a) return;
        if (a === 'copy') navigator.clipboard.writeText(code).then(() => HR.toast('Copied'), () => HR.toast('Could not copy'));
        if (a === 'insert') { HR.showCode(); HR.insertAtCursor(code); HR.toast('Inserted'); }
        if (a === 'use') { HR.setFile(file, code); HR.showCode(file); HR.run(); HR.toast('Updated ' + HR.FILES[file]); }
      };
      el.append(box);
    });
    if (final && blocks.length > 1) {
      const files = {}; blocks.forEach((b) => { if (!files[b.file]) files[b.file] = b.code; });
      if (Object.keys(files).length > 1) {
        const b = document.createElement('button'); b.className = 'btn run'; b.type = 'button';
        b.textContent = 'Use all ' + Object.keys(files).length + ' files and run';
        b.onclick = () => { for (const k in files) HR.setFile(k, files[k]); HR.showCode('html'); HR.run(); HR.toast('Project updated'); };
        el.append(b);
      }
    }
  }

  function addMsg(role, text, extra) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    wrap.innerHTML = `<div class="who">${role === 'user' ? 'You' : esc(extra || 'Assistant')}</div><div class="body"></div>`;
    const body = wrap.querySelector('.body');
    if (role === 'user') body.innerHTML = renderText(text); else if (role === 'error') body.textContent = text; else renderBody(body, text, true);
    const w = $('messages').querySelector('.welcome'); if (w) w.remove();
    $('messages').append(wrap);
    $('messages').scrollTop = $('messages').scrollHeight;
    return wrap;
  }

  function welcome() {
    $('messages').innerHTML = `<div class="welcome"><h2>Ask for code, fixes or ideas</h2>
      <p>Replies with code get buttons to drop it straight into your project. Pick a provider and model on the left. If one runs out, switch to another.</p>
      <div class="chips"></div></div>`;
    const chips = $('messages').querySelector('.chips');
    ['Make a to-do app that saves to localStorage', 'Add a dark mode toggle to my page', 'Find bugs in my code', 'Connect my page to Firebase Firestore', 'Turn my page into an installable PWA']
      .forEach((t) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = () => { $('prompt').value = t; send(); }; chips.append(b); });
  }
  function restore() {
    if (!history.length) return welcome();
    $('messages').innerHTML = '';
    history.forEach((m) => addMsg(m.role === 'user' ? 'user' : 'assistant', m.display || m.content, m.model));
  }

  function nextReady(after) {
    const i = PROVIDERS.findIndex((p) => p.id === after.id);
    for (let k = 1; k < PROVIDERS.length; k++) { const p = PROVIDERS[(i + k) % PROVIDERS.length]; if (isReady(p)) return p; }
    return null;
  }

  async function send() {
    if (busy) { busy.abort(); return; }
    const text = $('prompt').value.trim();
    if (!text) return;
    $('prompt').value = ''; autosize();
    const content = $('withCode').checked ? codeContext() + '\n\n' + text : text;
    history.push({ role: 'user', content, display: text });
    addMsg('user', text);

    const ctrl = new AbortController(); busy = ctrl;
    $('send').textContent = 'Stop';
    let p = P(), tried = new Set();
    let out = null;
    const view = addMsg('assistant', '', (p.kind === 'puter' ? 'Puter' : p.name) + ' · ' + modelOf(p));
    const body = view.querySelector('.body');
    body.innerHTML = '<p style="color:var(--muted)">Thinking…</p>';
    const msgs = () => [{ role: 'system', content: SYSTEM }, ...history.slice(-16).map((m) => ({ role: m.role, content: m.content }))];

    for (;;) {
      tried.add(p.id);
      try {
        let raf = 0, latest = '';
        const full = await callModel(p, modelOf(p), msgs(), {
          signal: ctrl.signal,
          onText: (t) => { latest = t; if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderBody(body, latest, false); $('messages').scrollTop = $('messages').scrollHeight; }); },
        });
        cancelAnimationFrame(raf);
        out = { text: full || '(No reply)', p };
        break;
      } catch (e) {
        if (ctrl.signal.aborted) { out = { text: body.textContent ? '' : '(Stopped)', p, stopped: true }; break; }
        const next = S.autoSwitch && (isQuota(e) || isNetwork(e)) ? nextReady(p) : null;
        if (next && !tried.has(next.id)) {
          const note = document.createElement('div'); note.className = 'note';
          note.textContent = `${p.kind === 'puter' ? 'Puter' : p.name} failed (${friendly(e).slice(0, 120)}). Switching to ${next.kind === 'puter' ? 'Puter' : next.name}…`;
          view.insertBefore(note, body);
          p = next; S.provider = next.id; saveS(); showProvider();
          view.querySelector('.who').textContent = (p.kind === 'puter' ? 'Puter' : p.name) + ' · ' + modelOf(p);
          continue;
        }
        view.className = 'msg error';
        body.textContent = friendly(e) + (isQuota(e) ? ' This provider has run out for now. Pick another provider on the left.' : '');
        if (!isReady(p)) body.textContent += ' Add a key for this provider, or choose Puter, which needs none.';
        break;
      }
    }
    if (out && !out.stopped) {
      renderBody(body, out.text, true);
      history.push({ role: 'assistant', content: out.text, model: (out.p.kind === 'puter' ? 'Puter' : out.p.name) + ' · ' + modelOf(out.p) });
    } else if (out && out.stopped && body.textContent.trim()) {
      history.push({ role: 'assistant', content: body.textContent, model: 'stopped' });
    }
    if (view.className === 'msg error') history.pop();
    save('hr:chat', history.slice(-40));
    busy = null; $('send').textContent = 'Send';
  }

  $('composer').onsubmit = (e) => { e.preventDefault(); send(); };
  function autosize() { const t = $('prompt'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }
  $('prompt').oninput = autosize;
  $('prompt').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(max-width:820px)').matches) { e.preventDefault(); send(); } };
  $('clearChat').onclick = () => { history = []; save('hr:chat', history); welcome(); };

  HR.askAI = (code, file) => {
    HR.showView('ai');
    $('withCode').checked = false;
    $('prompt').value = `Explain this code from ${file} and point out any bugs:\n\n\`\`\`\n${code}\n\`\`\``;
    autosize(); send();
  };

  /* ---------------- AI autocomplete (ghost text in the editor) ---------------- */
  $('aiComplete').checked = load('hr:aicomplete', false);
  $('aiComplete').onchange = () => { save('hr:aicomplete', $('aiComplete').checked); if ($('aiComplete').checked) HR.toast('AI autocomplete on. Pause while typing to see a suggestion, press Tab to accept.'); };

  HR.whenEditor((monaco) => {
    const provider = {
      async provideInlineCompletions(model, position, context, token) {
        if (!$('aiComplete').checked || busy) return { items: [] };
        await sleep(650);
        if (token.isCancellationRequested) return { items: [] };
        const full = model.getValue(), off = model.getOffsetAt(position);
        const before = full.slice(Math.max(0, off - 3000), off), after = full.slice(off, off + 800);
        if (!before.trim()) return { items: [] };
        const ctrl = new AbortController();
        token.onCancellationRequested(() => ctrl.abort());
        try {
          let text = await callModel(P(), modelOf(P()), [
            { role: 'system', content: 'You are a code completion engine. Reply with ONLY the code that belongs at <CURSOR>. No explanation, no markdown fences. Finish the current line or block, at most 8 lines. Reply with nothing if no completion fits.' },
            { role: 'user', content: `Language: ${model.getLanguageId()}\n\n${before}<CURSOR>${after}` },
          ], { signal: ctrl.signal, maxTokens: 160, stream: false });
          if (token.isCancellationRequested) return { items: [] };
          text = String(text || '').replace(/^```[\w-]*\n?/, '').replace(/\n?```\s*$/, '').replace(/<CURSOR>/g, '');
          if (!text.trim()) return { items: [] };
          return { items: [{ insertText: text, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
        } catch (e) { return { items: [] }; }
      },
      freeInlineCompletions() {},
      disposeInlineCompletions() {},
    };
    ['html', 'css', 'javascript'].forEach((l) => monaco.languages.registerInlineCompletionsProvider(l, provider));
  });

  showProvider();
  restore();
})();
