# WebHID Inspector — Mouse Battery Finder

ワイヤレスマウス（WLmouse Beast Miao など）のバッテリー残量を返すHIDレポートを特定するための調査用ツール。
静的HTML1枚。**WebHIDはHTTPSかlocalhostでしか動かない**ため、Cloudflare Pages にデプロイして使う。Chrome / Edge 専用。

## 構成
```
public/index.html          … ツール本体（デプロイ対象）
wrangler.toml              … Cloudflare Pages 設定（出力ディレクトリ = public）
.github/workflows/deploy.yml … main への push で Pages へ自動デプロイ
```

## 機能
- 接続したHIDデバイスの VID/PID・レポート構成(input/output/feature)を表示
- 全 Feature Report を一括スキャンし、0〜100 の値を「%候補」として強調
- レポートをポーリングし、**前回から変化したバイトをハイライト**（残量バイト特定の決め手）
- 任意コマンドの送信(output/feature)と応答(input)の観測

## デプロイ基盤（GitHub → Cloudflare Pages 自動デプロイ）

### 1. GitHub にリポジトリを作成して push
```bash
gh auth login                       # 未ログインの場合
cd wlmouse-hid-inspector
gh repo create wlmouse-hid-inspector --private --source=. --push
```

### 2. Cloudflare Pages プロジェクトを一度だけ作成
```bash
npx wrangler pages project create wlmouse-hid-inspector --production-branch=main
```

### 3. GitHub にデプロイ用シークレットを登録
Cloudflare で API トークン（Pages 編集権限）と Account ID を用意し、リポジトリに登録：
```bash
gh secret set CLOUDFLARE_API_TOKEN     # プロンプトにトークンを貼る
gh secret set CLOUDFLARE_ACCOUNT_ID    # プロンプトに Account ID を貼る
```
- API トークン: Cloudflare ダッシュボード → My Profile → API Tokens → Create Token →
  テンプレート「Edit Cloudflare Workers」または Pages:Edit 権限のカスタムトークン
- Account ID: ダッシュボード右側、または `npx wrangler whoami`

以降は `main` に push するたびに Actions が走り、`https://wlmouse-hid-inspector.pages.dev` に自動反映される。

> 補足: Actions を使わず、Cloudflare ダッシュボードで GitHub リポジトリを直接連携する方法もある
> （Workers & Pages → Create → Pages → Connect to Git）。その場合トークン登録は不要。

## 手動デプロイ（Actions を使わない場合）
```bash
npx wrangler pages deploy public --project-name=wlmouse-hid-inspector
```

## 使い方
1. 発行された `https://...pages.dev` を **Windows の Chrome/Edge** で開く
2. マウスのドングルを挿した状態で「① デバイスを選ぶ」→ WLmouse の vendor 系インターフェイスを選択
3. 「② 全 Feature Report をスキャン」で %候補 を確認
4. 候補の reportId を「③ ポーリング」に入れ、マウスを充電/放電させて**変化するバイト**を特定
5. featureで取れなければ「④ コマンド送信」で純正ツールが投げているコマンドを再現

特定できたら以下を記録：VID / PID / usagePage / 取得方法(feature or output→input) / reportId / 送信コマンド / 残量バイト位置。
これらが次の Stream Deck プラグイン実装(node-hid)の入力になる。
