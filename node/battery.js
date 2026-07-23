#!/usr/bin/env node
// WLMOUSE MIAO 8K RECEIVER のバッテリー残量を node-hid で取得する。
// プロトコル詳細は ../docs/protocol.md 参照。
//   要求(feature, reportId 0): 00 00 02 02 00 83 00 (以降0埋め)
//   応答: a1 00 02 02 00 83 <flag> <pct>   ← pct=残量%(byte7), a0はpending
const HID = require('node-hid');

const VID = 0x36a7;
const PID = 0xa866;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// node-hid の feature buffer は先頭が reportId。reportId=0 を付けて 65バイト。
function reqBuffer() {
  const buf = new Array(65).fill(0);      // [0]=reportId(0)
  const payload = [0x00, 0x00, 0x02, 0x02, 0x00, 0x83, 0x00];
  payload.forEach((b, i) => { buf[1 + i] = b; });
  return buf;
}

// 返り値の先頭に reportId(0) が付く実装もあるので正規化して a1 応答を探す。
function parse(resp) {
  let a = resp;
  if (a[0] !== 0xa1 && a[1] === 0xa1) a = a.slice(1);
  if (a[0] === 0xa1 && a[5] === 0x83) {
    return { pct: a[7], flag: a[6], raw: a.slice(0, 8) };
  }
  return null;
}

async function readFrom(dev) {
  for (let i = 0; i < 12; i++) {
    dev.sendFeatureReport(reqBuffer());
    await sleep(40);
    const resp = dev.getFeatureReport(0, 65);
    const b = parse(resp);
    if (b) return b;
    await sleep(40);
  }
  return null;
}

async function getBattery() {
  const paths = HID.devices()
    .filter(d => d.vendorId === VID && d.productId === PID)
    .map(d => d.path);
  if (!paths.length) throw new Error('レシーバーが見つかりません（ドングルは挿さっていますか）');

  for (const path of paths) {
    let dev;
    try { dev = new HID.HID(path); } catch { continue; }
    try {
      const b = await readFrom(dev);
      if (b) { b.path = path; return b; }
    } catch { /* feature非対応のインターフェイス */ }
    finally { try { dev.close(); } catch {} }
  }
  return null;
}

async function main() {
  const watch = process.argv.includes('--watch');
  do {
    try {
      const b = await getBattery();
      if (b) {
        const charging = b.flag ? ' (charging?)' : '';
        console.log(`${new Date().toLocaleTimeString()}  Battery: ${b.pct}%${charging}  [raw ${b.raw.map(x => x.toString(16).padStart(2, '0')).join(' ')}]`);
      } else {
        console.log('残量を取得できませんでした（マウスがスリープ/OFFかもしれません）');
      }
    } catch (e) {
      console.error('エラー:', e.message);
    }
    if (watch) await sleep(30000);
  } while (watch);
}

module.exports = { getBattery };

if (require.main === module) main();
