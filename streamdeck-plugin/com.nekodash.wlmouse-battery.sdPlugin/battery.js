// WLMOUSE MIAO 8K のバッテリー残量を node-hid で取得。
// プロトコル: feature reportId 0 / 要求 00 00 02 02 00 83 00 / 応答 a1 .. 83 <flag> <pct>
// (a0=pending なので a1 が来るまで待つ / 複数インターフェイスのうち feature が通る方を使う)
const HID = require('node-hid');

const VID = 0x36a7;
const PID = 0xa866;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 要求フレームは不変なので使い回す（[0]=reportId 0, 続けて 00 00 02 02 00 83 00）
const REQ = Buffer.alloc(65);
REQ[3] = 0x02; REQ[4] = 0x02; REQ[6] = 0x83;

function parse(resp) {
  let a = resp;
  if (a[0] !== 0xa1 && a[1] === 0xa1) a = a.slice(1);       // 先頭にreportIdが付く実装向け正規化
  if (a[0] === 0xa1 && a[5] === 0x83) return { pct: a[7], charging: a[6] !== 0 };
  return null;
}

// 1インターフェイスに対し、a1 応答が来るまで送受信を繰り返す
async function readFrom(dev) {
  for (let i = 0; i < 12; i++) {
    dev.sendFeatureReport(REQ);
    await sleep(40);
    const b = parse(dev.getFeatureReport(0, 65));
    if (b) return b;
    await sleep(40);
  }
  return null;
}

// path を開いて読む。ok=feature書き込みが通ったIFか / b=結果(スリープ時は null)
async function readPath(path) {
  let dev;
  try { dev = new HID.HID(path); } catch { return { ok: false }; }
  try { return { ok: true, b: await readFrom(dev) }; }
  catch { return { ok: false }; }                          // feature非対応のインターフェイス
  finally { try { dev.close(); } catch {} }
}

let cachedPath = null;   // 直近に成功したインターフェイスの path

async function getBattery() {
  // 1) 既知の動作IFを最優先（列挙も他IFのオープンも省ける）
  if (cachedPath) {
    const r = await readPath(cachedPath);
    if (r.ok) return r.b;      // 正しいIF。スリープで b=null でもキャッシュは維持
    cachedPath = null;         // IF が無効化された時だけ再探索へ
  }
  // 2) 全インターフェイスを走査し feature が通るものを探す
  const paths = HID.devices()
    .filter(d => d.vendorId === VID && d.productId === PID)
    .map(d => d.path);
  for (const path of paths) {
    const r = await readPath(path);
    if (r.ok) { cachedPath = path; return r.b; }
  }
  return null;                 // ドングル未接続など
}

module.exports = { getBattery };
