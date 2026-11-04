// Postgres (Neon over HTTP). Tables are prefixed bw_ so the database can be shared.
const { neon } = require('@neondatabase/serverless');
function url() {
  const e = process.env;
  return e.DATABASE_URL || e.POSTGRES_URL || e.DATABASE_DATABASE_URL || e.STORAGE_DATABASE_URL ||
    Object.values(e).find((v) => typeof v === 'string' && /^postgres(ql)?:\/\//.test(v));
}
let _sql = null;
function q(text, params = []) {
  if (!_sql) { const u = url(); if (!u) throw new Error('No database connected.'); _sql = neon(u); }
  return _sql(text, params);
}
const ROUND_MS = 10 * 60 * 1000;
const HOUSE = [
  ['smol momentum', 'momentum', 3, "Buys whatever is ripping right now. Sells the second the chart turns red. Never argues with a green candle."],
  ['dip goblin', 'contrarian', 3, "Lives in the red. Buys coins that just got dumped on big volume and sells into the bounce."],
  ['volume worm', 'volume', 3, "Doesn't care about price, only volume. Follows the money wherever it's moving fastest."],
  ['diamond lobe', 'hold', 2, "Picks the strongest coin and holds it. Sells almost never. Thinks everyone else trades too much."],
  ['paper neuron', 'scalp', 2, "Nervous. Takes small wins fast and cuts losers faster. Can't sit through a red candle."],
  ['galaxy bwain', 'whale', 5, "Big brain, big bets. Goes heavy on one coin at a time and dares the others to fade it."],
  ['degen synapse', 'degen', 5, "Chases the smallest, loudest coins on the board. Knows it's gambling. Loves it."],
  ['quiet gyrus', 'safe', 1, "Only touches coins with deep liquidity. Small sizes, slow hands, no drama."],
];
let ready = false;
async function init() {
  if (ready) return;
  await q(`create table if not exists bw_bwains (id serial primary key, name text not null, kind text not null default 'house', style text not null default 'momentum', risk int not null default 3, persona text, parents int[], gen int not null default 0, endpoint text, handle text, look int not null default 0, cash double precision not null default 1000, active boolean not null default true, fails int not null default 0, created timestamptz not null default now())`);
  await q(`create table if not exists bw_pos (bwain_id int not null, mint text not null, symbol text, qty double precision not null default 0, cost double precision not null default 0, primary key (bwain_id, mint))`);
  await q(`create table if not exists bw_trades (id bigserial primary key, round int, ts timestamptz not null default now(), bwain_id int, side text, mint text, symbol text, usd double precision, price double precision, why text, clash boolean not null default false)`);
  await q(`create table if not exists bw_equity (bwain_id int not null, round int not null, equity double precision, primary key (bwain_id, round))`);
  await q(`create table if not exists bw_meta (k text primary key, v text, n bigint)`);
  await q(`create table if not exists bw_rl (k text primary key, n int not null default 0, until bigint not null)`);
  const c = await q(`select count(*)::int as n from bw_bwains`);
  if (!c[0].n) {
    for (let i = 0; i < HOUSE.length; i++) {
      const [name, style, risk, persona] = HOUSE[i];
      await q(`insert into bw_bwains (name, kind, style, risk, persona, look) values ($1, 'house', $2, $3, $4, $5)`, [name, style, risk, persona, 11 + i * 37]);
    }
  }
  ready = true;
}
// fixed-window rate limit: true when allowed
async function limit(key, max, windowMs) {
  const now = Date.now();
  const r = await q(`insert into bw_rl (k, n, until) values ($1, 1, $2) on conflict (k) do update set n = case when bw_rl.until < $3 then 1 else bw_rl.n + 1 end, until = case when bw_rl.until < $3 then $2 else bw_rl.until end returning n`, [key, now + windowMs, now]);
  return r[0].n <= max;
}
function ip(req) { return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'x').split(',')[0].trim(); }
module.exports = { q, init, limit, ip, ROUND_MS };
