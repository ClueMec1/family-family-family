#!/usr/bin/env node
/* HTML Runner page server
   Loads web pages on this server and hands them to HTML Runner, so the built-in browser and
   Home screen apps get every page (and everything on it) from one address: this server.

   Start it:   node server/server.js
   Settings (environment variables, all optional):
     PORT         port for the page server                  (default 8787)
     PROXY_KEY    a password; addresses then start with /k/<key>. Use one whenever the server is on the internet.
     APP_PORT     also serve HTML Runner itself on this port (default 8080, set to 0 to turn off)
     ALLOW_LOCAL  set to 1 to allow pages on your own network (192.168.x.x, localhost and so on)
   Needs Node.js 18 or newer. No packages to install. */
'use strict';
const http = require('http');
const net = require('net');
const tls = require('tls');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const PORT = Number(process.env.PORT) || 8787;
const KEY = (process.env.PROXY_KEY || '').trim();
const APP_PORT = process.env.APP_PORT === undefined ? 8080 : Number(process.env.APP_PORT);
const ALLOW_LOCAL = process.env.ALLOW_LOCAL === '1';
const PREFIX = KEY ? '/k/' + encodeURIComponent(KEY) : '';
const APP_DIR = path.resolve(__dirname, '..');
// the script that goes into every page (its opening comment is left out to keep pages small)
const CLIENT = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
const VERSION = '1';

/* ---------------- addresses ----------------
   A page at https://example.com/a/b?c is served at  <server>/p/<example.com in base64>/a/b?c
   The site's name is encoded so it never appears in the address. */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');
const proxied = (abs) => PREFIX + '/p/' + b64(abs.origin) + abs.pathname + abs.search + abs.hash;

function parseProxyPath(p) {
  // p is the request path after PREFIX, starting with /p/
  const m = /^\/p\/([A-Za-z0-9_-]+)(\/.*)?$/.exec(p);
  if (!m) return null;
  let origin;
  try { origin = unb64(m[1]); } catch (e) { return null; }
  if (!/^https?:\/\/[^/\s]+$/i.test(origin)) return null;
  try { return { token: m[1], origin, target: new URL(origin + (m[2] || '/')) }; } catch (e) { return null; }
}
function unproxyFull(u, selfOrigin) {
  // a full address on this server -> the real address, or null
  try {
    const x = new URL(u);
    if (selfOrigin && x.origin !== selfOrigin) return null;
    if (!x.pathname.startsWith(PREFIX + '/p/')) return null;
    const r = parseProxyPath(x.pathname.slice(PREFIX.length) + x.search);
    return r ? r.target.href : null;
  } catch (e) { return null; }
}

const SKIP = /^(data|blob|javascript|about|mailto|tel|sms|intent|chrome|file):/i;
function rewriteUrl(value, base) {
  const raw = String(value).trim();
  if (!raw || raw[0] === '#' || SKIP.test(raw) || raw.startsWith(PREFIX + '/p/')) return value;
  let abs;
  try { abs = new URL(raw, base); } catch (e) { return value; }
  if (!/^https?:$/.test(abs.protocol)) return value;
  return proxied(abs);
}
const rewriteSrcset = (v, base) => String(v).split(/,(?=\s*\S)/).map((part) => {
  const m = part.trim().match(/^(\S+)(\s+.*)?$/);
  return m ? rewriteUrl(m[1], base) + (m[2] || '') : part;
}).join(', ');

