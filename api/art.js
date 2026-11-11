// GET /api/art?id=<id>          the studio image for a fixed prompt (made once, then cached)
// GET /api/art?id=<id>&again=1  make it again
// GET /api/art?list=1           which ids exist and which are made
const { neon } = require('@neondatabase/serverless');
const { P } = require('./_prompts');
function dbUrl() {
  const e = process.env;
  return e.DATABASE_URL || e.POSTGRES_URL || e.STORAGE_DATABASE_URL || Object.values(e).find((v) => typeof v === 'string' && /^postgres(ql)?:\/\//.test(v));
}
let sql = null, ready = false;
const q = (t, p = []) => (sql || (sql = neon(dbUrl())))(t, p);
async function init() {
  if (ready) return;
  await q(`create table if not exists ms_art (id text primary key, img bytea not null, model text, w int, h int, at timestamptz not null default now())`);
  await q(`create table if not exists ms_rl (k text primary key, n int not null default 0, until bigint not null)`);
  ready = true;
}
async function allow(max) {
  const now = Date.now();
  const r = await q(`insert into ms_rl (k, n, until) values ('gen', 1, $1) on conflict (k) do update set n = case when ms_rl.until < $2 then 1 else ms_rl.n + 1 end, until = case when ms_rl.until < $2 then $1 else ms_rl.until end returning n`, [now + 3600000, now]);
  return r[0].n <= max;
}
function jpegSize(b) {
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}
async function draw(token, item, ref) {
  const [W, H] = (item.size || '1024x1024').split('x').map(Number);
  const errs = [];
  if (ref) {
    for (const model of ['bfl/flux-2-pro', 'bfl/flux-kontext-pro']) {
      for (const withSize of [true, false]) {
        try {
          const fd = new FormData();
          fd.append('model', model); fd.append('prompt', item.p); fd.append('n', '1'); fd.append('response_format', 'b64_json');
          if (withSize) fd.append('size', W + 'x' + H);
          fd.append('image', new Blob([ref], { type: 'image/jpeg' }), 'ref.jpg');
          const r = await fetch('https://ai-gateway.vercel.sh/v1/images/edits', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: fd, signal: AbortSignal.timeout(50000) });
          const j = await r.json().catch(() => null), d = j && j.data && j.data[0];
          if (d && d.b64_json) return { buf: Buffer.from(d.b64_json, 'base64'), model };
          errs.push(model + (withSize ? '+size' : '') + ': ' + String((j && j.error && (j.error.message || j.error.type)) || r.status).slice(0, 160));
        } catch (e) { errs.push(model + ': ' + String(e && e.message).slice(0, 120)); }
      }
    }
    throw new Error(errs.join(' | '));
  }
  for (const withSize of [true, false]) {
    try {
      const body = { model: 'bfl/flux-2-pro', prompt: item.p, n: 1, response_format: 'b64_json', providerOptions: { blackForestLabs: { outputFormat: 'jpeg', safetyTolerance: 2 } } };
      if (withSize) { body.size = W + 'x' + H; body.providerOptions.blackForestLabs.width = W; body.providerOptions.blackForestLabs.height = H; }
      const r = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(50000) });
      const j = await r.json().catch(() => null), d = j && j.data && j.data[0];
      if (d && d.b64_json) return { buf: Buffer.from(d.b64_json, 'base64'), model: 'bfl/flux-2-pro' };
      errs.push((withSize ? '+size' : 'plain') + ': ' + String((j && j.error && (j.error.message || j.error.type)) || r.status).slice(0, 160));
    } catch (e) { errs.push(String(e && e.message).slice(0, 120)); }
  }
  throw new Error(errs.join(' | '));
}
module.exports = async (req, res) => {
  const qs = req.query || {};
  try {
    await init();
    if (qs.list) {
      const made = await q(`select id, w, h, model, at from ms_art order by id`);
      return res.json({ ids: Object.keys(P), made });
    }
    const id = String(qs.id || ''), item = P[id];
    if (!item) return res.status(404).json({ error: 'unknown id' });
    let row = qs.again === '1' ? null : (await q(`select img from ms_art where id = $1`, [id]))[0];
    if (!row) {
      if (!(await allow(60))) return res.status(429).json({ error: 'studio is resting, try in an hour' });
      const token = req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY;
      if (!token) return res.status(500).json({ error: 'no gateway token' });
      let ref = null;
      if (item.ref) {
        const f = (await q(`select img from ms_art where id = $1`, [item.ref]))[0];
        if (!f) return res.status(409).json({ error: 'make ' + item.ref + ' first' });
        ref = Buffer.from(f.img);
      }
      const out = await draw(token, item, ref), [w, h] = jpegSize(out.buf);
      await q(`insert into ms_art (id, img, model, w, h) values ($1, $2, $3, $4, $5) on conflict (id) do update set img = excluded.img, model = excluded.model, w = excluded.w, h = excluded.h, at = now()`, [id, out.buf, out.model, w, h]);
      row = { img: out.buf };
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(Buffer.from(row.img));
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message).slice(0, 600) });
  }
};
