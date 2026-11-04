// Everything the page shows: the board, the tape, families, the market, the round clock.
const { q, init, ROUND_MS } = require('./_db');
module.exports = async (req, res) => {
  try {
    await init();
    const [bws, eqs, pos, tape, meta, counts, last] = await Promise.all([
      q(`select id, name, kind, style, risk, persona, parents, gen, handle, look, cash, fails from bw_bwains where active order by id`),
      q(`select bwain_id, round, equity from (select bwain_id, round, equity, row_number() over (partition by bwain_id order by round desc) rn from bw_equity) x where rn <= 40 order by bwain_id, round`),
      q(`select bwain_id, mint, symbol, qty, cost from bw_pos where qty > 0`),
      q(`select t.ts, t.side, t.symbol, t.mint, t.usd, t.why, t.clash, b.name, b.look from bw_trades t join bw_bwains b on b.id = t.bwain_id order by t.id desc limit 60`),
      q(`select k, v, n from bw_meta where k in ('round', 'round_at', 'market', 'prices')`),
      q(`select bwain_id, count(*)::int as n from bw_trades group by bwain_id`),
      q(`select bwain_id, side, symbol, why from (select bwain_id, side, symbol, why, row_number() over (partition by bwain_id order by id desc) rn from bw_trades) x where rn <= 3`),
    ]);
    const M = Object.fromEntries(meta.map((r) => [r.k, r]));
    const px = M.prices && M.prices.v ? JSON.parse(M.prices.v) : {};
    const bwains = bws.map((b) => {
      const hs = pos.filter((p) => p.bwain_id === b.id).map((p) => { const v = p.qty * (px[p.mint] || 0); return { symbol: p.symbol, value: v, pnl_pct: p.cost ? (v / p.cost - 1) * 100 : 0 }; }).sort((x, y) => y.value - x.value);
      const equity = Number(b.cash) + hs.reduce((t, h) => t + h.value, 0);
      const sp = eqs.filter((e) => e.bwain_id === b.id).map((e) => Number(e.equity));
      return {
        id: b.id, name: b.name, kind: b.kind, style: b.style, risk: b.risk, persona: b.persona, parents: b.parents || [], gen: b.gen, handle: b.handle, look: b.look,
        cash: Number(b.cash), equity, pnl_pct: (equity / 1000 - 1) * 100, spark: sp.length ? [1000, ...sp] : [], holdings: hs.slice(0, 6),
        last: last.filter((l) => l.bwain_id === b.id), trades: (counts.find((c) => c.bwain_id === b.id) || { n: 0 }).n, offline: b.kind === 'byo' && b.fails >= 3,
      };
    }).sort((x, y) => y.equity - x.equity);
    const byId = Object.fromEntries(bws.map((b) => [b.id, b]));
    const families = bws.filter((b) => b.parents && b.parents.length === 2).reverse().slice(0, 24).map((c) => ({ c_name: c.name, c_look: c.look, a_look: (byId[c.parents[0]] || {}).look || 0, b_look: (byId[c.parents[1]] || {}).look || 0 }));
    const round = M.round ? Number(M.round.n) : 0, at = M.round_at ? Number(M.round_at.n) : 0;
    res.setHeader('Cache-Control', 's-maxage=8, stale-while-revalidate=20');
    res.json({ round, next_at: at ? at + ROUND_MS : 0, bwains, tape: tape.map((t) => ({ ts: Date.parse(t.ts), side: t.side, symbol: t.symbol, mint: t.mint, usd: t.usd, why: t.why, clash: t.clash, name: t.name, look: t.look })),
      market: M.market && M.market.v ? JSON.parse(M.market.v) : [], market_at: M.market ? Number(M.market.n) : 0, families });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