/* ---------------- HTML and CSS rewriting ---------------- */
const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (m, e) => {
  e = e.toLowerCase();
  if (e[0] === '#') { const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } }
  return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[e];
});
const encodeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function rewriteCss(css, base) {
  return css
    .replace(/url\(\s*(['"]?)([^'")]*?)\1\s*\)/gi, (m, q, u) => (u ? `url(${q}${rewriteUrl(u, base)}${q})` : m))
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, u) => `@import ${q}${rewriteUrl(u, base)}${q}`);
}

const URL_ATTRS = new Set(['src', 'href', 'action', 'formaction', 'poster', 'background', 'xlink:href', 'longdesc', 'ping']);
const ATTR_RE = /([^\s"'=<>`\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function rewriteTag(tag, attrs, base) {
  const t = tag.toLowerCase();
  let out = '', isRefresh = false, dropTag = false;
  const list = [];
  attrs.replace(ATTR_RE, (m, name, d, s, u) => { list.push([name, d != null ? d : s != null ? s : u != null ? u : null]); return ''; });
  for (const [name] of list) {
    const n = name.toLowerCase();
    if (t === 'meta' && n === 'http-equiv') {
      const v = (list.find((a) => a[0].toLowerCase() === 'http-equiv')[1] || '').toLowerCase();
      if (v === 'content-security-policy' || v === 'content-security-policy-report-only' || v === 'x-frame-options') dropTag = true;
      if (v === 'refresh') isRefresh = true;
    }
    if (t === 'meta' && n === 'name') {
      const v = (list.find((a) => a[0].toLowerCase() === 'name')[1] || '').toLowerCase();
      if (v === 'referrer') dropTag = true;
    }
  }
  if (dropTag) return null;
  for (let [name, val] of list) {
    const n = name.toLowerCase();
    if (val == null) { out += ' ' + name; continue; }
    let v = decodeEntities(val);
    if (n === 'integrity') continue; // the page changes on its way through, so its checksum would no longer match
    if (URL_ATTRS.has(n) || (n === 'data' && t === 'object')) v = rewriteUrl(v, base);
    else if (n === 'srcset' || n === 'imagesrcset') v = rewriteSrcset(v, base);
    else if (n === 'style') v = rewriteCss(v, base);
    else if (n === 'target' && /^_(top|parent)$/i.test(v)) v = '_self';
    else if (n === 'content' && isRefresh) v = v.replace(/(url\s*=\s*['"]?)([^'";]+)/i, (m, a, u) => a + rewriteUrl(u, base));
    out += ` ${name}="${encodeAttr(v)}"`;
  }
  return out;
}

const HTML_RE = /<!--[\s\S]*?-->|<(script|style|textarea|title|noscript)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<([a-zA-Z][^\s\/>]*)((?:\s*[^\s"'=<>`\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;

function rewriteHtml(html, pageUrl, token) {
  // a <base href> changes how every other link is read
  let base = pageUrl;
  const bm = /<base\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html);
  if (bm) { try { base = new URL(decodeEntities(bm[1] || bm[2] || bm[3]), pageUrl).href; } catch (e) {} }

  let injected = false;
  const config = JSON.stringify({ prefix: PREFIX, token, url: pageUrl }).replace(/</g, '\\u003c');
  const inject = `<script data-hr-page>${CLIENT.replace('})(__HR_CONFIG__);', () => `})(${config});`)}</script>`;

  let out = html.replace(HTML_RE, (m, block, blockAttrs, body, tag, attrs, selfClose) => {
    if (m.startsWith('<!--')) return m;
    if (block) {
      const b = block.toLowerCase();
      const a = rewriteTag(b, blockAttrs || '', base);
      if (a === null) return '';
      if (b === 'style') body = rewriteCss(body, base);
      return `<${block}${a}>${body}</${block}>`;
    }
    const t = tag.toLowerCase();
    const a = rewriteTag(t, attrs || '', base);
    if (a === null) return '';
    let res = `<${tag}${a}${selfClose ? ' /' : ''}>`;
    if (!injected && t === 'head') { injected = true; res += inject; }
    return res;
  });
  if (!injected) {
    const hm = /<html\b[^>]*>/i.exec(out);
    if (hm) out = out.slice(0, hm.index + hm[0].length) + inject + out.slice(hm.index + hm[0].length);
    else out = inject + out;
  }
  return out;
}

/* ---------------- text encodings ---------------- */
function charsetOf(contentType, bytes, isHtml) {
  let m = /charset=["']?([\w-]+)/i.exec(contentType || '');
  if (m) return m[1];
  const head = bytes.subarray(0, 4096).toString('latin1');
  m = isHtml ? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head) : /^@charset\s+"([\w-]+)"/i.exec(head);
  return m ? m[1] : 'utf-8';
}
function decode(bytes, cs) {
  try { return new TextDecoder(cs).decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
}

/* ---------------- safety: don't reach into private networks ---------------- */
function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith('::ffff:')) return isPrivate(x.slice(7));
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80');
}
async function checkHost(hostname) {
  if (ALLOW_LOCAL) return;
  const h = hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(h) ? [{ address: h }] : await dns.lookup(h, { all: true });
  if (addrs.some((a) => isPrivate(a.address))) {
    const e = new Error('That address is on a private network. Start the server with ALLOW_LOCAL=1 to allow it.');
    e.status = 403; throw e;
  }
}

/* ---------------- cookies ----------------
   Each site's cookies are kept under its own path on this server, so sites can't see each other's. */
const renameIn = (n) => n.replace(/^__Host-/i, 'hrHost__').replace(/^__Secure-/i, 'hrSecure__');
const renameOut = (n) => n.replace(/^hrHost__/, '__Host-').replace(/^hrSecure__/, '__Secure-');
function rewriteSetCookie(sc, token, secure) {
  const parts = sc.split(';');
  const first = parts.shift().trim();
  const eq = first.indexOf('=');
  const name = eq < 0 ? first : first.slice(0, eq);
  const out = [renameIn(name) + (eq < 0 ? '' : first.slice(eq))];
  let p = '/';
  for (const raw of parts) {
    const a = raw.trim(); const k = a.split('=')[0].toLowerCase();
    if (k === 'domain' || k === 'samesite' || k === 'secure') continue;
    if (k === 'path') { p = a.slice(a.indexOf('=') + 1).trim() || '/'; continue; }
    if (a) out.push(a);
  }
  if (!p.startsWith('/')) p = '/' + p;
  out.push('Path=' + PREFIX + '/p/' + token + p);
  // HTML Runner shows pages inside itself, so on https the cookie must be allowed there
  if (secure) out.push('Secure', 'SameSite=None'); else out.push('SameSite=Lax');
  return out.join('; ');
}
function cookieHeaderOut(c) {
  return String(c).split(';').map((p) => p.trim()).filter(Boolean)
    .map((p) => { const i = p.indexOf('='); return i < 0 ? p : renameOut(p.slice(0, i)) + p.slice(i); }).join('; ');
}

/* ---------------- the proxy ---------------- */
const FORWARD = ['accept', 'accept-language', 'cache-control', 'content-type', 'if-match', 'if-none-match',
  'if-modified-since', 'if-unmodified-since', 'if-range', 'pragma', 'range', 'user-agent', 'authorization',
  'x-requested-with', 'dnt'];
const DROP = new Set(['content-security-policy', 'content-security-policy-report-only', 'x-frame-options',
  'strict-transport-security', 'content-encoding', 'transfer-encoding', 'connection', 'keep-alive', 'set-cookie',
  'clear-site-data', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
  'referrer-policy', 'report-to', 'reporting-endpoints', 'nel', 'alt-svc', 'expect-ct', 'permissions-policy',
  'feature-policy', 'link', 'service-worker-allowed', 'origin-agent-cluster', 'location', 'refresh', 'content-location',
  'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-headers',
  'access-control-allow-methods', 'access-control-expose-headers', 'access-control-max-age', 'vary', 'server']);

function selfOrigin(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : 'http');
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return proto + '://' + host;
}
const isSecure = (origin) => origin.startsWith('https:');

async function proxyRequest(req, res, info, self) {
  const { target, token } = info;
  await checkHost(target.hostname);

  const headers = {};
  for (const k of FORWARD) if (req.headers[k]) headers[k] = req.headers[k];
  if (req.headers.cookie) headers.cookie = cookieHeaderOut(req.headers.cookie);
  if (req.headers.referer) { const r = unproxyFull(req.headers.referer, self); if (r) headers.referer = r; }
  if (req.headers.origin) headers.origin = target.origin;

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ac.abort(); });
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const up = await fetch(target.href, {
    method: req.method, headers, redirect: 'manual', signal: ac.signal,
    body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? 'half' : undefined,
  });

  const out = {};
  up.headers.forEach((v, k) => { if (!DROP.has(k)) out[k] = v; });
  out['access-control-allow-origin'] = '*';
  out['x-hr-url'] = target.href;
  const loc = up.headers.get('location');
  if (loc) out.location = rewriteUrl(loc, target.href);
  const refresh = up.headers.get('refresh');
  if (refresh) out.refresh = refresh.replace(/(url\s*=\s*)(\S+)/i, (m, a, u) => a + rewriteUrl(u, target.href));
  const cookies = up.headers.getSetCookie ? up.headers.getSetCookie() : [];
  if (cookies.length) out['set-cookie'] = cookies.map((c) => rewriteSetCookie(c, token, isSecure(self)));
  if (up.headers.get('content-encoding')) delete out['content-length'];

  const type = (up.headers.get('content-type') || '').toLowerCase();
  const isHtml = /text\/html|application\/xhtml\+xml/.test(type);
  const isCss = /text\/css/.test(type);

  if ((isHtml || isCss) && req.method !== 'HEAD' && up.body && up.status !== 204 && up.status !== 304) {
    const bytes = Buffer.from(await up.arrayBuffer());
    const text = decode(bytes, charsetOf(type, bytes, isHtml));
    const body = isHtml ? rewriteHtml(text, target.href, token) : rewriteCss(text, target.href);
    const buf = Buffer.from(body, 'utf8');
    out['content-type'] = (isHtml ? (type.includes('xhtml') ? 'application/xhtml+xml' : 'text/html') : 'text/css') + '; charset=utf-8';
    out['content-length'] = String(buf.length);
    out['cache-control'] = 'no-cache';
    delete out.etag;
    res.writeHead(up.status, out);
    return res.end(buf);
  }

  res.writeHead(up.status, out);
  if (!up.body || req.method === 'HEAD') return res.end();
  Readable.fromWeb(up.body).on('error', () => res.destroy()).pipe(res);
}

function errorPage(res, status, title, detail, url) {
  if (res.headersSent) return res.destroy();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<body style="font:15px/1.5 system-ui,sans-serif;background:#0c0f15;color:#e6e9ef;margin:0;display:grid;place-items:center;min-height:100vh">
<main style="max-width:440px;padding:24px"><h1 style="font-size:20px;margin:0 0 8px">${esc(title)}</h1>
<p style="color:#9aa3b2;margin:0 0 6px">${esc(detail)}</p>${url ? `<p style="font-family:monospace;font-size:12px;color:#6b7383;word-break:break-all">${esc(url)}</p>` : ''}
<p style="color:#9aa3b2">HTML Runner page server</p></main>`);
}

function statusPage(res, self) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HTML Runner page server</title>
<body style="font:15px/1.5 system-ui,sans-serif;background:#0c0f15;color:#e6e9ef;margin:0;padding:24px">
<h1 style="font-size:20px">HTML Runner page server is running</h1>
<p>In HTML Runner, open Home → ⚙ → <b>Page server</b> and enter:</p>
<p style="font-family:monospace;background:#151a23;padding:10px;border-radius:8px;word-break:break-all">${self}${KEY ? '/k/<your key>' : ''}</p>`);
}

const server = http.createServer(async (req, res) => {
  const self = selfOrigin(req);
  const u = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*', 'access-control-max-age': '600' });
      return res.end();
    }
    if (u.pathname === '/' && !KEY) return statusPage(res, self);
    if (u.pathname === '/' || u.pathname === '/favicon.ico' && !req.headers.referer) { res.writeHead(KEY ? 404 : 204); return res.end(); }

    if (u.pathname.startsWith(PREFIX + '/')) {
      const rest = u.pathname.slice(PREFIX.length);
      if (rest === '/__hr/ping') {
        res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ ok: true, app: 'html-runner-page-server', version: VERSION }));
      }
      if (rest === '/' && KEY) return statusPage(res, self);
      if (rest.startsWith('/p/')) {
        const info = parseProxyPath(req.url.slice(PREFIX.length));
        if (!info) return errorPage(res, 400, 'Not a page address', 'This address could not be read.');
        if (/^\/p\/[A-Za-z0-9_-]+$/.test(rest)) { res.writeHead(301, { location: req.url.replace(/(\/p\/[A-Za-z0-9_-]+)/, '$1/') }); return res.end(); }
        return await proxyRequest(req, res, info, self);
      }
    }

    // A page asked for "/something" on this server (a script built the address itself).
    // The address of the page that asked tells us which site it meant.
    const ref = req.headers.referer && unproxyFull(req.headers.referer, self);
    if (ref) {
      const fixed = proxied(new URL(req.url, ref));
      res.writeHead(307, { location: fixed, 'cache-control': 'no-store' });
      return res.end();
    }
    return errorPage(res, 404, 'Not found', 'This address is not a page on the HTML Runner page server.');
  } catch (err) {
    const target = (() => { try { return parseProxyPath(req.url.slice(PREFIX.length)).target.href; } catch (e) { return ''; } })();
    const why = err.status ? err.message : (err.cause && (err.cause.code || err.cause.message)) || err.message;
    console.warn('[page server]', req.method, target || req.url, '→', why);
    errorPage(res, err.status || 502, 'This page couldn’t load', String(why), target);
  }
});

