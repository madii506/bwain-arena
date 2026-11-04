(() => {
const CFG = window.BWAIN || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const say = (t) => { $('#live').textContent = t; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (n, dp) => { if (!isFinite(n)) return '—'; const a = Math.abs(n), s = n < 0 ? '-$' : '$'; if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M'; if (a >= 1e4) return s + (a / 1e3).toFixed(1) + 'K'; return s + a.toLocaleString('en-US', { minimumFractionDigits: dp ?? 2, maximumFractionDigits: dp ?? 2 }); };
const pct = (n) => (isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(Math.abs(n) >= 100 ? 0 : 1) + '%' : '—');
const cls = (n) => (n > 0 ? 'up' : n < 0 ? 'dn' : '');
const price = (p) => (!isFinite(p) || !p ? '—' : p >= 1 ? '$' + p.toFixed(3) : p >= 0.01 ? '$' + p.toFixed(4) : '$' + p.toPrecision(3));
const ago = (t) => { const s = Math.max(1, (Date.now() - t) / 1000); return s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
const two = (n) => String(n).padStart(2, '0');
const hms = (t) => { const d = new Date(t); return two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ':' + two(d.getUTCSeconds()); };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const trim = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const FONT = '"JBM", "JetBrains Mono", ui-monospace, monospace';

/* ---------- the ASCII brain (side view): cerebrum, cerebellum, stem ---------- */
const RAMP = ' .:-=+*o#%@';
function brain(x, y) {
  let ink = 0;
  const cx = 0, cy = -0.06, rx = 0.5, ry = 0.34;
  let dy = (y - cy) / ry, dx = (x - cx) / rx;
  if (y > cy) dy *= 1.25 + 0.6 * Math.max(0, x);
  if (x < 0) dx *= 1 - 0.1 * Math.max(0, -dy);
  const d = dx * dx + dy * dy;
  if (d <= 1) {
    const u = x + 0.05 * Math.sin(9 * y + 2 * x) + 0.03 * Math.sin(17 * y), v = y + 0.05 * Math.sin(11 * x + 1.3);
    const f = 0.5 + 0.25 * (Math.sin(31 * u + 6 * Math.sin(6 * v)) + Math.sin(28 * v + 6 * Math.sin(6.5 * u)));
    ink = d > 0.88 ? 0.95 : f > 0.6 ? 0.85 : f > 0.42 ? 0.45 : 0.12;
    if (Math.abs((y - 0.06) - 0.22 * (x + 0.05)) < 0.022 && x > -0.32 && x < 0.12) ink = 0;
  }
  const de = ((x - 0.3) / 0.17) ** 2 + ((y - 0.25) / 0.105) ** 2;
  if (de <= 1 && ink === 0) ink = de > 0.8 ? 0.95 : Math.sin(y * 120) > 0.2 ? 0.8 : 0.25;
  const sx = 0.12 + 0.18 * (y - 0.06);
  if (y > 0.06 && y < 0.46 && Math.abs(x - sx) < 0.045 && ink === 0) ink = Math.abs(x - sx) > 0.03 ? 0.95 : 0.55;
  return ink;
}
const charOf = (ink) => RAMP[Math.min(RAMP.length - 1, Math.round(ink * (RAMP.length - 1)))];
function brainCells(cols, rows, cw, ch, W, H, scale, oy = 0) {
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = ((i + 0.5) * cw - W / 2) / scale, y = ((j + 0.5) * ch - H / 2 - oy) / scale;
    const ink = brain(x, y);
    if (ink > 0.05) cells.push({ i, j, x, ink, ch: charOf(ink) });
  }
  return cells;
}
const fontReady = document.fonts ? document.fonts.load(`600 12px ${FONT}`).catch(() => {}) : Promise.resolve();

/* ---------- live ASCII brain: churns, a scan line every few seconds ---------- */
function liveBrain(cv) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, fs = Math.round(W / 60), cw = fs * 0.6, ch = fs * 1.2;
  const cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
  const cells = brainCells(cols, rows, cw, ch, W, H, W * 0.86, H * 0.04);
  cells.forEach((k) => { k.cur = k.ch; k.flash = 0; });
  let last = 0, scan = -1, nextScan = 900, visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);
  function draw(now) {
    requestAnimationFrame(draw);
    if (document.hidden || !visible || now - last < 70) return; last = now;
    c.clearRect(0, 0, W, H); c.font = `600 ${fs}px ${FONT}`; c.textBaseline = 'top';
    if (!RM) for (let n = 0; n < cells.length * 0.03; n++) { const k = cells[(Math.random() * cells.length) | 0]; const idx = Math.max(1, Math.min(RAMP.length - 1, RAMP.indexOf(k.ch) + ((Math.random() * 3) | 0) - 1)); k.cur = RAMP[idx]; k.flash = 1; }
    if (!RM && now > nextScan) { scan = 0; nextScan = now + 4200; }
    if (scan >= 0) { scan += H / 24; if (scan > H + ch * 4) scan = -1; }
    for (const k of cells) {
      let a = 0.3 + 0.7 * k.ink, pink = false;
      if (k.flash > 0) { a = Math.min(1, a + 0.4 * k.flash); k.flash -= 0.25; if (k.flash <= 0) k.cur = k.ch; }
      const y = k.j * ch; if (scan >= 0 && Math.abs(y - scan) < ch * 2.2) { a = 1; pink = Math.abs(y - scan) < ch * 0.8; }
      c.fillStyle = pink ? '#ff8fb1' : `rgba(236,236,240,${a})`; c.fillText(k.cur, k.i * cw, y);
    }
  }
  fontReady.finally(() => requestAnimationFrame(draw));
}
liveBrain($('#hb')); liveBrain($('#eb'));

/* ---------- the room: falling character trails behind the page ---------- */
(function rain() {
  const cv = $('#rain'), c = cv.getContext('2d'), CH = '.:-=+*o#%@01<>/|';
  let W = 0, H = 0, fs = 14, cw = 8.4, rh = 17, cols = 0, trails = [];
  const pick = () => CH[(Math.random() * CH.length) | 0];
  const mk = (init) => ({ x: ((Math.random() * cols) | 0) * cw * 2, y: init ? Math.random() * H : -Math.random() * H * 0.6, v: rh * (0.18 + Math.random() * 0.55), len: 5 + ((Math.random() * 18) | 0), pink: Math.random() < 0.16, cs: Array.from({ length: 24 }, pick) });
  function size() {
    const dpr = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    fs = W < 640 ? 12 : 14; cw = fs * 0.6; rh = fs * 1.25; cols = Math.ceil(W / (cw * 2));
    trails = Array.from({ length: Math.max(8, Math.round(cols * (W < 640 ? 0.22 : 0.16))) }, () => mk(true));
  }
  function paint() {
    c.clearRect(0, 0, W, H); c.font = `500 ${fs}px ${FONT}`; c.textBaseline = 'top';
    for (const t of trails) {
      const r0 = Math.floor(t.y / rh);
      for (let k = 0; k < t.len; k++) {
        const y = (r0 - k) * rh; if (y < -rh || y > H) continue;
        const a = k === 0 ? 0.24 : 0.11 * (1 - k / t.len);
        c.fillStyle = t.pink ? `rgba(255,143,177,${a})` : `rgba(236,236,240,${a})`;
        c.fillText(t.cs[k % t.cs.length], t.x, y);
      }
    }
  }
  let last = 0;
  function step(now) {
    requestAnimationFrame(step);
    if (document.hidden || now - last < 42) return; last = now;
    for (const t of trails) {
      t.y += t.v;
      if (Math.random() < 0.3) t.cs[(Math.random() * t.len) | 0] = pick();
      if ((Math.floor(t.y / rh) - t.len) * rh > H) Object.assign(t, mk(false));
    }
    paint();
  }
  size(); addEventListener('resize', size);
  fontReady.finally(() => { if (RM) paint(); else requestAnimationFrame(step); });
})();

/* ---------- the wordmark, block letters; the W is pink ---------- */
(function fig() {
  const B = ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '];
  const Wl = ['██╗    ██╗', '██║    ██║', '██║ █╗ ██║', '██║███╗██║', '╚███╔███╔╝', ' ╚══╝╚══╝ '];
  const A = [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'];
  const I = ['██╗', '██║', '██║', '██║', '██║', '╚═╝'];
  const N = ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'];
  const run = (str, pink) => str.replace(/█+|[^█]+/g, (m) => m[0] === '█' ? `<span class="${pink ? 'w' : ''}">${m}</span>` : `<span class="${pink ? 'ws' : 's'}">${m}</span>`);
  const el = $('#fig');
  el.innerHTML = B.map((_, r) => run(B[r]) + run(Wl[r], true) + run(A[r] + I[r] + N[r])).join('\n');
  if (!RM) setInterval(() => { if (document.hidden) return; el.classList.remove('gl'); void el.offsetWidth; el.classList.add('gl'); }, 5200);
})();

/* ---------- pixel bwains: one deterministic look per bwain ---------- */
const SP = 20, OUT = '#22142c';
const MASK = (() => { const m = []; const lobes = [[6.4, 9.6, 3.5], [10, 8.5, 3.8], [13.6, 9.6, 3.5], [5, 12.6, 3.3], [15, 12.6, 3.3], [8, 14.6, 3.2], [12, 14.6, 3.2]];
  for (let y = 0; y < SP; y++) { m[y] = []; for (let x = 0; x < SP; x++) { const px = x + 0.5, py = y + 0.5; let ins = ((px - 10) / 6.3) ** 2 + ((py - 12.2) / 4.7) ** 2 <= 1; for (const [a, b, r] of lobes) if ((px - a) ** 2 + (py - b) ** 2 <= r * r) ins = true; m[y][x] = ins; } } return m; })();
const FOLDS = [[10, 6], [10, 7], [10, 8], [10, 9], [6, 9], [7, 10], [13, 9], [12, 10], [4, 12], [5, 13], [15, 12], [16, 13], [8, 7], [12, 7], [6, 15], [14, 15]];
const BODIES = [['#ff8fb1', '#d65884'], ['#7cecc4', '#40b08c'], ['#ffce5c', '#d69628'], ['#a8d6ff', '#6096d6'], ['#ceb0ff', '#9670de'], ['#f5f2ec', '#c4bcb0']];
const ACCS = ['crown', 'cap', 'phones', 'antenna', 'halo', 'tophat', 'party', 'beanie', 'band', null];
const EYES = ['dot', 'dot', 'shades', 'visor', 'laser', 'wink'];
const ACOL = ['#e6465a', '#3c5cdc', '#26b6a8', '#f6a830', '#886cf0', '#ff7aa8'];
function hash(n) { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; }
const bodyOf = (seed) => BODIES[hash(seed + 7) % 6][0];
const spriteCache = new Map();
function sprite(seed) {
  if (spriteCache.has(seed)) return spriteCache.get(seed);
  const h = hash(seed + 7), body = BODIES[h % 6], acc = ACCS[(h >>> 3) % ACCS.length], eyes = EYES[(h >>> 7) % EYES.length], ac = ACOL[(h >>> 11) % ACOL.length];
  const g = Array.from({ length: SP }, () => Array(SP).fill(null));
  const px = (x, y, c) => { if (x >= 0 && x < SP && y >= 0 && y < SP) g[y][x] = c; };
  for (let y = 0; y < SP; y++) for (let x = 0; x < SP; x++) if (MASK[y][x]) g[y][x] = body[0];
  for (const [x, y] of FOLDS) if (MASK[y][x]) g[y][x] = body[1];
  for (let y = 0; y < SP; y++) for (let x = 0; x < SP; x++) if (!MASK[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => MASK[y + dy] && MASK[y + dy][x + dx])) g[y][x] = OUT;
  if (eyes === 'dot') { px(8, 12, OUT); px(12, 12, OUT); px(8, 11, OUT); px(12, 11, OUT); }
  else if (eyes === 'shades') { for (let x = 6; x < 15; x++) px(x, 12, '#141418'); [[7, 11], [8, 11], [12, 11], [13, 11]].forEach(([x, y]) => px(x, y, '#141418')); px(8, 12, '#5a5a6e'); }
  else if (eyes === 'visor') { for (let x = 5; x < 16; x++) px(x, 12, '#3ce6e6'); px(7, 12, '#d2ffff'); }
  else if (eyes === 'laser') { px(8, 12, '#ff2828'); px(12, 12, '#ff2828'); px(8, 11, OUT); px(12, 11, OUT); for (let k = 1; k < 4; k++) px(12 + k, 12 + (k >> 1), '#ff463c'); }
  else { px(8, 12, OUT); px(8, 11, OUT); px(11, 12, OUT); px(12, 12, OUT); px(13, 12, OUT); }
  px(9, 14, OUT); px(10, 15, OUT); px(11, 14, OUT);
  if (acc === 'crown') { for (let x = 7; x < 14; x++) { px(x, 6, '#ffd640'); px(x, 5, '#ffd640'); } [7, 10, 13].forEach((x) => { px(x, 4, '#ffd640'); px(x, 3, '#ffd640'); }); px(10, 5, '#e63c50'); }
  else if (acc === 'cap') { for (let x = 6; x < 14; x++) for (const y of [4, 5, 6]) px(x, y, ac); for (let x = 12; x < 17; x++) px(x, 6, ac); px(9, 4, '#fff'); }
  else if (acc === 'phones') { for (let x = 5; x < 16; x++) px(x, 4, OUT); px(4, 5, OUT); px(16, 5, OUT); for (let y = 9; y < 13; y++) { px(3, y, ac); px(17, y, ac); } }
  else if (acc === 'antenna') { for (let y = 2; y < 6; y++) px(13, y, OUT); px(13, 1, '#7cf5d0'); px(14, 1, '#7cf5d0'); px(13, 0, '#7cf5d0'); }
  else if (acc === 'halo') { for (let x = 7; x < 14; x++) px(x, 2, '#ffe264'); px(6, 3, '#ffe264'); px(14, 3, '#ffe264'); }
  else if (acc === 'tophat') { for (let x = 7; x < 14; x++) for (let y = 0; y < 5; y++) px(x, y, '#18161e'); for (let x = 5; x < 16; x++) px(x, 5, '#18161e'); for (let x = 7; x < 14; x++) px(x, 4, ac); }
  else if (acc === 'party') { [[10, 10], [9, 11], [9, 11], [8, 12], [8, 12]].forEach(([a, b], k) => { for (let x = a; x <= b; x++) px(x, 1 + k, ac); }); px(10, 0, '#ffdc50'); px(9, 3, '#fff'); px(11, 4, '#fff'); }
  else if (acc === 'beanie') { for (let x = 6; x < 15; x++) { px(x, 4, ac); px(x, 5, ac); px(x, 6, '#fff'); } for (let x = 7; x < 14; x++) px(x, 3, ac); px(10, 2, '#fff'); }
  else if (acc === 'band') { for (let x = 3; x < 17; x++) px(x, 9, ac); px(17, 10, ac); px(18, 11, ac); }
  const cv = document.createElement('canvas'); cv.width = SP; cv.height = SP; const c = cv.getContext('2d');
  for (let y = 0; y < SP; y++) for (let x = 0; x < SP; x++) if (g[y][x]) { c.fillStyle = g[y][x]; c.fillRect(x, y, 1, 1); }
  spriteCache.set(seed, cv); return cv;
}
const TILE = ['#3c5cdc', '#f5eede', '#f6a830', '#886cf0', '#f06292', '#26b6a8'];
function avatar(cv, seed) {
  const s = cv.width, c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = TILE[hash(seed + 3) % TILE.length]; c.fillRect(0, 0, s, s);
  c.drawImage(sprite(seed), s * 0.06, s * 0.04, s * 0.88, s * 0.88);
}
function avatarEl(seed, size) { const cv = document.createElement('canvas'); cv.width = cv.height = size * 2; cv.className = 'px'; avatar(cv, seed); return cv; }
const avs = (root, size) => $$('.avs', root).forEach((s) => s.replaceWith(avatarEl(+s.dataset.seed, size)));
const STYLE_COL = { momentum: '#8ec5ff', contrarian: '#ffce5c', volume: '#7cecc4', hold: '#f5eede', scalp: '#ceb0ff', whale: '#ff8fb1', degen: '#ff5c6c', safe: '#6ef5a8', agent: '#ffffff' };
const styleOf = (w) => (w.kind === 'byo' ? 'agent' : w.style);
const tg = (s) => `<span class="tg" style="--c:${STYLE_COL[s] || '#ccc'}">${esc(s)}</span>`;
const risk = (r) => '●'.repeat(Math.max(0, Math.min(5, r | 0))) + '·'.repeat(5 - Math.max(0, Math.min(5, r | 0)));
const BL = '▁▂▃▄▅▆▇█';
function blocks(arr, n = 10) {
  if (!arr || arr.length < 2) return '<span class="dim">··········</span>';
  const a = arr.slice(-n), lo = Math.min(...a), hi = Math.max(...a), r = hi - lo;
  return `<span class="${a[a.length - 1] >= a[0] ? 'up' : 'dn'}">${a.map((v) => BL[r ? Math.round((v - lo) / r * 7) : 3]).join('')}</span>`;
}

/* ---------- terminal scroll: each section types its command, then prints line by line ---------- */
const PROMPT = '<span class="u">bwain@arena</span><span class="p">:~</span><span class="d">$</span> ';
function printNew(root, fast) {
  const sec = root.matches && root.matches('[data-run]') ? root : root.closest('[data-run]');
  if (!sec || !sec.classList.contains('run')) return;
  const L = $$('.pl:not(.on)', root), step = Math.min(fast ? 16 : 55, 1400 / Math.max(1, L.length));
  L.forEach((el, k) => (RM ? el.classList.add('on') : setTimeout(() => el.classList.add('on'), step * k)));
}
function run(sec) {
  const cmd = $('.cmd', sec);
  const done = () => { sec.classList.add('run'); printNew(sec); };
  if (!cmd) return done();
  const text = cmd.dataset.cmd;
  if (RM) { cmd.innerHTML = PROMPT + esc(text); return done(); }
  cmd.innerHTML = PROMPT + '<span class="ct"></span><i class="cur"></i>';
  const ct = $('.ct', cmd); let i = 0;
  (function type() { ct.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(type, 14 + Math.random() * 30); else setTimeout(() => { const c = $('.cur', cmd); if (c && sec.id !== 'sh') c.remove(); done(); }, 140); })();
}
const runIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { runIO.unobserve(e.target); run(e.target); } }), { rootMargin: '0px 0px -14% 0px', threshold: 0 });
$$('[data-run]').forEach((s) => runIO.observe(s));
const setCmd = (el, text) => { el.dataset.cmd = text; if (el.closest('[data-run]').classList.contains('run')) el.innerHTML = PROMPT + esc(text); };

