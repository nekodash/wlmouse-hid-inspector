// WLMOUSE MIAO 8K のバッテリー残量を node-hid で取得。
// プロトコル: feature reportId 0 / 要求 00 00 02 02 00 83 00 / 応答 a1 .. 83 <flag> <pct>
// (a0=pending なので a1 が来るまで待つ / 複数インターフェイスのうち feature が通る方を使う)
const HID = require('node-hid');

const VID = 0x36a7;
const PID = 0xa866;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function reqBuffer() {
  const buf = new Array(65).fill(0);                       // [0]=reportId(0)
  [0x00, 0x00, 0x02, 0x02, 0x00, 0x83, 0x00].forEach((b, i) => { buf[1 + i] = b; });
  return buf;
}
function parse(resp) {
  let a = resp;
  if (a[0] !== 0xa1 && a[1] === 0xa1) a = a.slice(1);       // 先頭にreportIdが付く実装向け正規化
  if (a[0] === 0xa1 && a[5] === 0x83) return { pct: a[7], charging: a[6] !== 0 };
  return null;
}
async function readFrom(dev) {
  for (let i = 0; i < 12; i++) {
    dev.sendFeatureReport(reqBuffer());
    await sleep(40);
    const b = parse(dev.getFeatureReport(0, 65));
    if (b) return b;
    await sleep(40);
  }
  return null;
}

async function getBattery() {
  const paths = HID.devices()
    .filter(d => d.vendorId === VID && d.productId === PID)
    .map(d => d.path);
  if (!paths.length) return null;                          // ドングル未接続
  for (const path of paths) {
    let dev;
    try { dev = new HID.HID(path); } catch { continue; }
    try {
      const b = await readFrom(dev);
      if (b) return b;
    } catch { /* feature非対応のインターフェイス */ }
    finally { try { dev.close(); } catch {} }
  }
  return null;                                             // マウスがスリープ/OFFなど
}

module.exports = { getBattery };
