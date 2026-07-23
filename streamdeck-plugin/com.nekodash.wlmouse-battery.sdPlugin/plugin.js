// WLmouse Battery — Stream Deck プラグイン本体 (SDK v2 / Node.js)
// Stream Deck アプリから argv で接続情報を受け取り WebSocket で通信する。
// Elgato ライブラリには依存せず ws のみ使用（登録プロトコルは classic と同一）。
const WebSocket = require('ws');
const { getBattery } = require('./battery.js');

// --- argv 解析: -port <n> -pluginUUID <id> -registerEvent <ev> -info <json> ---
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^-/, '')] = process.argv[i + 1];
}
const { port, pluginUUID, registerEvent } = args;

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
const contexts = new Set();     // 表示中のキー
let busy = false;
let last = null;                // 直近の取得結果（取得失敗時のフォールバック用）

function send(obj) { try { ws.send(JSON.stringify(obj)); } catch (e) { console.error(e); } }
function setImage(context, image) { send({ event: 'setImage', context, payload: { image, target: 0 } }); }

// --- キー画像(SVG)生成 ---
function keyImage(pct, charging) {
  const known = typeof pct === 'number';
  const col = !known ? '#8b949e' : pct <= 20 ? '#f85149' : pct <= 50 ? '#d29922' : '#3fb950';
  const innerW = 66, fillW = known ? Math.max(2, Math.round(innerW * Math.min(100, pct) / 100)) : 0;
  const label = known ? `${pct}%` : '‥';
  const bolt = charging
    ? `<text x="112" y="52" font-size="26" text-anchor="middle">⚡</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="16" fill="#0d1117"/>
    <rect x="30" y="34" width="76" height="34" rx="6" fill="none" stroke="#c9d1d9" stroke-width="5"/>
    <rect x="109" y="43" width="7" height="16" rx="2" fill="#c9d1d9"/>
    <rect x="35" y="39" width="${fillW}" height="24" rx="3" fill="${col}"/>
    ${bolt}
    <text x="72" y="118" font-family="Helvetica,Arial,sans-serif" font-size="40" font-weight="700"
          text-anchor="middle" fill="${col}">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function refreshAll() {
  if (busy || contexts.size === 0) return;
  busy = true;
  try {
    const b = await getBattery();
    if (b) last = b;                      // 成功時のみ更新
    const use = b || last;                // 失敗時は直近値を維持
    const img = keyImage(use ? use.pct : null, use ? use.charging : false);
    for (const c of contexts) setImage(c, img);
  } catch (e) {
    console.error('refresh error', e);
  } finally {
    busy = false;
  }
}

ws.on('open', () => {
  send({ event: registerEvent, uuid: pluginUUID });
  setInterval(refreshAll, 60000);         // 60秒ごとに更新
});

ws.on('message', (data) => {
  let msg; try { msg = JSON.parse(data); } catch { return; }
  switch (msg.event) {
    case 'willAppear':
      contexts.add(msg.context);
      refreshAll();
      break;
    case 'willDisappear':
      contexts.delete(msg.context);
      break;
    case 'keyDown':                       // 押したら即更新
    case 'systemDidWakeUp':
    case 'deviceDidConnect':
      refreshAll();
      break;
  }
});

ws.on('error', (e) => console.error('ws error', e));
