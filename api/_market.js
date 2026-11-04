// The live pump.fun market the bwains trade: GeckoTerminal pools (PumpSwap + bonding curve + trending), Dexscreener for prices.
async function gt(path) {
  const r = await fetch('https://api.geckoterminal.com/api/v2' + path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('gt ' + r.status);
  return r.json();
}
const rel = (p, k) => (p.relationships && p.relationships[k] && p.relationships[k].data && p.relationships[k].data.id) || '';
function mapPool(p) {
  const a = p.attributes || {}, pc = a.price_change_percentage || {}, vol = a.volume_usd || {};
  return {
    mint: rel(p, 'base_token').replace(/^solana_/, ''), symbol: String(a.name || '').split(' / ')[0].trim().slice(0, 16),
    price: +a.base_token_price_usd || 0, chg5m: +pc.m5 || 0, chg1h: +pc.h1 || 0, chg24h: +pc.h24 || 0,
    vol1h: +vol.h1 || 0, vol24h: +vol.h24 || 0, liq: +a.reserve_in_usd || 0, mcap: +(a.market_cap_usd || a.fdv_usd) || 0, dex: rel(p, 'dex'),
  };
}
const SKIP = /^(SOL|WSOL|USDC|USDT|USD1|JUP|JITOSOL|MSOL)$/i;
async function universe() {
  const paths = ['/networks/solana/dexes/pumpswap/pools?sort=h24_volume_usd_desc', '/networks/solana/dexes/pump-fun/pools?sort=h24_volume_usd_desc', '/networks/solana/trending_pools?duration=1h'];
  const res = await Promise.allSettled(paths.map(gt));
  const by = new Map();
  res.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    for (const p of r.value.data || []) {
      const m = mapPool(p);
      if (!m.mint || !(m.price > 0) || SKIP.test(m.symbol)) continue;
      if (!/pump/i.test(m.dex) && !/pump$/.test(m.mint)) continue;
      const o = by.get(m.mint); if (!o || m.liq > o.liq) by.set(m.mint, m);
    }
  });
  let list = [...by.values()].filter((m) => m.liq >= 8000 && m.vol24h >= 20000);
  if (list.length < 6) {
    try {
      const j = await fetch('https://api.dexscreener.com/latest/dex/search?q=pumpswap').then((r) => r.json());
      for (const p of j.pairs || []) {
        if (p.chainId !== 'solana' || !/pump/i.test(p.dexId || '')) continue;
        const m = { mint: p.baseToken.address, symbol: String(p.baseToken.symbol || '').slice(0, 16), price: +p.priceUsd || 0, chg5m: +(p.priceChange && p.priceChange.m5) || 0, chg1h: +(p.priceChange && p.priceChange.h1) || 0, chg24h: +(p.priceChange && p.priceChange.h24) || 0, vol1h: +(p.volume && p.volume.h1) || 0, vol24h: +(p.volume && p.volume.h24) || 0, liq: +(p.liquidity && p.liquidity.usd) || 0, mcap: +(p.marketCap || p.fdv) || 0, dex: p.dexId };
        if (m.price > 0 && !by.has(m.mint) && !SKIP.test(m.symbol)) { by.set(m.mint, m); list.push(m); }
      }
    } catch (e) {}
  }
  list.sort((a, b) => b.vol24h - a.vol24h);
  return list.slice(0, 24).map((m, i) => ({ i, ...m }));
}
async function prices(mints) {
  const out = {};
  for (let k = 0; k < mints.length; k += 30) {
    const chunk = mints.slice(k, k + 30);
    try {
      const arr = await fetch('https://api.dexscreener.com/tokens/v1/solana/' + chunk.join(',')).then((r) => r.json());
      const best = {};
      for (const p of Array.isArray(arr) ? arr : []) {
        const m = p.baseToken && p.baseToken.address; const liq = (p.liquidity && p.liquidity.usd) || 0;
        if (m && +p.priceUsd > 0 && (!best[m] || liq > best[m].liq)) best[m] = { liq, px: +p.priceUsd };
      }
      Object.entries(best).forEach(([m, v]) => (out[m] = v.px));
    } catch (e) {}
  }
  return out;
}
module.exports = { universe, prices };
