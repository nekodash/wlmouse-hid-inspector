# WLMOUSE MIAO 8K RECEIVER — HID プロトコル解析メモ

- Device: `WLMOUSE MIAO 8K RECEIVER`
- **VID = 0x36a7 / PID = 0xa866**
- 通信は **Feature Report, reportId = 0**（レポートID無し）での要求/応答。
  - レポート記述子上は feature/output が空だが、`sendFeatureReport(0, ...)` /
    `receiveFeatureReport(0)` で通る（＝ node-hid でも `getFeatureReport`/`sendFeatureReport` で再現可能）。

## フレーム形式

要求 (TX, Host→Device):
```
00 00 <cat> <len> <bank> <cmd> <args...>   (以降 0 埋め, 全長 64)
```
応答 (RX, Device→Host):
```
a1 00 <cat> <len> <bank> <cmd> <data...>   (先頭 a1=応答, a2/a3 も観測)
```
- `<cat>`: カテゴリ (01 / 02)
- `<len>`: データ長（要求は最大長、応答は実データ長）
- `<bank>`: サブ番号/バンク (00〜04)
- `<cmd>`: 項目コード
- 多バイト値は **big-endian**（DPI 応答で確認: `01 90` = 400）

## 観測済みコマンド（初期一括リード）

| cmd | bank | 応答データ(先頭) | 推定 |
|-----|------|------------------|------|
| 0x81 | 00 | `01 00 02 0a a8 67` | バージョン/シリアル系 |
| 0x86 | 00 | `03` | 設定値(enum) |
| 0x85 | 00 | `01` | 設定値(enum) |
| 0x8e | 00 | `12 "Profile 1"(UTF16)` | プロファイル名 |
| **0x83** | 00 | `00 48` | **バッテリー残量候補 (0x48=72%)** ★ |
| 0x82 | 00 | `ff ff` | ? |
| 0x82 | 01(cat01) | `01 00 4c` | 残量候補 (0x4c=76) |
| 0x87 | 00 | `01 01 2c` | 設定 |
| 0x81 | 01(cat02) | DPI段: 400,400,800,800,1600,1600,3200,3200,6400,6400,30000 | DPIプリセット |
| 0x80 | 02(cat01) | `01 00 00 00 06 00 8f ff` | LOD/その他 |

## バッテリー読み取り（✅確定）

ドライバ表示 `BAT:72%` と応答 `... 83 00 48`（0x48=72）が一致し確定。

- **コマンド: 0x83**
- **要求** (feature, reportId 0, 64バイト): `00 00 02 02 00 83 00` + 0埋め
- **応答**: `a1 00 02 02 00 83 <flag> <pct>`
  - 残量%: **data[7]**（0x00〜0x64）
  - 充電フラグ(推定): **data[6]**（未充電時 00。充電時の値は未検証）
- 手順: `sendFeatureReport(0, req)` → `receiveFeatureReport(0)` で応答取得

### node-hid での再現（Part 3 用メモ）
- feature reportId 0 → node-hid では配列先頭に 0x00 を付けて
  `device.sendFeatureReport([0x00, 0x00,0x00,0x02,0x02,0x00,0x83,0x00, ...])`、
  `device.getFeatureReport(0, 65)` で読む。
- 複数インターフェイスがあるので、feature が通る path を選ぶ必要あり（要検証）。
