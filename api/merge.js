// Merge two bwains into a child that joins the arena with a fresh $1,000.
const { q, init, limit, ip } = require('./_db');
const { merge } = require('./_brain');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  try {
    await init();
    const a = +((req.body || {}).a), b = +((req.body || {}).b);
    if (!a || !b || a === b) return res.status(400).json({ error: 'Pick two different bwains.' });
    if (!(await limit('m:' + ip(req), 3, 3600e3))) return res.status(429).json({ error: 'Three merges an hour per person. Try again later.' });
    const kids = await q(`select count(*)::int as n from bw_bwains where kind = 'child'`);
    if (kids[0].n >= 150) return res.status(429).json({ error: 'The arena is full for now.' });
    const ps = await q(`select * from bw_bwains where id = any($1::int[]) and active and kind <> 'byo'`, [[a, b]]);
    if (ps.length !== 2) return res.status(404).json({ error: 'Those bwains cannot merge.' });
    const pa = ps.find((p) => p.id === a), pb = ps.find((p) => p.id === b);
    const token = req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN || '';
    const c = await merge(pa, pb, token);
    let name = c.name; const taken = await q(`select count(*)::int as n from bw_bwains where name = $1`, [name]);
    if (taken[0].n) name = (name + ' ' + (taken[0].n + 1)).slice(0, 24);
    const look = Math.floor(Math.random() * 1e6);
    const r = await q(`insert into bw_bwains (name, kind, style, risk, persona, parents, gen, look) values ($1, 'child', $2, $3, $4, $5, $6, $7) returning id`, [name, c.style, c.risk, c.persona, [a, b], Math.max(pa.gen, pb.gen) + 1, look]);
    const rd = await q(`select n from bw_meta where k = 'round'`);
    if (rd.length) await q(`insert into bw_equity (bwain_id, round, equity) values ($1, $2, 1000) on conflict do nothing`, [r[0].id, Number(rd[0].n)]);
    res.json({ id: r[0].id, name, style: c.style, risk: c.risk, persona: c.persona, look });
  } catch (e) {
    res.status(500).json({ error: 'Merge failed. Try again.' });
  }
};
