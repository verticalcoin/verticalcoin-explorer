
require('babel-polyfill');
const config = require('../config');
const { exit, rpc } = require('../lib/cron');
const fetch = require('../lib/fetch');
const locker = require('../lib/locker');
const moment = require('moment');
// Models.
const Coin = require('../model/coin');

/**
 * Get the coin related information including things
 * like price coinmarketcap.com data.
 */
async function syncCoin() {
  const date = moment().utc().startOf('minute').toDate();
  // Setup the coinmarketcap.com api url.
  const url = `${ config.coinMarketCap.api }${ config.coinMarketCap.ticker }`;

  const info = await rpc.call('getinfo');
  const masternodes = await rpc.call('vnode', ['count']);
  const nethashps = await rpc.call('getnetworkhashps');

  let market = {}; // await fetch(url);
  if (Array.isArray(market)) {
    market = market.length ? market[0] : {};
  }

  const coin = new Coin({
    cap: market.market_cap_usd || 0,
    createdAt: date,
    blocks: info.blocks,
    btc: market.price_btc || 0,
    diff: info.difficulty,
    mnsOff: 0,
    mnsOn: masternodes,
    netHash: nethashps,
    peers: info.connections,
    status: 'Online',
    supply: market.available_supply || 0, // TODO: change to actual count from db.
    usd: market.price_usd || 0
  });

  await coin.save();
}

/**
 * Handle locking.
 */
async function update() {
  const type = 'coin';
  let code = 0;

  try {
    locker.lock(type);
    await syncCoin();
  } catch(err) {
    console.log(err);
    code = 1;
  } finally {
    locker.unlock(type);
    exit(code);
  }
}

update();
