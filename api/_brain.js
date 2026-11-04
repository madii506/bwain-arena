// The minds: an LLM call through Vercel's AI Gateway (OIDC), house rules as a fallback, and agents over HTTP.
const GW = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODELS = ['openai/gpt-4.1-mini', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash'];
const STYLES = ['momentum', 'contrarian', 'volume', 'hold', 'scalp', 'whale', 'degen', 'safe'];
function parseJSON(t) { t = String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); return JSON.parse(t.slice(a, b + 1)); }
async function llm(token, messages, max = 380) {
  const key = process.env.AI_GATEWAY_API_KEY || token; if (!key) throw new Error('no ai token');
  let last;
  for (const model of MODELS) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(GW, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify({ model, messages, max_tokens: max, temperature: 0.85 }) });
      clearTimeout(tm);
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || 'ai ' + r.status);
      return parseJSON(j.choices[0].message.content);
    } catch (e) { last = e; }
  }
  throw last;
}
function marketLines(ctx) {
  return ctx.market.map((m) => `${m.i}|${m.symbol}|${m.price.toPrecision(4)}|${m.chg5m.toFixed(1)}|${m.chg1h.toFixed(1)}|${m.chg24h.toFixed(0)}|${Math.round(m.vol1h)}|${Math.round(m.liq)}|${Math.round(m.mcap)}`).join('\n');
}
function validate(actions, ctx) {
  const out = [];
  for (const a of Array.isArray(actions) ? actions.slice(0, 3) : []) {
    if (!a || (a.side !== 'buy' && a.side !== 'sell')) continue;
    let m = null;
    if (Number.isInteger(+a.i) && ctx.market[+a.i]) m = ctx.market[+a.i];
    if (!m && a.mint) m = ctx.market.find((x) => x.mint === a.mint) || ctx.positions.find((p) => p.mint === a.mint);
    if (!m && a.side === 'sell' && Number.isInteger(+a.i)) m = ctx.positions.find((p) => p.i === +a.i);
    if (!m) continue;
    let pct = Math.round(+a.pct || 0);
    if (a.side === 'buy') { pct = Math.max(1, Math.min(30, pct || 10)); if (ctx.cash < 5) continue; }
    else { pct = Math.max(10, Math.min(100, pct || 100)); if (!ctx.positions.find((p) => p.mint === m.mint)) continue; }
    out.push({ side: a.side, mint: m.mint, symbol: m.symbol, pct, why: String(a.why || '').replace(/[\r\n]+/g, ' ').slice(0, 90) });
  }
  return out;
}
function rules(bw, ctx) {
  const M = ctx.market, P = ctx.positions, s = bw.style, acts = [];
  const pick = (arr) => arr.length ? arr[0] : null;
  const sellIf = (cond, why) => P.forEach((p) => { if (cond(p)) acts.push({ side: 'sell', i: p.i, mint: p.mint, pct: 100, why }); });
  if (s === 'momentum') { sellIf((p) => p.chg1h < -6, 'chart turned red. out.'); const m = pick([...M].sort((a, b) => b.chg1h - a.chg1h)); if (m && m.chg1h > 5) acts.push({ side: 'buy', i: m.i, pct: 20, why: 'green candle. not arguing.' }); }
  else if (s === 'contrarian') { sellIf((p) => p.pnl_pct > 18, 'bounce came. thanks.'); const m = pick(M.filter((x) => x.vol1h > 30000).sort((a, b) => a.chg1h - b.chg1h)); if (m && m.chg1h < -6) acts.push({ side: 'buy', i: m.i, pct: 18, why: 'dumped on volume. buying the fear.' }); }
  else if (s === 'volume') { sellIf((p) => p.chg1h < -10, 'volume left. so do i.'); const m = pick([...M].sort((a, b) => b.vol1h / (b.liq || 1) - a.vol1h / (a.liq || 1))); if (m) acts.push({ side: 'buy', i: m.i, pct: 15, why: 'most money moving here.' }); }
  else if (s === 'hold') { sellIf((p) => p.pnl_pct < -45, 'even i have limits.'); if (!P.length) { const m = pick([...M].sort((a, b) => b.mcap - a.mcap)); if (m) acts.push({ side: 'buy', i: m.i, pct: 30, why: 'strongest coin. holding.' }); } }
  else if (s === 'scalp') { sellIf((p) => p.pnl_pct > 7 || p.pnl_pct < -5, 'small win, small loss. next.'); const m = pick([...M].sort((a, b) => b.chg5m - a.chg5m)); if (m && m.chg5m > 1.5) acts.push({ side: 'buy', i: m.i, pct: 12, why: 'quick one.' }); }
  else if (s === 'whale') { sellIf((p) => p.pnl_pct < -20 || p.pnl_pct > 40, 'closing the big one.'); if (!P.length) { const m = pick([...M].sort((a, b) => b.vol24h - a.vol24h)); if (m) acts.push({ side: 'buy', i: m.i, pct: 30, why: 'all in on the loudest coin.' }); } }
  else if (s === 'degen') { sellIf((p) => p.pnl_pct > 50 || p.pnl_pct < -35, 'rotating.'); const small = [...M].sort((a, b) => a.mcap - b.mcap).slice(0, 6); const m = small[(ctx.round * 7 + bw.id) % Math.max(1, small.length)]; if (m) acts.push({ side: 'buy', i: m.i, pct: 15, why: 'smallest, loudest. lets go.' }); }
  else { sellIf((p) => p.pnl_pct < -8 || p.pnl_pct > 12, 'slow hands. done.'); const m = pick([...M].sort((a, b) => b.liq - a.liq)); if (m && !P.find((p) => p.mint === m.mint)) acts.push({ side: 'buy', i: m.i, pct: 8, why: 'deepest pool on the board.' }); }
  return validate(acts, ctx);
}
function payload(bw, ctx) {
  return { round: ctx.round, you: { name: bw.name, cash_usd: +ctx.cash.toFixed(2), positions: ctx.positions.map((p) => ({ i: p.i, mint: p.mint, symbol: p.symbol, value_usd: +p.value.toFixed(2), pnl_pct: +p.pnl_pct.toFixed(1) })) },
    market: ctx.market.map((m) => ({ i: m.i, mint: m.mint, symbol: m.symbol, price_usd: m.price, chg_5m: m.chg5m, chg_1h: m.chg1h, chg_24h: m.chg24h, vol_1h: m.vol1h, liq_usd: m.liq, mcap_usd: m.mcap })) };
}
function safeUrl(u) {
  let x; try { x = new URL(u); } catch (e) { return null; }
  const h = x.hostname.toLowerCase();
  if (x.protocol !== 'https:' || x.port || x.username || x.password) return null;
  if (h === 'localhost' || /\.(local|internal|localhost|lan|home)$/.test(h) || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return null;
  return x.toString();
}
async function callAgent(endpoint, body) {
  const u = safeUrl(endpoint); if (!u) throw new Error('The endpoint must be a public https address.');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000); const t0 = Date.now();
  try {
    const r = await fetch(u, { method: 'POST', redirect: 'error', signal: ctl.signal, headers: { 'content-type': 'application/json', 'user-agent': 'bwain-arena' }, body: JSON.stringify(body) });
    const txt = (await r.text()).slice(0, 20000);
    if (!r.ok) throw new Error('Your agent answered ' + r.status + '.');
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('Your agent did not answer with JSON.'); }
    return { ms: Date.now() - t0, actions: j.actions };
  } catch (e) { if (e.name === 'AbortError') throw new Error('Your agent took longer than 6 seconds.'); throw e; }
  finally { clearTimeout(tm); }
}
async function decide(bw, ctx, token) {
  if (bw.kind === 'byo') {
    try { const r = await callAgent(bw.endpoint, payload(bw, ctx)); return { actions: validate(r.actions, ctx), src: 'agent' }; }
    catch (e) { return { actions: [], src: 'agent-fail' }; }
  }
  try {
    const sys = `You are "${bw.name}", an AI trading brain in BWAIN, a paper-trading arena where AI bwains trade the live pump.fun market against each other. Personality: ${bw.persona} Style: ${bw.style}. Risk ${bw.risk}/5.\nEach round you make 0 to 3 trades. Reply with JSON only: {"actions":[{"side":"buy" or "sell","i":<coin index>,"pct":<number>,"why":"<max 70 chars, your voice, lowercase>"}]}. buy pct = percent of your cash (1-30). sell pct = percent of that position (10-100). Use only indexes you are given. Stay in character.`;
    const user = `Round ${ctx.round}. Cash $${ctx.cash.toFixed(2)}. Equity $${ctx.equity.toFixed(2)}.\nYour positions (i|symbol|value|pnl%):\n${ctx.positions.map((p) => `${p.i}|${p.symbol}|${p.value.toFixed(2)}|${p.pnl_pct.toFixed(1)}`).join('\n') || 'none'}\nMarket (i|symbol|price|5m%|1h%|24h%|vol1h$|liq$|mcap$):\n${marketLines(ctx)}`;
    const j = await llm(token, [{ role: 'system', content: sys }, { role: 'user', content: user }]);
    return { actions: validate(j.actions, ctx), src: 'llm' };
  } catch (e) { return { actions: rules(bw, ctx), src: 'rules' }; }
}
async function merge(a, b, token) {
  try {
    const j = await llm(token, [{ role: 'system', content: 'You merge two AI trading brains into their child. Reply with JSON only: {"name":"<1-2 lowercase words, max 20 chars, a brainy or trading pun>","persona":"<max 150 chars, how it trades, mixing both parents>","style":"<one of ' + STYLES.join(', ') + '>","risk":<1-5>}' },
      { role: 'user', content: `Parent A: ${a.name} (${a.style}, risk ${a.risk}): ${a.persona}\nParent B: ${b.name} (${b.style}, risk ${b.risk}): ${b.persona}` }], 220);
    const name = String(j.name || '').toLowerCase().replace(/[^a-z0-9 \-]/g, '').trim().slice(0, 20);
    const style = STYLES.includes(j.style) ? j.style : a.style;
    if (name.length >= 3) return { name, persona: String(j.persona || '').slice(0, 160), style, risk: Math.max(1, Math.min(5, Math.round(+j.risk || 3))) };
  } catch (e) {}
  const w1 = a.name.split(' ')[0], w2 = b.name.split(' ').slice(-1)[0];
  return { name: (w1 + ' ' + w2).slice(0, 20), persona: `Half ${a.name}, half ${b.name}. ${a.persona.split('.')[0]}. ${b.persona.split('.')[0]}.`.slice(0, 160), style: Math.random() < 0.5 ? a.style : b.style, risk: Math.round((a.risk + b.risk) / 2) };
}
module.exports = { decide, merge, callAgent, validate, payload, safeUrl, STYLES };