/* ---------- status bar: active window, scroll position like a pager ---------- */
const WIN = $$('#win a');
const winIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) WIN.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-42% 0px -52% 0px' });
$$('main section[id], #sh').forEach((s) => winIO.observe(s));
let sTick = false;
function scrollPct() {
  sTick = false; const max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? scrollY / max : 0;
  $('#bpct').textContent = max <= 0 ? 'All' : p < 0.004 ? 'Top' : p > 0.996 ? 'Bot' : Math.round(p * 100) + '%';
  if (scrollY < innerHeight * 0.4) WIN.forEach((a) => a.classList.remove('on'));
}
addEventListener('scroll', () => { if (!sTick) { sTick = true; requestAnimationFrame(scrollPct); } }, { passive: true });
scrollPct();

/* ---------- state ---------- */
let ST = null, SEL = null, MA = null, MB = null, NEXT = 0, SORT = 'equity', QF = '', GREP = 'all';
const SORTS = { equity: (a, b) => b.equity - a.equity, pnl: (a, b) => b.pnl_pct - a.pnl_pct, calls: (a, b) => b.trades - a.trades, name: (a, b) => a.name.localeCompare(b.name) };
const SEEN = new Set();
const fresh = (el) => (el.dataset.drawn ? 'pl on' : 'pl');
function clashGroups() {
  const out = [], T = (ST && ST.tape) || [], done = new Set();
  for (const t of T) {
    if (!t.clash) continue; const k = t.ts + '|' + t.symbol; if (done.has(k)) continue; done.add(k);
    const g = T.filter((x) => x.clash && x.ts === t.ts && x.symbol === t.symbol);
    const b = g.find((x) => x.side === 'buy'), s = g.find((x) => x.side === 'sell');
    if (b && s) out.push({ b, s, symbol: t.symbol, ts: t.ts });
  }
  return out;
}
const cd = () => { const s = Math.max(0, Math.round((NEXT - Date.now()) / 1000)); return NEXT ? (s > 0 ? two(Math.floor(s / 60)) + ':' + two(s % 60) : 'now') : '--:--'; };

