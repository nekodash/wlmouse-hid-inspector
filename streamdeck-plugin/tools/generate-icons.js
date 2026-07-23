// Stream Deck プラグイン用のバッテリーアイコン PNG を生成する。
// 依存なし（Node 標準の zlib のみ）。`node generate-icons.js` で imgs/ に出力。
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'com.nekodash.wlmouse-battery.sdPlugin', 'imgs');

function crc32(buf){
  let c, crc = 0xffffffff;
  for(let n = 0; n < buf.length; n++){
    c = (crc ^ buf[n]) & 0xff;
    for(let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba){
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const raw = Buffer.alloc(h*(1+w*4));
  for(let y=0;y<h;y++){ raw[y*(1+w*4)]=0; rgba.copy(raw, y*(1+w*4)+1, y*w*4, (y+1)*w*4); }
  const idat = zlib.deflateSync(raw, {level:9});
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

function fillRect(buf, W, x, y, w, h, [r,g,b,a]){
  for(let yy=Math.max(0,y|0); yy<Math.min(buf.length/(4*W), (y+h)|0); yy++){
    for(let xx=Math.max(0,x|0); xx<Math.min(W, (x+w)|0); xx++){
      const i = (yy*W+xx)*4;
      buf[i]=r; buf[i+1]=g; buf[i+2]=b; buf[i+3]=a;
    }
  }
}

const BORDER = [201,209,217,255];   // #c9d1d9
const GREEN  = [63,185,80,255];     // #3fb950

function battery(W, H){
  const buf = Buffer.alloc(W*H*4, 0);          // 透明背景
  const bx = Math.round(W*0.13), by = Math.round(H*0.33);
  const bw = Math.round(W*0.64), bh = Math.round(H*0.34);
  const t = Math.max(1, Math.round(W*0.035));  // 枠の太さ
  fillRect(buf, W, bx, by, bw, bh, BORDER);                        // 枠
  fillRect(buf, W, bx+t, by+t, bw-2*t, bh-2*t, [0,0,0,0]);         // 内側くり抜き
  fillRect(buf, W, bx+t, by+t, Math.round((bw-2*t)*0.7), bh-2*t, GREEN); // 残量(70%)
  fillRect(buf, W, bx+bw, by+Math.round(bh*0.3), Math.max(1,Math.round(W*0.05)), Math.round(bh*0.4), BORDER); // 端子
  return encodePng(W, H, buf);
}

fs.mkdirSync(OUT, {recursive:true});
const files = [
  ['action.png',20],['action@2x.png',40],
  ['category.png',28],['category@2x.png',56],
  ['key.png',72],['key@2x.png',144],
];
for(const [name,size] of files){
  fs.writeFileSync(path.join(OUT,name), battery(size,size));
  console.log('wrote', name, size+'x'+size);
}
