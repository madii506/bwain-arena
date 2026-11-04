// One arena round: read the live market, let every bwain (or plugged-in agent) decide, fill on paper at live prices (1% cost), record clashes.
const { q, init, ROUND_MS } = require('./_db');
const { universe, prices } = require('./_market');
const { decide } = require('./_brain');
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
module.exports = async (req, res) => {
  try {
    await init();
    const now = Date.now();
    const force = !!process.env.TICK_KEY && req.query.key === process.env.TICK_KEY;
    const got = await q(`insert into bw_meta (k, v, n) values ('round_at', '', $1) on conflict (k) do update set n = $1 where bw_meta.n < $2 returning n`, [now, force ? now + 1 : now - ROUND_MS + 15000]);
    if (!got.length) { const m = await q(`select n from bw_meta where k = 'round_at'`); return res.json({ skipped: true, next_at: Number(m[0].n) + ROUND_MS }); }
    const market = await universe();
    if (!market.length) { await q(`update bw_meta set n = $1 where k = 'round_at'`, [now - ROUND_MS + 60000]); return res.status(502).json({ error: 'The market feed is empty right now.' }); }
    const rr = await q(`insert into bw_meta (k, n) values ('round', 1) on conflict (k) do update set n = bw_meta.n + 1 returning n`);
    const round = Number(rr[0].n);
    const bws = await q(`select * from bw_bwains where active order by id`);
    const pos = await q(`select * from bw_pos where qty > 0`);
    const px = {}; market.forEach((m) => (px[m.mint] = m.price));
    const missing = [...new Set(pos.map((p) => p.mint))].filter((m) => !(m in px));
    if (missing.length) Object.assign(px, await prices(missing));
    const token = req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN || '';
    const ctxFor = (bw) => {
      let extra = 100;
      const P = pos.filter((p) => p.bwain_id === bw.id).map((p) => {
        const mk = market.find((m) => m.mint === p.mint); const price = px[p.mint] || 0; const value = p.qty * price;
        return { i: mk ? mk.i : extra++, mint: p.mint, symbol: p.symbol, qty: p.qty, cost: p.cost, value, price, pnl_pct: p.cost ? (value / p.cost - 1) * 100 : 0, chg1h: mk ? mk.chg1h : 0 };
      });
      const cash = Number(bw.cash);
      return { round, market, positions: P, cash, equity: cash + P.reduce((t, p) => t + p.value, 0) };
    };
    const decisions = await pool(bws, 5, async (bw) => { const ctx = ctxFor(bw); const d = await decide(bw, ctx, token); return { bw, ctx, ...d }; });
    const trades = [];
    for (const d of decisions) {
      let cash = d.ctx.cash; const P = new Map(d.ctx.positions.map((p) => [p.mint, { ...p }]));
      for (const a of d.actions) {
        const price = px[a.mint]; if (!(price > 0)) continue;
        if (a.side === 'buy') {
          const amt = Math.min(cash, cash * a.pct / 100); if (amt < 5) continue;
          const fill = price * 1.01; const p = P.get(a.mint) || { mint: a.mint, symbol: a.symbol, qty: 0, cost: 0 };
          p.qty += amt / fill; p.cost += amt; P.set(a.mint, p); cash -= amt;
          trades.push({ bw: d.bw, side: 'buy', mint: a.mint, symbol: a.symbol, usd: amt, price: fill, why: a.why });
        } else {
          const p = P.get(a.mint); if (!p || p.qty <= 0) continue;
          const qty = p.qty * a.pct / 100, fill = price * 0.99, amt = qty * fill;
          p.cost -= p.cost * (qty / p.qty); p.qty -= qty; if (p.qty * price < 0.01) { p.qty = 0; p.cost = 0; }
          cash += amt;
          trades.push({ bw: d.bw, side: 'sell', mint: a.mint, symbol: p.symbol || a.symbol, usd: amt, price: fill, why: a.why });
        }
      }
      d.cash = cash; d.P = P;
    }
    const sides = {};
    trades.forEach((t) => { const s = (sides[t.mint] = sides[t.mint] || { buy: new Set(), sell: new Set() }); s[t.side].add(t.bw.id); });
    trades.forEach((t) => { const s = sides[t.mint]; t.clash = s.buy.size > 0 && s.sell.size > 0 && !(s.buy.size === 1 && s.sell.size === 1 && [...s.buy][0] === [...s.sell][0]); });
    if (trades.length) {
      await q(`insert into bw_trades (round, bwain_id, side, mint, symbol, usd, price, why, clash) select $1, * from unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::float8[], $7::float8[], $8::text[], $9::bool[])`,
        [round, trades.map((t) => t.bw.id), trades.map((t) => t.side), trades.map((t) => t.mint), trades.map((t) => t.symbol), trades.map((t) => t.usd), trades.map((t) => t.price), trades.map((t) => t.why), trades.map((t) => t.clash)]);
    }
    for (const d of decisions) {
      await q(`update bw_bwains set cash = $2, fails = case when $3 then fails + 1 else 0 end where id = $1`, [d.bw.id, d.cash, d.src === 'agent-fail']);
      for (const p of d.P.values()) {
        if (p.qty > 0) await q(`insert into bw_pos (bwain_id, mint, symbol, qty, cost) values ($1, $2, $3, $4, $5) on conflict (bwain_id, mint) do update set qty = $4, cost = $5, symbol = $3`, [d.bw.id, p.mint, p.symbol, p.qty, p.cost]);
        else await q(`delete from bw_pos where bwain_id = $1 and mint = $2`, [d.bw.id, p.mint]);
      }
      const eq = d.cash + [...d.P.values()].reduce((t, p) => t + p.qty * (px[p.mint] || 0), 0);
      await q(`insert into bw_equity (bwain_id, round, equity) values ($1, $2, $3) on conflict do nothing`, [d.bw.id, round, eq]);
    }
    await q(`insert into bw_meta (k, v, n) values ('market', $1, $2) on conflict (k) do update set v = $1, n = $2`, [JSON.stringify(market), now]);
    await q(`insert into bw_meta (k, v, n) values ('prices', $1, $2) on conflict (k) do update set v = $1, n = $2`, [JSON.stringify(px), now]);
    const src = {}; decisions.forEach((d) => (src[d.src] = (src[d.src] || 0) + 1));
    res.json({ round, trades: trades.length, clashes: trades.filter((t) => t.clash).length, sources: src, ms: Date.now() - now });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