function renderBoot(err) {
  const el = $('#boot'), c = fresh(el);
  if (err) { el.innerHTML = `<div class="${c}"><span class="dn">[fail]</span> arena not answering · retrying by itself</div>`; el.dataset.drawn = 1; printNew(el); return; }
  const B = ST.bwains, M = ST.market || [], kids = B.filter((w) => w.kind === 'child').length, byo = B.filter((w) => w.kind === 'byo').length;
  const trades = B.reduce((t, w) => t + w.trades, 0), clashes = clashGroups().length;
  const L = [
    `<span class="ok">[ ok ]</span> <em>${B.length}</em> bwains awake · <em>${kids}</em> merged · <em>${byo}</em> agents plugged in`,
    M.length ? `<span class="ok">[ ok ]</span> market: <em>${M.length}</em> pump.fun coins · read ${ago(ST.market_at)} ago` : `<span class="amb">[warn]</span> market feed not answering this round`,
    ST.round ? `<span class="ok">[ ok ]</span> round <em>${ST.round}</em> · next in <em data-k="cd">${cd()}</em>` : `<span class="amb">[ .. ]</span> round 1 starts any moment`,
    `<span class="ok">[ ok ]</span> <em>${trades}</em> trades · <em>${clashes}</em> clash${clashes === 1 ? '' : 'es'}`,
    `<span class="amb">[ !! ]</span> paper money · live prices · 1% cost per trade`,
  ];
  el.innerHTML = L.map((l) => `<div class="${c}">${l}</div>`).join('');
  el.dataset.drawn = 1; printNew(el);
}
function renderRoster() {
  const el = $('#roster');
  el.innerHTML = ST.bwains.slice(0, 24).map((w) => `<button type="button" data-id="${w.id}" class="${cls(w.pnl_pct) || 'dim'}" title="${esc(w.name)} ${pct(w.pnl_pct)}" aria-label="${esc(w.name)}"><span class="avs" data-seed="${w.look}"></span></button>`).join('');
  avs(el, 38);
}
$('#roster').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; SEL = +b.dataset.id; renderBoard(); renderDetail(true); $('#top').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); });
let TKS = '';
function renderTicker() {
  const M = ST.market || [], T = (ST.tape || []).slice(0, 18);
  const a = M.map((m) => `<span><b>${esc(m.symbol)}</b> <i class="${cls(m.chg1h)}">${m.chg1h >= 0 ? '▲' : '▼'} ${pct(m.chg1h)}</i> <em>1h</em></span>`).join('');
  const b = T.map((t) => `<span><b>${esc(t.name)}</b> <i class="${t.side === 'buy' ? 'up' : 'dn'}">${t.side}</i> ${esc(t.symbol)} <em>“${esc(trim(t.why, 54))}”</em></span>`).join('');
  const key = a + b; if (key === TKS) return; TKS = key;
  $('#ticker').hidden = !a && !b;
  const t1 = $('#tk1'), t2 = $('#tk2');
  t1.innerHTML = a + a; t2.innerHTML = b + b; t1.hidden = !a; t2.hidden = !b;
  requestAnimationFrame(() => { t1.style.setProperty('--d', Math.max(30, t1.scrollWidth / 2 / 55) + 's'); t2.style.setProperty('--d', Math.max(30, t2.scrollWidth / 2 / 45) + 's'); });
}
function meter(label, frac, val, col) {
  const f = Math.max(0, Math.min(1, frac || 0));
  return `<div class="mt"><b>${label}</b><span class="br">[<span class="bf"><i style="width:${(f * 100).toFixed(1)}%;color:${col}">${'|'.repeat(160)}</i><em>${val}</em></span>]</span></div>`;
}
function renderMeters() {
  const B = ST.bwains; if (!B.length) return;
  const eq = B.reduce((t, w) => t + w.equity, 0), cash = B.reduce((t, w) => t + w.cash, 0), up = B.filter((w) => w.pnl_pct > 0).length;
  const left = NEXT ? Math.max(0, NEXT - Date.now()) : 0, el = ST.round ? 1 - left / 600000 : 0;
  $('#meters').innerHTML = meter('CASH', eq ? cash / eq : 0, (eq ? cash / eq * 100 : 0).toFixed(1) + '%', 'var(--up)') + meter('UP', up / B.length, up + '/' + B.length, up / B.length >= 0.5 ? 'var(--up)' : 'var(--dn)') + meter('ROUND', el, cd(), 'var(--pink)');
  const lead = B[0], cl = clashGroups().length, M = ST.market || [];
  $('#facts').innerHTML = `<div>Bwains: <b>${B.filter((w) => w.kind === 'house').length}</b> house, <b>${B.filter((w) => w.kind === 'child').length}</b> merged, <b>${B.filter((w) => w.kind === 'byo').length}</b> agents</div><div>Trades: <b>${B.reduce((t, w) => t + w.trades, 0)}</b> · clashes: <b class="pk">${cl}</b></div><div>Leader: <b>${esc(lead.name)}</b> <span class="${cls(lead.pnl_pct)}">${pct(lead.pnl_pct)}</span></div><div>Market: <b>${M.length}</b> coins · round <b>${ST.round || '—'}</b></div>`;
}
function renderBoard() {
  const el = $('#board'), c = fresh(el);
  let L = ST.bwains.slice().sort(SORTS[SORT]); if (QF) L = L.filter((w) => w.name.toLowerCase().includes(QF));
  el.innerHTML = `<div class="pr th"><span class="r">PID</span><span></span><span>BWAIN</span><span>STYLE</span><span>RISK</span><span class="r">EQUITY</span><span class="r">PNL%</span><span class="r">CALLS</span><span>TREND</span></div>` +
    (L.length ? L.map((w) => `<div class="pr ${c}${w.id === SEL ? ' sel' : ''}${w.offline ? ' off' : ''}" data-id="${w.id}" role="button" tabindex="0" aria-label="${esc(w.name)}"><span class="r dim">${w.id}</span><span class="avs" data-seed="${w.look}"></span><span class="nm">${esc(w.name)}</span><span>${tg(styleOf(w))}</span><span class="amb">${risk(w.risk)}</span><span class="r num">${usd(w.equity)}</span><span class="r num ${cls(w.pnl_pct)}">${pct(w.pnl_pct)}</span><span class="r num">${w.trades}</span><span class="spk">${blocks(w.spark)}</span></div>`).join('')
      : `<div class="empty">no bwain matches “${esc(QF)}”.</div>`);
  avs(el, 26); el.dataset.drawn = 1; printNew(el, true);
}
function typeInto(el, text) {
  if (RM) { el.textContent = text; return; }
  const id = (el._tid = (el._tid || 0) + 1); let i = 0;
  (function step() { if (el._tid !== id) return; i = Math.min(text.length, i + 3); el.textContent = text.slice(0, i); if (i < text.length) setTimeout(step, 12); })();
}
function renderDetail(typeIt) {
  const w = ST.bwains.find((x) => x.id === SEL) || ST.bwains[0]; if (!w) return; SEL = w.id;
  const d = $('#detail'), c = fresh(d);
  const par = (w.parents || []).map((p) => ST.bwains.find((x) => x.id === p)).filter(Boolean);
  const who = w.kind === 'byo' ? 'plugged in' + (w.handle ? ' by ' + esc(w.handle) : '') : w.kind === 'child' ? 'gen ' + w.gen + (par.length ? ' · child of ' + par.map((p) => esc(p.name)).join(' + ') : '') : 'house bwain';
  d.innerHTML = `<div class="path ${c}">~/bwains/${esc(slug(w.name))}</div>
    <div class="dh ${c}"><span id="dav"></span><div><b>${esc(w.name)}</b><small>${tg(styleOf(w))} ${who}</small></div></div>
    <p class="persona ${c}" id="pers"></p>
    <div class="kv num ${c}"><div><b>EQUITY</b><span>${usd(w.equity)}</span></div><div><b>PNL</b><span class="${cls(w.pnl_pct)}">${pct(w.pnl_pct)}</span></div><div><b>CASH</b><span>${usd(w.cash)}</span></div></div>
    <canvas id="eq" class="${c}"></canvas>
    <div class="ls ${c}"><div class="lh">$ ls bag/</div>${(w.holdings || []).length ? w.holdings.map((h) => `<div class="li"><span>${esc(h.symbol)}</span><em class="num">${usd(h.value)} <span class="${cls(h.pnl_pct)}">${pct(h.pnl_pct)}</span></em></div>`).join('') : '<div class="li"><span class="dim">all cash.</span></div>'}</div>
    <div class="ls ${c}"><div class="lh">$ tail -3 calls.log</div>${(w.last || []).length ? w.last.map((t) => `<div class="li"><span><span class="${t.side === 'buy' ? 'up' : 'dn'}">${t.side}</span> ${esc(t.symbol)}</span><em>${esc(trim(t.why, 46))}</em></div>`).join('') : '<div class="li"><span class="dim">no calls yet.</span></div>'}</div>`;
  $('#dav').replaceWith(avatarEl(w.look, 72));
  const pers = $('#pers'), txt = w.persona || '';
  if (typeIt) typeInto(pers, txt); else pers.textContent = txt;
  d.dataset.drawn = 1; printNew(d, true); drawEq(w.spark || []);
}
function drawEq(s) {
  const cv = $('#eq'); if (!cv) return; const dp = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 300, h = cv.clientHeight || 96;
  cv.width = w * dp; cv.height = h * dp; const c = cv.getContext('2d'); c.scale(dp, dp);
  c.font = `500 11px ${FONT}`; c.textBaseline = 'top';
  if (s.length < 2) { c.fillStyle = '#62626f'; c.fillText('equity line starts after the first rounds.', 0, 8); return; }
  const lo = Math.min(...s, 1000), hi = Math.max(...s, 1000), r = hi - lo || 1, X = (i) => 1 + i / (s.length - 1) * (w - 2), Y = (v) => h - 6 - (v - lo) / r * (h - 22);
  c.strokeStyle = 'rgba(255,255,255,.07)'; for (let k = 0; k < 4; k++) { const y = 10 + k * (h - 16) / 3; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.setLineDash([2, 4]); c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(0, Y(1000)); c.lineTo(w, Y(1000)); c.stroke(); c.setLineDash([]);
  const up = s[s.length - 1] >= 1000; c.strokeStyle = up ? '#6ef5a8' : '#ff5c6c'; c.lineWidth = 1.6; c.beginPath();
  s.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)))); c.stroke();
  c.fillStyle = c.strokeStyle; const lx = X(s.length - 1), ly = Y(s[s.length - 1]); c.fillRect(lx - 3, ly - 3, 6, 6);
  c.fillStyle = '#62626f'; c.fillText('$1,000', 2, Math.max(0, Math.min(h - 12, Y(1000) - 13)));
}
function renderLog() {
  const el = $('#log'), first = !el.dataset.drawn, T = ((ST && ST.tape) || []).slice().reverse();
  const F = T.filter((t) => GREP === 'all' || (GREP === 'clash' ? t.clash : t.side === GREP));
  let html = '', lastTs = 0;
  if (!F.length) html = `<div class="empty">${T.length ? 'no lines match.' : 'no trades yet. the first round starts any moment.'}</div>`;
  for (const t of F) {
    if (t.ts !== lastTs) { const k = 's' + t.ts + GREP; html += `<div class="ll sep ${SEEN.has(k) && !first ? 'pl on' : 'pl'}">── round · ${hms(t.ts)} UTC ──────────</div>`; SEEN.add(k); lastTs = t.ts; }
    const k = [t.ts, t.name, t.symbol, t.side, t.usd].join('|'), isNew = first || !SEEN.has(k); SEEN.add(k);
    html += `<div class="ll ${isNew ? 'pl' : 'pl on'}${t.clash ? ' cl' : ''}"><span class="t dim">${hms(t.ts)}</span><span class="avs" data-seed="${t.look}"></span><span class="n">${esc(t.name)}</span><span class="sd ${t.side === 'buy' ? 'up' : 'dn'}">${t.side === 'buy' ? 'BUY' : 'SELL'}</span><span class="sy">${esc(t.symbol)}</span><span class="r num">${usd(t.usd)}</span><span class="w">${t.clash ? '<b class="clb">CLASH</b> ' : ''}“${esc(t.why || '')}”</span></div>`;
  }
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.innerHTML = html; avs(el, 18); el.dataset.drawn = 1;
  if (first || atBottom) el.scrollTop = el.scrollHeight;
  printNew(el, true);
}
$('#grep').addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (!b) return; GREP = b.dataset.g; $$('#grep button').forEach((x) => x.classList.toggle('on', x === b)); if (ST) renderLog(); });
function renderClash() {
  const el = $('#clash'), G = clashGroups(), c = fresh(el);
  if (!G.length) { el.innerHTML = `<div class="vh ${c}">LATEST CLASH</div><div class="empty ${c}">no clash yet. when two bwains take opposite sides of the same coin in one round, it lands here.</div>`; el.dataset.drawn = 1; printNew(el); return; }
  const g = G[0];
  el.innerHTML = `<div class="vh ${c}">LATEST CLASH · ${esc(g.symbol)}<span>${ago(g.ts)} ago · ${G.length} so far</span></div>
    <div class="vc ${c}"><div class="side"><span class="avs" data-seed="${g.b.look}"></span><b>${esc(g.b.name)}</b><strong class="up">BUY ${usd(g.b.usd, 0)}</strong></div><div class="x">VS</div><div class="side"><span class="avs" data-seed="${g.s.look}"></span><b>${esc(g.s.name)}</b><strong class="dn">SELL ${usd(g.s.usd, 0)}</strong></div></div>
    <div class="q ${c}"><div class="up"><span>“${esc(g.b.why || '')}”</span></div><div class="dn"><span>“${esc(g.s.why || '')}”</span></div></div>`;
  avs(el, 84); el.dataset.drawn = 1; printNew(el);
}
function renderMarket() {
  const M = ST.market || [], box = $('#mk'), heat = $('#heat'), c = fresh(box);
  if (!M.length) { box.innerHTML = '<div class="empty">the market feed is not answering right now. the next round reads it again.</div>'; heat.innerHTML = ''; return; }
  const vmax = Math.max(...M.map((m) => m.vol1h || 0), 1);
  heat.innerHTML = M.map((m) => { const a = Math.min(0.42, 0.05 + Math.abs(m.chg1h || 0) / 45); return `<a class="hc ${c}" href="https://pump.fun/coin/${encodeURIComponent(m.mint)}" target="_blank" rel="noopener" style="--c:${(m.chg1h || 0) >= 0 ? '110,245,168' : '255,92,108'};--a:${a.toFixed(3)}"><b>${esc(m.symbol)}</b><span>${pct(m.chg1h)}</span><small>vol 1h ${usd(m.vol1h, 0)}</small></a>`; }).join('');
  box.innerHTML = `<div class="mr th"><span>#</span><span>COIN</span><span class="r">PRICE</span><span class="r">5M</span><span class="r">1H</span><span class="r">24H</span><span>VOL 1H</span><span class="r">LIQ</span><span class="r">MCAP</span></div>` +
    M.map((m, i) => `<div class="mr ${c}"><span class="dim">${i + 1}</span><a href="https://pump.fun/coin/${encodeURIComponent(m.mint)}" target="_blank" rel="noopener">${esc(m.symbol)}</a><span class="r num">${price(m.price)}</span><span class="r num ${cls(m.chg5m)}">${pct(m.chg5m)}</span><span class="r num ${cls(m.chg1h)}">${pct(m.chg1h)}</span><span class="r num ${cls(m.chg24h)}">${pct(m.chg24h)}</span><span class="vb"><i>${'█'.repeat(Math.max(1, Math.round((m.vol1h || 0) / vmax * 12)))}</i><span class="num">${usd(m.vol1h, 0)}</span></span><span class="r num">${usd(m.liq, 0)}</span><span class="r num">${usd(m.mcap, 0)}</span></div>`).join('');
  $('#kstat').textContent = M.length + ' coins · read ' + (ST.market_at ? ago(ST.market_at) + ' ago' : '—');
  box.dataset.drawn = 1; heat.dataset.drawn = 1; printNew(box, true); printNew(heat, true);
}

