/* HTML Runner — Smart suggestions. Runs fully on the device: no AI, no internet, no limits.
   Knows HTML, CSS and JavaScript, reads your own files for ids, classes and names,
   fixes typos, and learns which suggestions you pick most. */
(function () {
  'use strict';
  const HR = window.HR;
  const W = (s) => s.trim().split(/\s+/);

  /* ================= word lists (most common first) ================= */
  const VOID = new Set(W('area base br col embed hr img input link meta source track wbr'));
  const TAGS = W(`div button span p a img input h1 h2 h3 ul li section main header footer nav form label script style link meta
    textarea select option table tr td th thead tbody br hr strong em i b small h4 h5 h6 ol article aside figure figcaption
    video audio source canvas svg iframe details summary dialog template slot picture code pre blockquote time mark
    title head body html fieldset legend datalist output progress meter abbr cite q sub sup kbd var dl dt dd caption colgroup col
    tfoot noscript object embed track wbr area map address search menu u s del ins ruby rt rp bdi bdo data base`);
  const TAG_SNIP = {
    a: '<a href="${1}">${0}</a>', img: '<img src="${1}" alt="${2}">', input: '<input type="${1:text}" id="${2}">',
    link: '<link rel="stylesheet" href="${1:style.css}">', script: '<script src="${1:script.js}"></script>',
    meta: '<meta name="${1}" content="${2}">', button: '<button id="${1}">${0}</button>', form: '<form id="${1}">\n\t${0}\n</form>',
    label: '<label for="${1}">${0}</label>', select: '<select id="${1}">\n\t<option value="${2}">${0}</option>\n</select>',
    option: '<option value="${1}">${0}</option>', ul: '<ul>\n\t<li>${0}</li>\n</ul>', ol: '<ol>\n\t<li>${0}</li>\n</ol>',
    table: '<table>\n\t<tr>\n\t\t<td>${0}</td>\n\t</tr>\n</table>', video: '<video src="${1}" controls></video>',
    audio: '<audio src="${1}" controls></audio>', iframe: '<iframe src="${1}"></iframe>', textarea: '<textarea id="${1}">${0}</textarea>',
    canvas: '<canvas id="${1}" width="${2:300}" height="${3:150}"></canvas>', style: '<style>\n\t${0}\n</style>',
    div: '<div class="${1}">${0}</div>', section: '<section>\n\t${0}\n</section>',
  };
  const GLOBAL_ATTRS = W(`class id style onclick title hidden tabindex role data- aria-label lang dir draggable contenteditable
    onchange oninput onsubmit onload onkeydown onkeyup onmouseover onmouseout onfocus onblur spellcheck translate autofocus inert popover`);
  const TAG_ATTRS = {
    a: W('href target rel download'), img: W('src alt width height loading decoding srcset sizes'),
    input: W('type name value placeholder required disabled checked min max step maxlength minlength pattern readonly autocomplete list accept multiple size'),
    button: W('type disabled name value form popovertarget'), form: W('action method autocomplete novalidate enctype'),
    label: W('for'), select: W('name multiple required disabled size'), option: W('value selected disabled label'),
    textarea: W('name rows cols placeholder required disabled readonly maxlength wrap'),
    script: W('src type defer async crossorigin integrity nomodule'), link: W('rel href type sizes media crossorigin as'),
    meta: W('name content charset http-equiv property'), video: W('src controls autoplay muted loop poster playsinline preload width height'),
    audio: W('src controls autoplay muted loop preload'), source: W('src type srcset media'), iframe: W('src width height allow allowfullscreen loading name sandbox referrerpolicy'),
    canvas: W('width height'), td: W('colspan rowspan headers'), th: W('colspan rowspan scope'), ol: W('start reversed type'),
    details: W('open name'), dialog: W('open'), progress: W('value max'), meter: W('value min max low high optimum'), time: W('datetime'),
    html: W('lang'), col: W('span'), track: W('src kind srclang label default'),
  };
  const ATTR_VALUES = {
    type: W('text button submit email password number checkbox radio range date file color search tel url hidden reset time module'),
    target: W('_blank _self _parent _top'), rel: W('stylesheet icon manifest noopener noreferrer preconnect apple-touch-icon'),
    method: W('post get dialog'), loading: W('lazy eager'), autocomplete: W('off on email username current-password new-password name tel'),
    dir: W('ltr rtl auto'), preload: W('none metadata auto'), crossorigin: W('anonymous use-credentials'), decoding: W('async sync auto'),
    name: W('viewport description theme-color author'), charset: W('utf-8'), role: W('button dialog navigation main banner list listitem alert tab tabpanel'),
    content: W('width=device-width, initial-scale=1').map((x) => x.replace(' ', ' ')),
    lang: W('en es fr de he ar zh ja'), wrap: W('soft hard'), kind: W('subtitles captions chapters'),
  };
  const CSS_PROPS = W(`display color background background-color margin padding width height font-size font-weight border border-radius
    position top left right bottom flex justify-content align-items gap grid-template-columns text-align font-family cursor
    transition transform opacity box-shadow overflow z-index max-width min-height line-height flex-direction flex-wrap
    margin-top margin-bottom margin-left margin-right padding-top padding-bottom padding-left padding-right min-width max-height
    background-image background-size background-position background-repeat border-color border-width border-style border-top border-bottom
    border-left border-right outline text-decoration text-transform letter-spacing white-space word-break overflow-wrap
    overflow-x overflow-y visibility content list-style animation animation-name animation-duration filter backdrop-filter
    grid-template-rows grid-column grid-row grid-area place-items align-self justify-self align-content flex-grow flex-shrink flex-basis
    order inset aspect-ratio object-fit object-position pointer-events user-select box-sizing font-style text-shadow vertical-align
    fill stroke resize scroll-behavior accent-color caret-color appearance column-gap row-gap clip-path mix-blend-mode
    will-change touch-action text-overflow font-variant-numeric text-wrap container-type outline-offset`);
  const CSS_VALUES = {
    display: W('flex grid block inline-block none inline contents inline-flex inline-grid table'), position: W('relative absolute fixed sticky static'),
    'justify-content': W('center space-between space-around space-evenly flex-start flex-end start end stretch'),
    'align-items': W('center flex-start flex-end stretch baseline start end'), 'align-self': W('center flex-start flex-end stretch auto'),
    'flex-direction': W('column row column-reverse row-reverse'), 'flex-wrap': W('wrap nowrap wrap-reverse'), 'text-align': W('center left right justify start end'),
    cursor: W('pointer default text move not-allowed grab wait crosshair'), overflow: W('hidden auto scroll visible clip'),
    'font-weight': W('bold normal 400 500 600 700 800 lighter bolder'), 'box-sizing': W('border-box content-box'),
    'object-fit': W('cover contain fill none scale-down'), 'white-space': W('nowrap normal pre pre-wrap pre-line'),
    'text-decoration': W('none underline line-through overline'), 'text-transform': W('uppercase lowercase capitalize none'),
    visibility: W('visible hidden collapse'), 'pointer-events': W('none auto'), 'user-select': W('none auto text all'),
    'font-style': W('italic normal oblique'), 'list-style': W('none disc decimal circle square'), 'border-style': W('solid dashed dotted none double'),
    'background-size': W('cover contain auto'), 'background-repeat': W('no-repeat repeat repeat-x repeat-y'), 'place-items': W('center start end stretch'),
    'grid-template-columns': W('repeat(auto-fill,minmax(200px,1fr)) 1fr 1fr repeat(3,1fr)').map((x) => x.replace(/ /g, ' ')),
    'font-family': W('system-ui sans-serif serif monospace inherit'), resize: W('none both vertical horizontal'),
    'scroll-behavior': W('smooth auto'), 'word-break': W('break-word break-all keep-all normal'), appearance: W('none auto'),
  };
  const CSS_GENERIC = W('auto none inherit initial unset 0 100% 1fr transparent currentColor center var() calc() rgba() hsl() linear-gradient() min() max() clamp() white black red blue green gray important');
  const CSS_PSEUDO = W('hover focus active focus-visible first-child last-child nth-child() not() before after disabled checked placeholder root is() where() has() focus-within visited');
  const CSS_AT = W('media keyframes import font-face supports container layer');
  const JS_KEYWORDS = W(`const let function return if else for while await async new this true false null undefined class import export from
    try catch finally throw switch case break continue default typeof instanceof of in do delete yield extends super static get set void`);
  const JS_GLOBALS = W(`document console window fetch setTimeout setInterval clearTimeout clearInterval localStorage sessionStorage JSON Math
    Array Object String Number Boolean Date Promise Map Set Error RegExp parseInt parseFloat isNaN alert confirm prompt navigator location
    history requestAnimationFrame cancelAnimationFrame URL URLSearchParams FormData Blob File FileReader Image Audio AbortController
    structuredClone queueMicrotask crypto performance Intl Symbol BigInt WeakMap WeakSet Proxy Reflect globalThis encodeURIComponent
    decodeURIComponent atob btoa CustomEvent Event KeyboardEvent MouseEvent IntersectionObserver ResizeObserver MutationObserver
    WebSocket Worker Notification matchMedia getComputedStyle innerWidth innerHeight scrollTo addEventListener removeEventListener`);
  const MEMBERS = {
    console: W('log error warn info table clear dir time timeEnd group groupEnd count assert'),
    document: W(`getElementById querySelector querySelectorAll createElement body head title addEventListener documentElement
      getElementsByClassName getElementsByTagName createTextNode activeElement cookie forms images readyState
      createDocumentFragment removeEventListener hidden visibilityState fonts`),
    Math: W('random floor round ceil max min abs PI sqrt pow sin cos tan atan2 sign trunc hypot log exp clamp'),
    JSON: W('stringify parse'), localStorage: W('getItem setItem removeItem clear key length'),
    sessionStorage: W('getItem setItem removeItem clear key length'), Object: W('keys values entries assign freeze fromEntries create defineProperty'),
    Array: W('from isArray of'), Number: W('isInteger isNaN parseFloat parseInt MAX_SAFE_INTEGER EPSILON'), Promise: W('all race allSettled any resolve reject'),
    Date: W('now parse UTC'), window: W('addEventListener location innerWidth innerHeight scrollTo open localStorage requestAnimationFrame matchMedia setTimeout'),
    navigator: W('clipboard userAgent language onLine geolocation serviceWorker share vibrate mediaDevices'),
    location: W('href reload assign replace pathname search hash origin host'), String: W('fromCharCode raw'), crypto: W('randomUUID getRandomValues subtle'),
  };
  const MEMBERS_ANY = W(`addEventListener textContent innerHTML value style classList appendChild append remove setAttribute getAttribute
    querySelector querySelectorAll length push map filter forEach find includes indexOf join split slice splice reduce sort reverse
    toString trim toUpperCase toLowerCase replace replaceAll startsWith endsWith then catch finally json text add toggle contains
    focus blur click checked disabled src href id className dataset children parentElement nextElementSibling previousElementSibling
    closest matches insertAdjacentHTML removeChild replaceWith before after prepend getBoundingClientRect scrollIntoView
    offsetWidth offsetHeight clientWidth clientHeight scrollTop width height getContext fillRect fillStyle strokeStyle beginPath arc
    fill stroke moveTo lineTo clearRect drawImage fillText font toFixed padStart padEnd at some every findIndex flat flatMap concat
    keys values entries has get set delete size preventDefault stopPropagation target key code currentTarget clientX clientY
    play pause currentTime duration volume muted reset submit files result readAsDataURL readAsText ok status headers body
    showModal close open hidden tagName nodeName firstElementChild lastElementChild cloneNode removeAttribute toggleAttribute hasAttribute`);
  const DOM_EVENTS = W(`click input change submit keydown keyup load DOMContentLoaded mouseover mouseout mouseenter mouseleave focus blur
    scroll resize touchstart touchend touchmove pointerdown pointerup pointermove dblclick contextmenu wheel animationend
    transitionend error message beforeunload visibilitychange online offline paste copy dragstart drop dragover`);
  const JS_SNIPPETS = [
    ['log', 'console.log(${0});', 'console.log()'],
    ['gid', "document.getElementById('${1}')", 'getElementById'],
    ['qs', "document.querySelector('${1}')", 'querySelector'],
    ['qsa', "document.querySelectorAll('${1}')", 'querySelectorAll'],
    ['ael', "addEventListener('${1:click}', (e) => {\n\t${0}\n});", 'addEventListener'],
    ['fn', 'function ${1:name}(${2}) {\n\t${0}\n}', 'function'],
    ['afn', '(${1}) => {\n\t${0}\n}', 'arrow function'],
    ['if', 'if (${1}) {\n\t${0}\n}', 'if block'],
    ['ife', 'if (${1}) {\n\t${2}\n} else {\n\t${0}\n}', 'if / else'],
    ['for', 'for (let ${1:i} = 0; ${1:i} < ${2:items}.length; ${1:i}++) {\n\t${0}\n}', 'for loop'],
    ['forof', 'for (const ${1:item} of ${2:items}) {\n\t${0}\n}', 'for…of loop'],
    ['foreach', '${1:items}.forEach((${2:item}) => {\n\t${0}\n});', 'forEach'],
    ['try', 'try {\n\t${1}\n} catch (err) {\n\tconsole.error(err);\n}', 'try / catch'],
    ['fetchjson', "const res = await fetch('${1}');\nconst data = await res.json();\n${0}", 'fetch JSON'],
    ['timeout', 'setTimeout(() => {\n\t${0}\n}, ${1:1000});', 'setTimeout'],
    ['interval', 'setInterval(() => {\n\t${0}\n}, ${1:1000});', 'setInterval'],
    ['class', 'class ${1:Name} {\n\tconstructor(${2}) {\n\t\t${0}\n\t}\n}', 'class'],
    ['lsget', "JSON.parse(localStorage.getItem('${1}') || '${2:null}')", 'read localStorage'],
    ['lsset', "localStorage.setItem('${1}', JSON.stringify(${2}));", 'save localStorage'],
    ['import', "import { ${2} } from '${1}';", 'import'],
  ];
  const CSS_SNIPPETS = [
    ['center', 'display: flex;\njustify-content: center;\nalign-items: center;', 'center with flex'],
    ['media', '@media (max-width: ${1:600px}) {\n\t${0}\n}', '@media'],
    ['keyframes', '@keyframes ${1:name} {\n\tfrom { ${2} }\n\tto { ${0} }\n}', '@keyframes'],
    ['grid', 'display: grid;\ngrid-template-columns: repeat(${1:3}, 1fr);\ngap: ${2:16px};', 'grid layout'],
  ];

  /* ================= learning ================= */
  let learned = {};
  try { learned = JSON.parse(localStorage.getItem('hr:learn') || '{}') || {}; } catch (e) {}
  let saveT = 0;
  function learn(word, n) {
    if (!word || word.length < 2 || word.length > 40) return;
    learned[word] = (learned[word] || 0) + (n || 1);
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const top = Object.entries(learned).sort((a, b) => b[1] - a[1]).slice(0, 1500);
      learned = Object.fromEntries(top);
      try { localStorage.setItem('hr:learn', JSON.stringify(learned)); } catch (e) {}
    }, 800);
  }

  /* ================= your project ================= */
  let proj = { ids: [], classes: [], jsWords: [], htmlWords: [], cssVars: [] };
  function uniq(a) { return [...new Set(a)]; }
  function indexProject(files) {
    const html = files.html || '', css = files.css || '', js = files.js || '';
    const styleBlocks = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    const scriptBlocks = (html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');
    const allCss = css + '\n' + styleBlocks, allJs = js + '\n' + scriptBlocks;
    const ids = [], classes = [];
    html.replace(/\sid\s*=\s*["']([^"']+)["']/gi, (_, v) => ids.push(v.trim()));
    html.replace(/\sclass\s*=\s*["']([^"']+)["']/gi, (_, v) => classes.push(...v.split(/\s+/).filter(Boolean)));
    allCss.replace(/#([a-zA-Z_][\w-]*)(?=[^}]*\{)/g, (_, v) => ids.push(v));
    allCss.replace(/\.([a-zA-Z_][\w-]*)(?=[^}]*\{)/g, (_, v) => classes.push(v));
    allJs.replace(/getElementById\(\s*['"`]([\w-]+)/g, (_, v) => ids.push(v));
    allJs.replace(/classList\.(?:add|toggle|remove|contains)\(\s*['"`]([\w-]+)/g, (_, v) => classes.push(v));
    allJs.replace(/querySelector(?:All)?\(\s*['"`]([^'"`]+)/g, (_, sel) => {
      sel.replace(/#([\w-]+)/g, (__, v) => ids.push(v)); sel.replace(/\.([a-zA-Z_][\w-]*)/g, (__, v) => classes.push(v));
    });
    const jsWords = (allJs.replace(/\/\/.*$/gm, '').match(/[A-Za-z_$][\w$]{2,}/g) || []);
    const freq = {}; jsWords.forEach((w) => (freq[w] = (freq[w] || 0) + 1));
    const htmlText = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]*>/gi, ' ');
    proj = {
      ids: uniq(ids), classes: uniq(classes),
      jsWords: Object.keys(freq).sort((a, b) => freq[b] - freq[a]),
      htmlWords: uniq(htmlText.match(/[A-Za-z][A-Za-z'-]{3,}/g) || []),
      cssVars: uniq(allCss.match(/--[\w-]+/g) || []),
    };
  }

  /* ================= matching ================= */
  // Damerau-Levenshtein with an early stop, for typo fixes
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  // letters in order, e.g. "gEBI" matches "getElementById"
  function subseq(p, w) { let i = 0; for (const ch of w) if (ch === p[i]) i++; return i === p.length; }

  /** Score candidate words against what was typed. Returns items sorted best first. */
  function rank(prefix, cands) {
    const p = prefix.toLowerCase(), out = [], seen = new Set();
    cands.forEach((c, idx) => {
      if (!c || seen.has(c.label)) return;
      const w = c.match || c.label, lw = w.toLowerCase();
      let s = 0;
      if (!p) s = 40;
      else if (w.startsWith(prefix)) s = 100;
      else if (lw.startsWith(p)) s = 92;
      else if (p.length >= 2 && subseq(p, lw) && lw[0] === p[0]) s = 60;
      else if (p.length >= 3 && lw.includes(p)) s = 50;
      else return;
      if (lw === p && !c.snippet) return; // already fully typed
      seen.add(c.label);
      s += Math.min(28, Math.log2(1 + (learned[c.label] || 0)) * 7); // you pick it often
      s += c.boost || 0;
      s -= Math.min(15, idx / 25); // earlier in the list = more common
      out.push({ ...c, score: s });
    });
    // nothing matched: offer close spellings ("buton" → "button")
    if (!out.length && p.length >= 3) {
      const max = p.length <= 4 ? 1 : 2;
      cands.forEach((c) => {
        if (!c || seen.has(c.label)) return;
        const lw = (c.match || c.label).toLowerCase();
        const head = lw.slice(0, Math.max(p.length, Math.min(lw.length, p.length + 1)));
        const d = Math.min(dist(p, lw, max), dist(p, head, max) + (lw.length > head.length ? 0.5 : 0));
        if (d <= max) { seen.add(c.label); out.push({ ...c, score: 70 - d * 10 + (c.boost || 0), typo: true }); }
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 60);
  }

  /* ================= context ================= */
  const it = (label, o) => ({ label, ...o });
  const wordBack = (text, off, re) => { let i = off; while (i > 0 && re.test(text[i - 1])) i--; return i; };

  function inBlock(text, off, open, close) {
    const a = text.lastIndexOf(open, off), b = text.lastIndexOf(close, off);
    return a > b && a !== -1 ? a : -1;
  }

  function suggestHTML(text, off) {
    const style = inBlock(text.toLowerCase(), off, '<style', '</style');
    if (style !== -1) { const s = text.indexOf('>', style) + 1; if (s > 0 && s <= off) return shift(suggestCSS(text.slice(s, off), off - s), s); }
    const script = inBlock(text.toLowerCase(), off, '<script', '</script');
    if (script !== -1) { const s = text.indexOf('>', script) + 1; if (s > 0 && s <= off) return shift(suggestJS(text.slice(s, off), off - s), s); }

    const lt = text.lastIndexOf('<', off - 1), gt = text.lastIndexOf('>', off - 1);
    if (lt > gt) {
      const tagText = text.slice(lt, off);
      let m;
      if ((m = /^<(\/?)([\w-]*)$/.exec(tagText))) {   // <but|  or </di|
        const start = off - m[2].length, closing = !!m[1];
        if (closing) {
          const open = openTags(text.slice(0, lt));
          return { start, prefix: m[2], items: rank(m[2], open.reverse().map((t) => it(t, { insert: t + '>', kind: 'tag', detail: 'close tag' }))) };
        }
        return { start, prefix: m[2], items: rank(m[2], TAGS.map((t) => it(t, {
          insert: VOID.has(t) ? t + '${1}>' : (TAG_SNIP[t] ? TAG_SNIP[t].slice(1) : t + '>${0}</' + t + '>'), snippet: true, kind: 'tag', detail: '<' + t + '>' }))) };
      }
      const tag = (/^<([\w-]+)/.exec(tagText) || [])[1] || '';
      if ((m = /([\w-:@]+)\s*=\s*(["'])([^"']*)$/.exec(tagText))) {  // inside attr="…|
        const attr = m[1].toLowerCase(), val = m[3];
        const wstart = wordBack(text, off, /[\w\-./#]/), prefix = text.slice(wstart, off);
        let vals = [];
        if (attr === 'class') vals = proj.classes.map((c) => it(c, { kind: 'class', detail: 'class in your CSS', boost: 10 }));
        else if (attr === 'id') vals = proj.ids.map((c) => it(c, { kind: 'id', detail: 'used in your code', boost: 10 }));
        else if (attr === 'for' || attr === 'list' || attr === 'form' || attr === 'popovertarget') vals = proj.ids.map((c) => it(c, { kind: 'id' }));
        else if (attr === 'href' || attr === 'src') vals = ['style.css', 'script.js', 'index.html', 'https://'].concat(proj.ids.map((i) => '#' + i)).map((v) => it(v, { kind: 'file' }));
        else if (attr === 'type' && tag === 'script') vals = ['module', 'text/javascript'].map((v) => it(v, { kind: 'value' }));
        else if (attr === 'type' && tag === 'button') vals = ['button', 'submit', 'reset'].map((v) => it(v, { kind: 'value' }));
        else if (attr === 'style') return shift(suggestCSS('x{' + val, 2 + val.length), off - val.length - 2);
        else vals = (ATTR_VALUES[attr] || []).map((v) => it(v, { kind: 'value' }));
        return { start: wstart, prefix, items: rank(prefix, vals) };
      }
      if (/\s[\w-:@]*$/.test(tagText) && tag) {           // <button cl|
        const wstart = wordBack(text, off, /[\w\-:@]/), prefix = text.slice(wstart, off);
        const attrs = (TAG_ATTRS[tag] || []).concat(GLOBAL_ATTRS);
        return { start: wstart, prefix, items: rank(prefix, attrs.map((a) => it(a, {
          insert: /^(hidden|disabled|checked|required|readonly|multiple|autofocus|controls|autoplay|muted|loop|defer|async|open|selected|novalidate|allowfullscreen|playsinline|inert|reversed|default|nomodule)$/.test(a) ? a : a + '="${1}"',
          snippet: true, kind: 'attr', detail: 'attribute' }))) };
      }
      return null;
    }
    // plain text: typing "but" offers <button></button>
    const wstart = wordBack(text, off, /[\w-]/), prefix = text.slice(wstart, off);
    if (!prefix) return null;
    const tagItems = TAGS.map((t) => it(t, { insert: TAG_SNIP[t] || (VOID.has(t) ? '<' + t + '>' : '<' + t + '>${0}</' + t + '>'), snippet: true, kind: 'tag', detail: '<' + t + '>', boost: 6 }));
    const words = proj.htmlWords.map((w) => it(w, { kind: 'word', detail: 'word on this page' }));
    return { start: wstart, prefix, items: rank(prefix, tagItems.concat(words)) };
  }

  function openTags(html) {
    const stack = [];
    html.replace(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g, (_, close, name, self) => {
      name = name.toLowerCase();
      if (VOID.has(name) || self) return;
      if (close) { const i = stack.lastIndexOf(name); if (i >= 0) stack.splice(i); } else stack.push(name);
    });
    return stack;
  }

  function suggestCSS(text, off) {
    const open = text.lastIndexOf('{', off - 1), close = text.lastIndexOf('}', off - 1);
    if (open > close) {
      const segStart = Math.max(text.lastIndexOf(';', off - 1), open) + 1;
      const seg = text.slice(segStart, off);
      const colon = seg.indexOf(':');
      if (colon === -1) {                                  // property name
        const wstart = wordBack(text, off, /[\w-]/), prefix = text.slice(wstart, off);
        if (!prefix && !/^\s*$/.test(seg)) return null;
        const props = CSS_PROPS.map((p) => it(p, { insert: p + ': ${0};', snippet: true, kind: 'property', detail: 'property' }))
          .concat(CSS_SNIPPETS.map(([l, s, d]) => it(l, { insert: s, snippet: true, kind: 'snippet', detail: d })));
        return { start: wstart, prefix, items: rank(prefix, props) };
      }
      const prop = seg.slice(0, colon).trim().toLowerCase();  // value
      const wstart = wordBack(text, off, /[\w\-#%().,]/), prefix = text.slice(wstart, off);
      const vals = (CSS_VALUES[prop] || []).map((v) => it(v, { kind: 'value', boost: 15 }))
        .concat(proj.cssVars.map((v) => it('var(' + v + ')', { match: v, kind: 'variable', detail: 'your variable', boost: 8 })))
        .concat(CSS_GENERIC.map((v) => it(v, { kind: 'value' })));
      return { start: wstart, prefix, items: rank(prefix.replace(/^var\(/, ''), vals) };
    }
    // selectors
    const wstart = wordBack(text, off, /[\w-]/), prefix = text.slice(wstart, off), ch = text[wstart - 1];
    if (ch === '.') return { start: wstart, prefix, items: rank(prefix, proj.classes.map((c) => it(c, { kind: 'class', detail: 'class in your HTML', boost: 10 }))) };
    if (ch === '#') return { start: wstart, prefix, items: rank(prefix, proj.ids.map((c) => it(c, { kind: 'id', detail: 'id in your HTML', boost: 10 }))) };
    if (ch === ':') return { start: wstart, prefix, items: rank(prefix, CSS_PSEUDO.map((p) => it(p, { kind: 'value', detail: 'pseudo' }))) };
    if (ch === '@') return { start: wstart, prefix, items: rank(prefix, CSS_AT.map((p) => it(p, { kind: 'keyword' })).concat(CSS_SNIPPETS.filter((s) => s[0] === 'media' || s[0] === 'keyframes').map(([l, s, d]) => it(l + ' {}', { match: l, insert: s.slice(1), snippet: true, kind: 'snippet', detail: d })))) };
    if (!prefix) return null;
    const sel = TAGS.map((t) => it(t, { kind: 'tag' }))
      .concat(proj.classes.map((c) => it('.' + c, { match: c, kind: 'class', boost: 12 })))
      .concat(proj.ids.map((c) => it('#' + c, { match: c, kind: 'id', boost: 12 })))
      .concat(CSS_SNIPPETS.filter((s) => s[0] === 'media').map(([l, s, d]) => it('@media', { match: 'media', insert: s, snippet: true, kind: 'snippet', detail: d })));
    return { start: wstart, prefix, items: rank(prefix, sel) };
  }

  function suggestJS(text, off) {
    // skip comments
    const line = text.slice(text.lastIndexOf('\n', off - 1) + 1, off);
    if (/\/\//.test(line.replace(/(['"`]).*?\1/g, ''))) return null;
    const wstart = wordBack(text, off, /[\w$]/), prefix = text.slice(wstart, off);
    const before = text.slice(Math.max(0, wstart - 80), wstart);
    let m;
    // inside a string argument
    if ((m = /(getElementById|querySelector(?:All)?|addEventListener|classList\.(?:add|remove|toggle|contains)|getItem|setItem)\(\s*(['"`])([\w\-#.\s>]*)$/.exec(text.slice(Math.max(0, off - 120), off)))) {
      const fn = m[1], arg = m[3];
      const s2 = off - arg.length + (/[\s>]/.test(arg) ? arg.search(/[^\s>]*$/) : 0), p2 = text.slice(s2, off);
      let vals = [];
      if (fn === 'getElementById') vals = proj.ids.map((v) => it(v, { kind: 'id', detail: 'id in your HTML', boost: 10 }));
      else if (fn.startsWith('querySelector')) vals = proj.ids.map((v) => it('#' + v, { kind: 'id', boost: 10 })).concat(proj.classes.map((v) => it('.' + v, { kind: 'class', boost: 10 }))).concat(TAGS.map((t) => it(t, { kind: 'tag' })));
      else if (fn === 'addEventListener') vals = DOM_EVENTS.map((v) => it(v, { kind: 'event' }));
      else if (fn.startsWith('classList')) vals = proj.classes.map((v) => it(v, { kind: 'class', boost: 10 }));
      return { start: s2, prefix: p2, items: rank(p2, vals) };
    }
    if (/['"`][^'"`\n]*$/.test(line.slice(0, line.length - prefix.length)) && (line.match(/['"`]/g) || []).length % 2 === 1) return null; // other strings
    if (text[wstart - 1] === '.') {
      const obj = (/([\w$]+)\s*$/.exec(before.slice(0, -1)) || [])[1] || '';
      const own = MEMBERS[obj] || [];
      const items = own.map((v) => it(v, { kind: 'method', detail: obj, boost: 20 })).concat(MEMBERS_ANY.map((v) => it(v, { kind: 'method' })));
      return { start: wstart, prefix, items: rank(prefix, items) };
    }
    if (!prefix) return null;
    const items = JS_SNIPPETS.map(([l, s, d]) => it(l, { insert: s, snippet: true, kind: 'snippet', detail: d, boost: 4 }))
      .concat(proj.jsWords.map((w) => it(w, { kind: 'variable', detail: 'in your code', boost: 14 })))
      .concat(JS_KEYWORDS.map((w) => it(w, { kind: 'keyword' })))
      .concat(JS_GLOBALS.map((w) => it(w, { kind: 'global' })))
      .concat(proj.ids.map((v) => it(v, { kind: 'id', detail: 'element id', insert: "document.getElementById('" + v + "')", match: v })));
    return { start: wstart, prefix, items: rank(prefix, items) };
  }

  function shift(r, by) { if (r) r.start += by; return r; }
  function suggest(lang, text, off) {
    try {
      if (lang === 'css') return suggestCSS(text, off);
      if (lang === 'javascript' || lang === 'js') return suggestJS(text, off);
      return suggestHTML(text, off);
    } catch (e) { return null; }
  }

  const engine = { suggest, indexProject, learn, get project() { return proj; } };
  HR.suggest = engine;

  let idxT = 0;
  const reindex = () => { clearTimeout(idxT); idxT = setTimeout(() => indexProject(HR.getFiles()), 250); };
  indexProject(HR.getFiles());

  /* ================= Monaco editor ================= */
  HR.whenEditor((monaco, ed) => {
    const K = monaco.languages.CompletionItemKind;
    const KIND = { tag: K.Property, attr: K.Field, value: K.Value, class: K.Reference, id: K.Reference, file: K.File, property: K.Property,
      snippet: K.Snippet, variable: K.Variable, keyword: K.Keyword, global: K.Module, method: K.Method, event: K.Event, word: K.Text };
    monaco.editor.registerCommand('hr.learn', (_, w) => learn(w, 2));
    const on = () => { try { return localStorage.getItem('hr:smart') !== 'false'; } catch (e) { return true; } };

    const provider = {
      triggerCharacters: ['.', '<', '#', '"', "'", '`', ':', '@', '/', ' ', '-', '('],
      provideCompletionItems(model, position) {
        if (!on()) return { suggestions: [] };
        const lang = model.getLanguageId(), text = model.getValue(), off = model.getOffsetAt(position);
        const r = suggest(lang, text, off);
        if (!r || !r.items.length) return { suggestions: [], incomplete: true };
        const s = model.getPositionAt(r.start);
        const range = new monaco.Range(s.lineNumber, s.column, position.lineNumber, position.column);
        const suggestions = r.items.map((x, i) => ({
          label: x.typo ? { label: x.label, description: 'did you mean?' } : { label: x.label, description: x.detail || '' },
          kind: KIND[x.kind] || K.Text,
          insertText: x.insert || x.label,
          insertTextRules: x.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          filterText: x.typo ? r.prefix : (x.match && !x.label.toLowerCase().startsWith(r.prefix.toLowerCase()) ? x.match : x.label),
          sortText: String(1000 - Math.round(x.score)).padStart(4, '0') + '_' + String(i).padStart(3, '0'),
          preselect: i === 0,
          range,
          command: { id: 'hr.learn', title: '', arguments: [x.label] },
        }));
        return { suggestions, incomplete: true };
      },
    };
    ['html', 'css', 'javascript'].forEach((l) => monaco.languages.registerCompletionItemProvider(l, provider));

    // Keep the list open while typing AND after deleting. Phone keyboards send text in a way
    // the editor often doesn't count as typing, so the list is opened by hand after every change.
    let trigT = 0;
    ed.onDidChangeModelContent((e) => {
      reindex();
      if (!on() || e.isFlush || e.isUndoing || e.isRedoing || e.changes.length !== 1) return;
      const ch = e.changes[0], grow = ch.text.length - ch.rangeLength;
      // one letter typed or deleted, including phone keyboards that resend the whole word each time
      const deleted = (ch.text === '' && ch.rangeLength > 0) || (ch.rangeLength > 0 && grow === -1);
      const typed = ch.text.length === 1 || (ch.rangeLength > 0 && grow === 1);
      if (!deleted && !typed) return; // pasted text or an accepted suggestion
      if (typed && /[^\w$-]$/.test(ch.text)) {
        // finished a word: remember it so it ranks higher next time
        const m = ed.getModel(), p = ed.getPosition();
        const w = m.getLineContent(p.lineNumber).slice(0, p.column - 1).match(/([A-Za-z_$][\w$-]{2,})[^\w$-]$/);
        if (w) learn(w[1], 1);
      }
      clearTimeout(trigT);
      trigT = setTimeout(() => {
        const m = ed.getModel(), p = ed.getPosition(); if (!m || !p) return;
        const r = suggest(m.getLanguageId(), m.getValue(), m.getOffsetAt(p));
        if (r && r.items.length) ed.trigger('hr', 'editor.action.triggerSuggest', {});
        else ed.trigger('hr', 'hideSuggestWidget', {});
      }, deleted ? 20 : 40);
    });
    ed.onDidChangeModel(reindex);
  });

  /* Turn "a${1:b}c$0" into plain text plus where the cursor goes (first stop, $0 last) */
  function expandSnippet(snip) {
    let out = '', best = Infinity, caret = -1;
    const re = /\$\{(\d+)(?::([^}]*))?\}|\$(\d+)/g;
    let i = 0, m;
    while ((m = re.exec(snip))) {
      out += snip.slice(i, m.index);
      const n = +(m[1] || m[3]), rankN = n === 0 ? 999 : n;
      if (rankN < best) { best = rankN; caret = out.length; }
      out += m[2] || '';
      i = re.lastIndex;
    }
    out += snip.slice(i);
    return { text: out, caret };
  }
  engine.expandSnippet = expandSnippet;

  /* ================= basic editor (when the full editor can't load) ================= */
  function attachBar() {
    const ta = document.getElementById('plainEditor'); if (!ta || ta.dataset.smart) return;
    ta.dataset.smart = '1';
    const bar = document.createElement('div'); bar.className = 'sugbar'; bar.hidden = true;
    ta.parentElement.append(bar);
    let last = null;
    const lang = () => ({ html: 'html', css: 'css', js: 'javascript' }[HR.currentFile()]);
    const update = () => {
      reindex();
      if (localStorage.getItem('hr:smart') === 'false') { bar.hidden = true; return; }
      const off = ta.selectionStart;
      if (off !== ta.selectionEnd) { bar.hidden = true; return; }
      last = suggest(lang(), ta.value, off);
      bar.innerHTML = '';
      if (!last || !last.items.length) { bar.hidden = true; return; }
      last.items.slice(0, 12).forEach((x) => {
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = '<span></span>' + (x.typo ? '<small>fix</small>' : x.detail ? '<small></small>' : '');
        b.firstChild.textContent = x.label; if (!x.typo && x.detail) b.lastChild.textContent = x.detail;
        b.onpointerdown = (e) => e.preventDefault(); // keep the keyboard open
        b.onclick = () => insert(x);
        bar.append(b);
      });
      bar.hidden = false; bar.scrollLeft = 0;
    };
    function insert(x) {
      const { text, caret } = x.snippet ? expandSnippet(x.insert) : { text: x.insert || x.label, caret: -1 };
      ta.focus();
      ta.setRangeText(text, last.start, ta.selectionStart, 'end');
      if (caret >= 0) { const p = last.start + caret; ta.setSelectionRange(p, p); }
      learn(x.label, 2);
      ta.dispatchEvent(new Event('input'));
    }
    ta.addEventListener('input', update);
    ta.addEventListener('click', update);
    ta.addEventListener('keyup', (e) => { if (/^Arrow|Home|End/.test(e.key)) update(); });
    ta.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ta) bar.hidden = true; }, 150));
  }
  new MutationObserver(attachBar).observe(document.getElementById('editorHost'), { childList: true });
  attachBar();

  /* ================= menu switch ================= */
  const box = document.getElementById('smartSuggest');
  if (box) {
    try { box.checked = localStorage.getItem('hr:smart') !== 'false'; } catch (e) { box.checked = true; }
    box.onchange = () => { try { localStorage.setItem('hr:smart', box.checked ? 'true' : 'false'); } catch (e) {} };
  }
})();
