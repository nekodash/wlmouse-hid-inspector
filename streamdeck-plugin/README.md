# WLmouse Battery — Stream Deck プラグイン

WLMOUSE MIAO 8K の残量を Stream Deck のキーに表示する公式SDK(v2)プラグイン。
残量取得は node-hid（プロトコルは [../docs/protocol.md](../docs/protocol.md) 参照）。

```
com.nekodash.wlmouse-battery.sdPlugin/
├── manifest.json     プラグイン定義 (SDK v2, Node.js 20)
├── plugin.js         本体（ws でStream Deckと通信、キー画像を描画）
├── battery.js        node-hid で残量取得（getBattery）
├── package.json      依存: node-hid, ws
└── imgs/             アイコン (tools/generate-icons.js で生成)
```

## 前提
- Stream Deck アプリ **6.5 以上**（SDK v2 の Node.js プラグイン対応版）
- **Windows**（x64 / arm64 / ia32 の prebuilt を同梱済み）

## かんたん導入：`.streamDeckPlugin`（推奨）

配布用パッケージ [`dist/com.nekodash.wlmouse-battery.streamDeckPlugin`](dist/com.nekodash.wlmouse-battery.streamDeckPlugin) を
**ダブルクリック**すると Stream Deck が自動でインストールします（フォルダのコピー不要）。
配布時は GitHub Releases にこのファイルを添付するのが手軽です。

パッケージの作り直しは（Node がある環境で）:
```bash
cd streamdeck-plugin
npx @elgato/cli pack com.nekodash.wlmouse-battery.sdPlugin --output dist --force
```

---

## 手動導入（開発時）— **npm install 不要**

依存（`node-hid` / `ws` / `pkg-prebuilds`）と Windows 用ネイティブバイナリは
`node_modules/` に**同梱済み**なので、そのまま置くだけで動きます。

1. `.sdPlugin` フォルダごと Stream Deck のプラグインフォルダへコピー
   ```
   %APPDATA%\Elgato\StreamDeck\Plugins\
   ```
   → `...\Plugins\com.nekodash.wlmouse-battery.sdPlugin\` になるように置く
2. Stream Deck アプリを再起動（タスクトレイから終了 → 再度起動）
3. アクション一覧の **WLmouse → Battery Level** を任意のキーにドラッグ

> コピーの代わりにシンボリックリンクでもOK（要 `@elgato/cli`）:
> `streamdeck link com.nekodash.wlmouse-battery.sdPlugin` → `streamdeck restart com.nekodash.wlmouse-battery`

> 依存を作り直したい場合のみ（同梱物を消したときなど）: `.sdPlugin` 内で `npm install`。

## 動作
- 60秒ごとに残量を取得し、キーに `72%` とバッテリーアイコンを描画（20%以下=赤 / 50%以下=黄 / それ以上=緑）
- 充電中は ⚡ を表示（flag バイト）
- **キーを押すと即時更新**
- マウスがスリープ/OFF等で取得失敗した場合は直近値を保持、初回未取得なら `‥`

## アイコンの再生成
```bash
cd streamdeck-plugin/tools && node generate-icons.js
```

## トラブルシュート
- プラグインが出てこない: Stream Deck 6.5+ か確認 / フォルダ名が `com.nekodash.wlmouse-battery.sdPlugin` 完全一致か / アプリ再起動
- `Cannot find module 'node-hid'`: `.sdPlugin` 内で `npm install` したか（node_modules が同梱されているか）
- 残量が出ない: ドングルが挿さっているか、純正Web設定ツール等が同時にデバイスを占有していないか
- ログ: `%APPDATA%\Elgato\StreamDeck\logs\` を参照
