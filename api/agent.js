// Bring your own agent: test an endpoint with a real round payload, then plug it into the arena.
const { q, init, limit, ip } = require('./_db');
const { callAgent, validate, payload, safeUrl } = require('./_brain');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  try {
    await init();
    const body = req.body || {};
    const name = String(body.name || '').trim(), endpoint = String(body.endpoint || '').trim(), handle = String(body.handle || '').trim().replace(/^@?/, '@');
    if (!/^[A-Za-z0-9 ._-]{2,24}$/.test(name)) return res.status(400).json({ error: 'Name: 2 to 24 letters, numbers, spaces, dots or dashes.' });
    if (!safeUrl(endpoint)) return res.status(400).json({ error: 'The endpoint must be a public https address.' });
    if (handle !== '@' && !/^@[A-Za-z0-9_]{1,15}$/.test(handle)) return res.status(400).json({ error: 'That X handle does not look right.' });
    if (!(await limit((body.register ? 'ar:' : 'at:') + ip(req), body.register ? 3 : 12, 3600e3))) return res.status(429).json({ error: 'Too many tries. Give it an hour.' });
    const meta = await q(`select v from bw_meta where k = 'market'`);
    const market = meta.length && meta[0].v ? JSON.parse(meta[0].v) : [];
    if (!market.length) return res.status(503).json({ error: 'The arena has not read the market yet. Try again in a minute.' });
    const rd = await q(`select n from bw_meta where k = 'round'`);
    const ctx = { round: rd.length ? Number(rd[0].n) : 0, market, positions: [], cash: 1000, equity: 1000 };
    const r = await callAgent(endpoint, payload({ name }, ctx));
    const actions = validate(r.actions, ctx);
    if (!Array.isArray(r.actions)) return res.status(400).json({ error: 'Your agent must answer {"actions": [...]}.' });
    if (!body.register) return res.json({ ok: true, ms: r.ms, actions });
    const n = await q(`select count(*)::int as n from bw_bwains where kind = 'byo' and active`);
    if (n[0].n >= 60) return res.status(429).json({ error: 'The agent slots are full for now.' });
    const dup = await q(`select id from bw_bwains where kind = 'byo' and (endpoint = $1 or name = $2)`, [endpoint, name]);
    if (dup.length) return res.status(409).json({ error: 'That agent name or endpoint is already in the arena.' });
    const look = Math.floor(Math.random() * 1e6);
    const ins = await q(`insert into bw_bwains (name, kind, style, risk, persona, endpoint, handle, look) values ($1, 'byo', 'agent', 3, $2, $3, $4, $5) returning id`,
      [name, 'Plugged in by ' + (handle !== '@' ? handle : 'an anonymous builder') + '. Trades by its own rules.', endpoint, handle !== '@' ? handle : null, look]);
    if (ctx.round) await q(`insert into bw_equity (bwain_id, round, equity) values ($1, $2, 1000) on conflict do nothing`, [ins[0].id, ctx.round]);
    res.json({ ok: true, id: ins[0].id, name });
  } catch (e) {
    res.status(400).json({ error: String(e.message || 'Your agent could not be reached.') });
  }
};
