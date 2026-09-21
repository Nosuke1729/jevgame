# JEV // 読み合いの闘技場

Jev を敵ファイターの戦術判断に使う、ブラウザーで遊べる 2D・1対1対戦アクションゲームです。先に2ラウンド勝つと最終勝者になります。通常攻撃で牽制し、強攻撃を狙い、ガード・回避で相手の攻めを崩します。

## 技術構成

- Next.js 16 / React 19 / TypeScript
- HTML Canvas 2D による軽量描画（追加の描画ライブラリは不要）
- Next.js のサーバー側 API route (`/api/decision`)
- GitHub Pages 用の Cloudflare Worker API (`/decision`)
- TypeSafe の Jev System One API

ゲームループは固定 60 Hz の更新と `requestAnimationFrame` 描画です。Jev は約300〜680 ms 間隔（難易度で変化）で戦術意図とプレイヤー行動予測をまとめて判断します。キャラクターの操作・物理・当たり判定はローカルのゲームロジックが実行します。通信は非同期で、応答待ちでもゲームは止まりません。古い応答は破棄します。

## セットアップ

Node.js 22 以降を用意してください。

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザーで `http://localhost:3000` を開きます。Jev を使うには `.env.local` の `JEV_API_KEY` に TypeSafe の API キーを設定してから開発サーバーを再起動します。API キーはサーバー側だけで使用します。キーは [TypeSafe の公式ダッシュボード](https://console.typesafe.ai/)で取得します。

サーバー側の接続先は [公式 Quick start](https://docs.typesafe.ai/introduction/quickstart) に記載された `POST https://api.typesafe.ai/v1/systemone` です。`Authorization: Bearer <API_KEY>` と `Content-Type: application/json` を使用し、リクエストのモデルは `jev-latest` です。接続先はコードで固定されているため、追加のベース URL 環境変数は不要です。

キーがない場合や通信失敗・タイムアウト・レート制限・無効な応答の場合は、ルールベースの標準AIに自動で切り替わり、そのまま対戦できます。画面下に現在の接続状態を表示します。キーなしでもタイトルから最終勝者まで遊べます。

## 操作方法

| キー | 操作 |
| --- | --- |
| A / D | 左右移動 |
| W | ジャンプ |
| J | 通常攻撃 |
| K | 強攻撃 |
| L | 回避 |
| I | ガード（押している間） |
| F3 | デバッグ表示の切り替え |

キー定義は `src/game/constants.ts` にあります。強攻撃・回避・ガードはスタミナを消費します。ガードでスタミナが尽きるとガード崩しになります。

## 難易度とプレイヤー行動

「やさしい」「ふつう」「むずかしい」で判断間隔・反応遅延・行動統計の利用度が変わります。AI は直近30行動を記録し、全体と「AI接近時」「強攻撃を外した後」「低HP時」の傾向を戦術判断に渡します。右側には次の行動の予測を確率で表示します。行動統計は試合中のラウンドをまたいで保持し、新しい試合ではリセットします。

## 開発・確認

```bash
npm run typecheck
npm test
npm run build
```

Jev の実通信には有効な API キーとネットワーク接続が必要です。`.env.local` を設定した後は `npm run check:jev` でサーバー側の判断経路から公式 API へ1回送信し、応答を検証できます。起動中のアプリを HTTP 経由で確認する場合は `JEV_CHECK_URL=http://localhost:3000 npm run check:jev` を使います。キーの値は出力されません。API 呼び出しには利用量が発生します。キーなしの環境では標準AIの動作と API フォールバックを確認できます。

## GitHub Pages 版

`npm run build:pages` で `out/` に静的サイトを生成します。`main` への push で `.github/workflows/deploy-pages.yml` がテスト・ビルド・公開を行います。GitHub のリポジトリ設定で Pages の公開元を「GitHub Actions」にしてください。公開先は [https://nosuke1729.github.io/jevgame/](https://nosuke1729.github.io/jevgame/) です。PC ブラウザーでキーボード操作できます。

GitHub Pages はサーバー側 API を実行できないため、公開版は Cloudflare Worker を介して Jev に接続します。Worker が利用できない場合は、プレイヤー行動の記録と予測を使う標準AIに切り替わります。ローカルの Next.js 版でも Jev を使用できます。

## 公開 Jev API サーバー

`src/server/worker.ts` は GitHub Pages 版のための Cloudflare Worker です。TypeSafe の API キーは Worker の Secret にだけ保管し、ブラウザー・Pages・GitHub Actions には渡しません。Worker は `https://nosuke1729.github.io` からの `/decision` POST だけを受け付け、入力サイズと構造を検証します。Cloudflare のレート制限は IP ごとに 240 回/分、Durable Object による全体上限は UTC 日付ごとに 500 回です。Origin/CORS は認証ではなく、偽装可能です。この上限に達した場合、ゲームは標準AIへ切り替わります。Jev API の利用量・課金も別途確認してください。

既存の Cloudflare アカウントで Worker を公開する場合は、Node.js 22 以降で以下を実行します。`JEV_API_KEY` の値をコマンド行や GitHub に記載しないでください。

```bash
npm ci
npm run typecheck:worker
npx wrangler login
npx wrangler deploy --secrets-file .env.local
```

最後のコマンドは Git 追跡対象外の `.env.local` にある `JEV_API_KEY` を暗号化された Cloudflare Secret として登録し、Worker と同時に公開します。現在の公開 API は [https://jevgame-api.nosuke-0460.workers.dev/decision](https://jevgame-api.nosuke-0460.workers.dev/decision) です。GitHub リポジトリの Actions 変数 `JEV_DECISION_URL` にこの URL を設定すると、次の Pages ビルドから Jev が有効になります。ローカルで公開版を生成する場合は `JEV_DECISION_URL=https://jevgame-api.nosuke-0460.workers.dev/decision npm run build:pages` を使います。URL は公開情報ですが、`JEV_API_KEY` は引き続き `.env.local` と Cloudflare Secret のみに置きます。

参考: [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)、[Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/)。
