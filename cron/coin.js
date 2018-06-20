
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
  const url = 'https://api.crypto-bridge.org/api/v1/ticker';

  const info = await rpc.call('getinfo');
  const masternodes = await rpc.call('vnode', ['count']);
  const nethashps = await rpc.call('getnetworkhashps');
  let cb = null;

  // https://api.crypto-bridge.org/api/v1/ticker
  // {"id":"VTL_BTC","last":"0.00001229","volume":"0.11468148","ask":"0.00001220","bid":"0.00000651"}
  const tickers = await fetch(url);
  if (tickers && Array.isArray(tickers)) {
    cb = tickers.find(t => t.id === 'VTL_BTC');
  }

  // https://api.coindesk.com/v1/bpi/currentprice.json
  // Get price from coindesk.
  const price = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
  const rate = price.bpi.USD.rate_float * cb.last;

  const coin = new Coin({
    cap: 0,
    createdAt: date,
    blocks: info.blocks,
    btc: cb.last || 0,
    diff: info.difficulty,
    mnsOff: 0,
    mnsOn: masternodes,
    netHash: nethashps,
    peers: info.connections,
    status: 'Online',
    supply: 0, // TODO: change to actual count from db.
    usd: rate || 0
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
