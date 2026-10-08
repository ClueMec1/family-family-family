/* Runs inside every page the HTML Runner page server sends back.
   It keeps the page's own requests (fetch, links, images added later, forms, history)
   going through the page server, and tells HTML Runner which page is open.
   The server fills in the settings at the very end of this file. */
(function (C) {
  'use strict';
  if (window.__hrPage) return;
  window.__hrPage = true;

  var PO = location.origin;          // the page server's own address
  var BASE = PO + C.prefix + '/p/';  // every proxied address starts with this
  var b64 = function (s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var unb64 = function (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); };
  var SKIP = /^(data|blob|javascript|about|mailto|tel|sms|intent|chrome|chrome-extension|file):/i;

  function unproxy(u) {
    u = String(u);
    if (u.indexOf(BASE) !== 0) return null;
    var rest = u.slice(BASE.length), i = rest.indexOf('/');
    var tok = i < 0 ? rest : rest.slice(0, i), path = i < 0 ? '/' : rest.slice(i);
    try { var o = unb64(tok); return /^https?:\/\/[^/]+$/.test(o) ? o + path : null; } catch (e) { return null; }
  }
  function realUrl() { return unproxy(location.href) || C.url; }
  function realBase() { return unproxy(document.baseURI) || realUrl(); }

  function proxy(u, base) {
    if (u == null) return u;
    var s = String(u).trim();
    if (!s || s.charAt(0) === '#' || SKIP.test(s)) return u;
    if (s.indexOf(C.prefix + '/p/') === 0) return PO + s;   // already rewritten by the server
    var abs;
    try { abs = new URL(s, base || realBase()); } catch (e) { return u; }
    if (abs.origin === PO) {
      if (unproxy(abs.href)) return abs.href;
      // built from location (the server's address): put it back on the real site
      abs = new URL(abs.pathname + abs.search + abs.hash, new URL(realUrl()).origin);
    }
    if (abs.protocol === 'ws:' || abs.protocol === 'wss:') {
      var web = (abs.protocol === 'wss:' ? 'https://' : 'http://') + abs.host;
      return (PO.replace(/^http/, 'ws')) + C.prefix + '/p/' + b64(web) + abs.pathname + abs.search;
    }
    if (!/^https?:$/.test(abs.protocol)) return u;
    return BASE + b64(abs.origin) + abs.pathname + abs.search + abs.hash;
  }
  function proxySrcset(v) {
    return String(v).split(/,(?=\s*\S)/).map(function (part) {
      var m = part.trim().match(/^(\S+)(\s+.*)?$/);
      return m ? proxy(m[1]) + (m[2] || '') : part;
    }).join(', ');
  }
  window.__hrProxy = proxy;

  /* ---- network calls ---- */
  var oFetch = window.fetch;
  if (oFetch) window.fetch = function (input, init) {
    try {
      if (input instanceof Request) { var p = proxy(input.url); if (p !== input.url) input = new Request(p, input); }
      else input = proxy(input instanceof URL ? input.href : input);
    } catch (e) {}
    return oFetch.call(this, input, init);
  };
  var oOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) {
    var a = Array.prototype.slice.call(arguments); a[1] = proxy(url); return oOpen.apply(this, a);
  };
  if (navigator.sendBeacon) {
    var oBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) { return oBeacon(proxy(url), data); };
  }
  function wrapCtor(name) {
    var O = window[name]; if (!O) return;
    var W = function (url, opt) { return new O(proxy(url instanceof URL ? url.href : url), opt); };
    W.prototype = O.prototype;
    Object.getOwnPropertyNames(O).forEach(function (k) { if (!(k in W)) try { W[k] = O[k]; } catch (e) {} });
    window[name] = W;
  }
  wrapCtor('EventSource'); wrapCtor('WebSocket'); wrapCtor('Worker'); wrapCtor('SharedWorker');

  /* Service workers would take over the page server's address, so they're turned off. */
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = function () { return Promise.reject(new Error('Service workers are off for pages loaded through the HTML Runner page server')); };
    }
  } catch (e) {}

  /* ---- new tabs and history ---- */
  var oWinOpen = window.open;
  window.open = function (url) { var a = Array.prototype.slice.call(arguments); if (url) a[0] = proxy(url); return oWinOpen.apply(window, a); };
  ['pushState', 'replaceState'].forEach(function (k) {
    var o = history[k];
    history[k] = function (st, title, url) {
      var r = o.call(history, st, title, url == null ? url : proxy(url));
      tell(); return r;
    };
  });

  /* ---- elements: attributes and properties ---- */
  var URL_ATTRS = { src: 1, href: 1, action: 1, formaction: 1, poster: 1, data: 1, background: 1 };
  var SET_ATTRS = { srcset: 1, imagesrcset: 1 };
  function fixValue(el, name, v) {
    name = String(name).toLowerCase();
    if (URL_ATTRS[name]) { if (name === 'data' && el.tagName !== 'OBJECT') return v; return proxy(v); }
    if (SET_ATTRS[name]) return proxySrcset(v);
    if (name === 'integrity') return null;
    if (name === 'target' && /^_(top|parent)$/i.test(v)) return '_self';
    return v;
  }
  var oSetAttr = Element.prototype.setAttribute;
  var oGetAttr = Element.prototype.getAttribute;
  Element.prototype.setAttribute = function (name, v) {
    if (this.namespaceURI === 'http://www.w3.org/1999/xhtml' || !this.namespaceURI) {
      var f = fixValue(this, name, v);
      if (f === null) return;
      v = f;
    }
    return oSetAttr.call(this, name, v);
  };
  [['HTMLImageElement', 'src'], ['HTMLImageElement', 'srcset'], ['HTMLScriptElement', 'src'], ['HTMLLinkElement', 'href'],
   ['HTMLIFrameElement', 'src'], ['HTMLMediaElement', 'src'], ['HTMLSourceElement', 'src'], ['HTMLSourceElement', 'srcset'],
   ['HTMLEmbedElement', 'src'], ['HTMLObjectElement', 'data'], ['HTMLFormElement', 'action'], ['HTMLAnchorElement', 'href'],
   ['HTMLAreaElement', 'href'], ['HTMLTrackElement', 'src'], ['HTMLInputElement', 'src'], ['HTMLVideoElement', 'poster']
  ].forEach(function (pair) {
    var C2 = window[pair[0]]; if (!C2) return;
    var d = Object.getOwnPropertyDescriptor(C2.prototype, pair[1]); if (!d || !d.set) return;
    Object.defineProperty(C2.prototype, pair[1], {
      configurable: true, enumerable: d.enumerable,
      get: function () { var v = d.get.call(this); return (typeof v === 'string' && unproxy(v)) || v; },
      set: function (v) { d.set.call(this, /srcset/.test(pair[1]) ? proxySrcset(v) : proxy(v)); },
    });
  });

  /* Elements added with innerHTML and similar: fix them as they arrive. */
  function fixTree(root) {
    if (!root || root.nodeType !== 1) return;
    var list = [root];
    if (root.querySelectorAll) list = list.concat(Array.prototype.slice.call(root.querySelectorAll('[src],[href],[action],[srcset],[poster],[formaction],object[data],[integrity],[target]')));
    list.forEach(function (el) {
      if (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
      ['src', 'href', 'action', 'formaction', 'poster', 'srcset', 'imagesrcset', 'data', 'target', 'integrity'].forEach(function (n) {
        var v = oGetAttr.call(el, n); if (v == null) return;
        var f = fixValue(el, n, v);
        if (f === null) el.removeAttribute(n); else if (f !== v) oSetAttr.call(el, n, f);
      });
    });
  }
  /* HTML added as text (innerHTML, insertAdjacentHTML, document.write) is fixed before Chrome sees it,
     because images in it start loading the moment it's inserted. A <template> reads it without loading anything. */
  var tplHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  function fixHtml(html) {
    try {
      var tpl = document.createElement('template');
      tplHTML.set.call(tpl, html);
      var kids = tpl.content.children;
      for (var i = 0; i < kids.length; i++) fixTree(kids[i]);
      return tplHTML.get.call(tpl);
    } catch (e) { return html; }
  }
  var RAW = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, TITLE: 1, XMP: 1, NOSCRIPT: 1 };
  ['innerHTML', 'outerHTML'].forEach(function (prop) {
    var d = Object.getOwnPropertyDescriptor(Element.prototype, prop); if (!d || !d.set) return;
    Object.defineProperty(Element.prototype, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, RAW[this.tagName] || typeof v !== 'string' ? v : fixHtml(v)); },
    });
  });
  var oAdj = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (pos, html) { return oAdj.call(this, pos, fixHtml(String(html))); };
  ['write', 'writeln'].forEach(function (k) {
    var o = Document.prototype[k];
    Document.prototype[k] = function () {
      // written in pieces sometimes, so only the addresses are changed, never the tags around them
      var html = Array.prototype.join.call(arguments, '').replace(/(\s(?:src|href|action|poster)\s*=\s*)(["'])([^"']*)\2/gi,
        function (m, a, q, v) { return a + q + proxy(v) + q; });
      return o.call(this, html);
    };
  });

  new MutationObserver(function (muts) {
    muts.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) fixTree(m.addedNodes[i]); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* Anything that still tries to leave the page server (location = 'https://…', links made by scripts):
     Chrome's Navigation API lets us catch it and send it through the server instead. */
  if (window.navigation && navigation.addEventListener) {
    navigation.addEventListener('navigate', function (e) {
      try {
        var to = e.destination && e.destination.url;
        if (!to || SKIP.test(to) || to.indexOf(PO + '/') === 0 || e.hashChange || e.downloadRequest != null) return;
        if (!e.cancelable || e.formData) return;
        e.preventDefault();
        location.assign(proxy(to));
      } catch (err) {}
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[target],area[target]');
    if (a && /^_(top|parent)$/i.test(a.target)) a.target = '_self';
  }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || f.tagName !== 'FORM') return;
    var act = oGetAttr.call(f, 'action');
    if (act != null && !unproxy(new URL(act, document.baseURI).href)) oSetAttr.call(f, 'action', proxy(act));
    if (/^_(top|parent)$/i.test(f.target)) f.target = '_self';
  }, true);

  /* ---- cookies set by scripts stay with this site ---- */
  try {
    var cd = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cd && cd.set) Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true, enumerable: cd.enumerable,
      get: function () { return cd.get.call(this); },
      set: function (v) {
        var parts = String(v).split(';'), out = [parts[0].trim().replace(/^__Host-/i, 'hrHost__').replace(/^__Secure-/i, 'hrSecure__')], path = '/';
        for (var i = 1; i < parts.length; i++) {
          var p = parts[i].trim(), k = p.split('=')[0].toLowerCase();
          if (k === 'domain') continue;
          if (k === 'path') { path = p.slice(p.indexOf('=') + 1).trim() || '/'; continue; }
          out.push(p);
        }
        if (path.charAt(0) !== '/') path = '/' + path;
        out.push('path=' + C.prefix + '/p/' + C.token + path);
        cd.set.call(this, out.join('; '));
      },
    });
  } catch (e) {}

  /* ---- tell HTML Runner where we are ---- */
  var last = '';
  function tell() {
    if (window.parent === window) return;
    var msg = { __hrProxy: 1, url: realUrl(), title: document.title || '' };
    var key = msg.url + '\n' + msg.title;
    if (key === last) return;
    last = key;
    try { window.parent.postMessage(msg, '*'); } catch (e) {}
  }
  addEventListener('DOMContentLoaded', tell);
  addEventListener('load', tell);
  addEventListener('popstate', tell);
  addEventListener('hashchange', tell);
  setInterval(tell, 1500);
})(__HR_CONFIG__);