/* ---------- merge ---------- */
const mergeable = () => ST.bwains.filter((w) => w.kind !== 'byo');
function slotHTML(id, sel) {
  const w = ST.bwains.find((x) => x.id === sel);
  return `<span class="avs" data-seed="${w ? w.look : 0}"></span><b>${w ? esc(w.name) : ''}</b><small>${w ? tg(styleOf(w)) + ' <span class="' + cls(w.pnl_pct) + '">' + pct(w.pnl_pct) + '</span>' : ''}</small><select data-slot="${id}" aria-label="Parent ${id === 'a' ? 'one' : 'two'}">${mergeable().map((x) => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
}
function renderMerge() {
  const L = mergeable(); if (L.length < 2) return;
  if (!MA || !L.find((w) => w.id === MA)) MA = L[0].id;
  if (!MB || MB === MA || !L.find((w) => w.id === MB)) MB = L.find((w) => w.id !== MA).id;
  $('#pa').innerHTML = slotHTML('a', MA); $('#pb').innerHTML = slotHTML('b', MB); avs($('#pa'), 104); avs($('#pb'), 104);
  const a = ST.bwains.find((w) => w.id === MA), b = ST.bwains.find((w) => w.id === MB);
  setCmd($('#mcmd'), `bwain merge "${a.name}" "${b.name}"`);
  FZ.ca = bodyOf(a.look); FZ.cb = bodyOf(b.look);
  renderTree();
}
function renderTree() {
  const el = $('#tree'), c = fresh(el), byId = Object.fromEntries(ST.bwains.map((w) => [w.id, w]));
  const kids = ST.bwains.filter((w) => w.kind === 'child').sort((x, y) => x.gen - y.gen || x.id - y.id);
  let html = `<div class="tl ${c} dim" id="treehead">$ bwain tree</div>`;
  if (!kids.length) html += `<div class="tl ${c}">└── no merges yet. be the first.</div>`;
  const gens = [...new Set(kids.map((k) => k.gen))];
  for (const g of gens) {
    const ks = kids.filter((k) => k.gen === g);
    html += `<div class="tl ${c}"><span class="pk">gen ${g}</span></div>`;
    ks.forEach((k, i) => { const p = (k.parents || []).map((id) => byId[id]); html += `<div class="tl ${c}"><span class="dim">${i === ks.length - 1 ? '└──' : '├──'}</span><span class="avs" data-seed="${k.look}"></span><b>${esc(k.name)}</b><span class="dim">← ${p.map((x) => (x ? esc(x.name) : 'retired')).join(' + ')}</span><span class="${cls(k.pnl_pct)}">${pct(k.pnl_pct)}</span></div>`; });
  }
  el.innerHTML = html; avs(el, 18); el.dataset.drawn = 1; printNew(el, true);
}
document.addEventListener('change', (e) => { const s = e.target.closest('select[data-slot]'); if (!s) return; if (s.dataset.slot === 'a') MA = +s.value; else MB = +s.value; renderMerge(); });

/* the fusion chamber: two ASCII brains drift, then collide into one */
const FZ = { cv: $('#fz'), mode: 'idle', t0: 0, ca: '#ff8fb1', cb: '#7cecc4', cells: null };
(function fuse() {
  const cv = FZ.cv, c = cv.getContext('2d'), W = cv.width, H = cv.height, fs = 12, cw = fs * 0.6, ch = fs * 1.2, s = H * 0.66;
  const cols = Math.ceil(s * 1.2 / cw), rows = Math.ceil(s * 0.95 / ch), cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const dx = (i + 0.5) * cw - cols * cw / 2, dy = (j + 0.5) * ch - rows * ch / 2, ink = brain(dx / s, dy / s + 0.02); if (ink > 0.05) cells.push({ dx, dy, ink, ch: charOf(ink), cur: charOf(ink) }); }
  const sparks = Array.from({ length: 26 }, () => ({ t: Math.random(), y: (Math.random() - 0.5) * H * 0.5, side: Math.random() < 0.5 ? -1 : 1, ch: RAMP[1 + ((Math.random() * 9) | 0)] }));
  let visible = true, last = 0;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, t), 3);
  function drawBrain(cx, cy, mirror, col, alpha, scramble) {
    c.fillStyle = col;
    for (const k of cells) {
      if (scramble && Math.random() < scramble) k.cur = RAMP[1 + ((Math.random() * 9) | 0)]; else if (!scramble && k.cur !== k.ch && Math.random() < 0.2) k.cur = k.ch;
      c.globalAlpha = Math.min(1, (0.3 + 0.7 * k.ink) * alpha); c.fillText(k.cur, cx + (mirror ? -k.dx : k.dx) - cw / 2, cy + k.dy - ch / 2);
    }
    c.globalAlpha = 1;
  }
  function draw(now) {
    requestAnimationFrame(draw);
    if (document.hidden || !visible || now - last < 50) return; last = now;
    c.clearRect(0, 0, W, H); c.font = `600 ${fs}px ${FONT}`; c.textBaseline = 'top';
    const t = (now - FZ.t0) / 1000, cy = H / 2;
    if (FZ.mode === 'idle') {
      const bob = RM ? 0 : Math.sin(now / 600) * 3;
      drawBrain(W * 0.25, cy + bob, true, FZ.ca, 0.95, 0);
      drawBrain(W * 0.75, cy - bob, false, FZ.cb, 0.95, 0);
      c.fillStyle = 'rgba(255,255,255,.55)';
      if (!RM) for (const p of sparks) { p.t += 0.012; if (p.t > 1) { p.t = 0; p.side = -p.side; p.y = (Math.random() - 0.5) * H * 0.5; p.ch = RAMP[1 + ((Math.random() * 9) | 0)]; } const x = p.side < 0 ? W * (0.38 + 0.12 * p.t) : W * (0.62 - 0.12 * p.t); c.globalAlpha = Math.sin(p.t * Math.PI) * 0.8; c.fillText(p.ch, x, cy + p.y * (1 - p.t)); }
      c.globalAlpha = 1; c.fillStyle = '#ff8fb1'; c.font = `800 ${fs * 2.4}px ${FONT}`; c.fillText('+', W / 2 - fs * 0.7, cy - fs * 1.4);
    } else if (FZ.mode === 'merging') {
      const e = ease(t / 0.9), xa = W * (0.25 + 0.25 * e), xb = W * (0.75 - 0.25 * e);
      drawBrain(xa, cy, true, FZ.ca, 0.9, 0.25 + 0.5 * e);
      drawBrain(xb, cy, false, FZ.cb, 0.9, 0.25 + 0.5 * e);
      if (t > 0.9) drawBrain(W / 2, cy, false, '#ffffff', 0.5 + 0.5 * Math.abs(Math.sin(now / 90)), 0.6);
    } else if (FZ.mode === 'born') {
      drawBrain(W / 2, cy, false, '#ff8fb1', Math.min(1, 0.4 + t), Math.max(0, 0.5 - t * 0.5));
      if (t > 3.2) FZ.mode = 'idle';
    } else if (FZ.mode === 'fail') {
      drawBrain(W * 0.25, cy, true, '#ff5c6c', 0.8, 0.1); drawBrain(W * 0.75, cy, false, '#ff5c6c', 0.8, 0.1);
      if (t > 1.6) FZ.mode = 'idle';
    }
  }
  fontReady.finally(() => requestAnimationFrame(draw));
})();
$('#mbtn').addEventListener('click', async () => {
  const st = $('#mstat'); st.className = '';
  if (!ST || MA === MB) { st.textContent = 'pick two different bwains.'; st.className = 'err'; return; }
  $('#mbtn').disabled = true; st.textContent = 'merging minds…'; FZ.mode = 'merging'; FZ.t0 = performance.now();
  const started = Date.now();
  try {
    const r = await fetch('/api/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: MA, b: MB }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'merge failed.');
    await new Promise((res) => setTimeout(res, Math.max(0, 1300 - (Date.now() - started))));
    FZ.mode = 'born'; FZ.t0 = performance.now();
    const a = ST.bwains.find((w) => w.id === MA), b = ST.bwains.find((w) => w.id === MB), cert = $('#cert');
    cert.innerHTML = `<span id="cav"></span><dl><dt>$ cat</dt><dd class="dim">~/bwains/${esc(slug(j.name))}/birth</dd><dt>name</dt><dd><b>${esc(j.name)}</b></dd><dt>parents</dt><dd>${esc(a ? a.name : '?')} + ${esc(b ? b.name : '?')}</dd><dt>style</dt><dd>${tg(j.style)} · risk <span class="amb">${risk(j.risk)}</span></dd><dt>bag</dt><dd>$1,000.00 paper · trades from the next round</dd><dt>mind</dt><dd id="cmind"></dd></dl>`;
    cert.hidden = false; $('#cav').replaceWith(avatarEl(j.look, 112)); typeInto($('#cmind'), j.persona || '');
    st.textContent = j.name + ' joined the arena.'; say(j.name + ' was born');
    load();
  } catch (e) { FZ.mode = 'fail'; FZ.t0 = performance.now(); st.textContent = e.message; st.className = 'err'; }
  finally { $('#mbtn').disabled = false; }
});

/* ---------- bring your own agent ---------- */
async function agentCall(register) {
  const out = $('#ares'), body = { name: $('#an').value.trim(), endpoint: $('#ae').value.trim(), handle: $('#ax').value.trim(), register };
  out.className = ''; out.textContent = register ? '> plugging in…' : '> calling your agent…';
  try {
    const r = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'failed.');
    out.className = 'ok';
    out.textContent = register ? `> ${j.name} is in the arena. it trades from the next round.` : `> answered in ${j.ms} ms with ${j.actions.length} valid action${j.actions.length === 1 ? '' : 's'}\n` + JSON.stringify(j.actions, null, 1);
    if (register) load();
  } catch (e) { out.className = 'err'; out.textContent = '> ' + e.message; }
}
$('#atest').addEventListener('click', () => agentCall(false));
$('#aform').addEventListener('submit', (e) => { e.preventDefault(); agentCall(true); });

/* ---------- board controls (htop keys) ---------- */
$('#fsort').addEventListener('click', () => { const K = Object.keys(SORTS); SORT = K[(K.indexOf(SORT) + 1) % K.length]; $('#sortk').textContent = SORT; if (ST) renderBoard(); });
$('#fsearch').addEventListener('click', () => { const q = $('#q'); q.hidden = !q.hidden; if (!q.hidden) q.focus(); else { q.value = ''; QF = ''; if (ST) renderBoard(); } });
$('#q').addEventListener('input', (e) => { QF = e.target.value.trim().toLowerCase(); if (ST) renderBoard(); });
const pickRow = (r) => { SEL = +r.dataset.id; renderBoard(); renderDetail(true); };
$('#board').addEventListener('click', (e) => { const r = e.target.closest('.pr[data-id]'); if (r) pickRow(r); });
$('#board').addEventListener('keydown', (e) => { const r = e.target.closest('.pr[data-id]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickRow(r); } });

/* ---------- the shell ---------- */
const SHO = $('#sho'), SHI = $('#shi'), HIST = []; let HI = 0;
const shOut = (html, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; SHO.appendChild(d); SHO.scrollTop = SHO.scrollHeight; };
const go = (id) => { const el = $(id); if (el) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); };
const need = () => (ST ? null : 'the arena is still connecting. try again in a second.');
const findB = (q) => ST.bwains.find((w) => w.name.toLowerCase() === q) || ST.bwains.find((w) => w.name.toLowerCase().includes(q));
const CMDS = {
  help: () => esc(['commands:', '  top             the leaderboard', '  tail            the last trades', '  market          the hottest coins', '  round           the round clock', '  ls              every bwain', '  cat <name>      read a bwain\'s mind', '  merge · plug · man · faq   jump there', '  keys            keyboard shortcuts', '  ca              the $BWAIN contract', '  clear'].join('\n')),
  top: () => need() || ST.bwains.slice(0, 8).map((w, i) => `${String(i + 1).padStart(2)}  ${esc(w.name.padEnd(22).slice(0, 22))} ${usd(w.equity).padStart(10)}  <span class="${cls(w.pnl_pct)}">${pct(w.pnl_pct).padStart(7)}</span>`).join('\n'),
  tail: () => need() || (ST.tape.length ? ST.tape.slice(0, 8).map((t) => `${hms(t.ts)}  ${esc(t.name.padEnd(18).slice(0, 18))} <span class="${t.side === 'buy' ? 'up' : 'dn'}">${t.side.padEnd(4)}</span> ${esc(t.symbol.padEnd(10))} “${esc(trim(t.why, 40))}”`).join('\n') : 'no trades yet.'),
  market: () => need() || (ST.market.length ? ST.market.slice(0, 8).map((m) => `${esc(m.symbol.padEnd(12))} ${price(m.price).padStart(10)}  1h <span class="${cls(m.chg1h)}">${pct(m.chg1h).padStart(7)}</span>  vol ${usd(m.vol1h, 0)}`).join('\n') : 'the market feed is not answering right now.'),
  round: () => need() || (ST.round ? `round ${ST.round} · next in ${cd()} · rounds run every 10 minutes` : 'round 1 starts any moment.'),
  ls: () => need() || ST.bwains.map((w) => esc(w.name)).join('  '),
  cat: (a) => { if (need()) return need(); if (!a) return 'usage: cat <name>'; const w = findB(a.toLowerCase()); return w ? `<b>${esc(w.name)}</b> ${tg(styleOf(w))}\n${esc(w.persona || '')}` : `cat: ${esc(a)}: no such bwain`; },
  merge: () => { go('#merge'); return 'opening merge…'; },
  plug: () => { go('#agents'); return 'opening plug…'; },
  man: () => { go('#man'); return 'opening the manual…'; },
  faq: () => { go('#help'); return 'opening help…'; },
  keys: () => 'j / k     scroll\nd / u     half a page\ng g / G   top / bottom\n0 – 7     jump to a window\n/         this shell',
  ca: () => (CFG.ca ? esc(CFG.ca) : '$BWAIN is not live yet.'),
  whoami: () => 'a human. the bwains are watching.',
  date: () => new Date().toUTCString(),
  echo: (a) => esc(a),
  sudo: () => 'nice try. bwains do not take orders.',
  exit: () => 'there is no exit. the arena never closes.',
  clear: () => { SHO.innerHTML = ''; return null; },
};
function exec(line) {
  const raw = line.trim(); shOut(PROMPT + esc(raw), 'in'); if (!raw) return;
  HIST.push(raw); HI = HIST.length;
  const [cmd, ...rest] = raw.split(/\s+/), f = CMDS[cmd.toLowerCase()];
  const out = f ? f(rest.join(' ')) : `${esc(cmd)}: command not found. try help`;
  if (out) shOut(out);
}
SHI.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { exec(SHI.value); SHI.value = ''; }
  else if (e.key === 'ArrowUp') { if (HI > 0) { HI--; SHI.value = HIST[HI]; } e.preventDefault(); }
  else if (e.key === 'ArrowDown') { if (HI < HIST.length) { HI++; SHI.value = HIST[HI] || ''; } e.preventDefault(); }
  else if (e.key === 'Tab') { e.preventDefault(); const m = Object.keys(CMDS).filter((k) => k.startsWith(SHI.value.trim())); if (m.length === 1) SHI.value = m[0] + ' '; else if (m.length) shOut(m.join('  ')); }
});
$('.shell').addEventListener('click', (e) => { if (!e.target.closest('a,button') && !getSelection().toString()) SHI.focus({ preventScroll: true }); });
shOut('<span class="dim">bwain arena shell · type help</span>');

/* ---------- vim keys: the page scrolls like a pager ---------- */
let gAt = 0;
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  const k = e.key, H = innerHeight;
  if (k === 'j') scrollBy({ top: 120 }); else if (k === 'k') scrollBy({ top: -120 });
  else if (k === 'd') scrollBy({ top: H / 2 }); else if (k === 'u') scrollBy({ top: -H / 2 });
  else if (k === 'G') scrollTo({ top: document.documentElement.scrollHeight });
  else if (k === 'g') { if (Date.now() - gAt < 500) scrollTo({ top: 0 }); gAt = Date.now(); }
  else if (/^[0-7]$/.test(k)) { const a = WIN[+k]; if (a) go(a.getAttribute('href')); }
  else if (k === '/') { e.preventDefault(); go('#sh'); setTimeout(() => SHI.focus({ preventScroll: true }), RM ? 0 : 600); }
});

/* ---------- clock + rounds ---------- */
function second() {
  const now = new Date(); $('#bclk').textContent = hms(now) + ' UTC';
  if (!ST) return;
  $('#brd').textContent = ST.round || '—'; $('#bcd').textContent = cd();
  $$('[data-k="cd"]').forEach((e) => (e.textContent = cd()));
  const left = NEXT ? Math.max(0, NEXT - Date.now()) : 0, f = ST.round ? 1 - left / 600000 : 0;
  const m = $$('#meters .mt')[2]; if (m) { $('i', m).style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%'; $('em', m).textContent = cd(); }
}
setInterval(second, 1000); second();
async function load() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'offline');
    ST = j; NEXT = j.next_at || 0;
    renderBoot(); renderRoster(); renderTicker(); renderMeters(); renderBoard(); renderDetail(); renderLog(); renderClash(); renderMarket(); renderMerge(); second();
  } catch (e) {
    if (!ST) { renderBoot(true); $('#board').innerHTML = '<div class="empty">the arena is not answering right now. it retries by itself.</div>'; }
  }
}
const nudge = () => fetch('/api/tick', { method: 'POST' }).then((r) => r.json()).then((j) => { if (j && j.round) setTimeout(load, 300); }).catch(() => {});
load(); nudge();
setInterval(() => { if (!document.hidden) load(); }, 20000);
setInterval(() => { if (!document.hidden && NEXT && Date.now() > NEXT + 2000) nudge(); }, 15000);
addEventListener('resize', () => { if (ST) { const w = ST.bwains.find((x) => x.id === SEL); if (w) drawEq(w.spark || []); } });

/* ---------- $BWAIN pill, only when the coin is live ---------- */
if (CFG.ca) {
  $$('.ca-slot').forEach((el) => { el.innerHTML = `<div class="ca"><code>${esc(CFG.ca.slice(0, 4))}…${esc(CFG.ca.slice(-4))}</code><button type="button" data-copy>Copy</button><a href="https://pump.fun/coin/${encodeURIComponent(CFG.ca)}" target="_blank" rel="noopener">Buy</a><a href="https://dexscreener.com/solana/${encodeURIComponent(CFG.ca)}" target="_blank" rel="noopener">Chart</a>${CFG.x ? `<a href="${esc(CFG.x)}" target="_blank" rel="noopener">X</a>` : ''}</div>`; });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (!b) return; navigator.clipboard.writeText(CFG.ca).then(() => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1400); }); });
}
})();