/* ---------------- live connections (WebSocket) ---------------- */
server.on('upgrade', async (req, socket, head) => {
  socket.on('error', () => {});
  try {
    const self = selfOrigin(req);
    if (!req.url.startsWith(PREFIX + '/p/')) throw new Error('bad address');
    const info = parseProxyPath(req.url.slice(PREFIX.length));
    if (!info) throw new Error('bad address');
    const t = info.target;
    await checkHost(t.hostname);
    const secure = t.protocol === 'https:';
    const port = Number(t.port) || (secure ? 443 : 80);
    const up = secure ? tls.connect({ host: t.hostname, port, servername: t.hostname }) : net.connect({ host: t.hostname, port });
    up.on('error', () => socket.destroy());
    up.once(secure ? 'secureConnect' : 'connect', () => {
      const lines = [`GET ${t.pathname}${t.search} HTTP/1.1`, `Host: ${t.host}`];
      for (const k of ['upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'sec-websocket-protocol', 'user-agent', 'accept-language', 'pragma', 'cache-control']) {
        if (req.headers[k]) lines.push(`${k}: ${req.headers[k]}`);
      }
      if (req.headers.cookie) lines.push('cookie: ' + cookieHeaderOut(req.headers.cookie));
      lines.push('origin: ' + ((req.headers.referer && unproxyFull(req.headers.referer, self)) ? new URL(unproxyFull(req.headers.referer, self)).origin : t.origin));
      up.write(lines.join('\r\n') + '\r\n\r\n');
      if (head && head.length) up.write(head);
      up.pipe(socket); socket.pipe(up);
    });
    socket.on('close', () => up.destroy());
  } catch (e) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(PORT, () => {
  console.log(`HTML Runner page server: http://localhost:${PORT}${PREFIX || ''}`);
  if (!KEY) console.log('  No PROXY_KEY set. Fine on your own computer; set one before putting this on the internet.');
});

/* ---------------- optional: serve HTML Runner itself (for running everything on one computer) ---------------- */
if (APP_PORT) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/hr-proxy.json') {
      // tells HTML Runner where its page server is, so it's set up without typing anything
      const host = (req.headers.host || 'localhost').replace(/:\d+$/, '');
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ proxy: `http://${host}:${PORT}${PREFIX}` }));
    }
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.resolve(APP_DIR, '.' + p);
    if (!file.startsWith(APP_DIR + path.sep) || file.startsWith(path.join(APP_DIR, 'server') + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) {
        // preview/ and apps/ are made by the app's service worker; anything else is missing
        res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found');
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(data);
    });
  }).listen(APP_PORT, () => console.log(`HTML Runner app:          http://localhost:${APP_PORT}  (already set up to use the page server)`));
}

module.exports = { rewriteHtml, rewriteCss, rewriteSetCookie, parseProxyPath };
