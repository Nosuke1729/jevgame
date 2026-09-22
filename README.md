# JEV // 読み合いの闘技場

Jev を敵ファイターの戦術判断に使う、ブラウザーで遊べる 1対1対戦アクションゲームです。開始画面で従来の「2D 横視点」と、奥行きも使って戦う「3D 立体対戦」を選べます。先に2ラウンド勝つと最終勝者になります。通常攻撃で牽制し、強攻撃を狙い、ガード・回避で相手の攻めを崩します。

## 技術構成

- Next.js 16 / React 19 / TypeScript
- HTML Canvas 2D による横視点の描画
- Three.js / WebGL による立体描画（3D選択時のみ遅延読み込み）
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

| 操作 | 2D | 3D |
| --- | --- | --- |
| 移動 | A / D（左右） | WASD（前後左右） |
| ジャンプ | W | Space |
| 通常攻撃 | J | J |
| 強攻撃 | K | K |
| 回避 | L | L |
| ガード（押している間） | I | I |
| 一時停止・再開 | Esc | Esc |
| デバッグ表示 | F3 | F3 |

3Dでは W で奥、S で手前に動き、相手の方向を自動で向きます。攻撃中は向きが固定され、奥行き・射程・前方の角度で命中判定します。斜め移動の速度は縦横と同じです。方向入力と L でその方向へ回避し、無入力なら後退回避します。AIも奥行きを追って移動し、Jevには平面上の実距離を渡して既存の戦術判断を使います。

モードを変える場合は、一時停止から「タイトルへ戻る」を選んでください。次の試合は体力・位置・ラウンドがリセットされます。選択モードはこのブラウザーに保存されます。3Dに必要なWebGLを利用できない場合は、画面の「2Dに切り替える」で従来モードを遊べます。

キー定義は `src/game/constants.ts` にあります。強攻撃・回避・ガードはスタミナを消費します。ガードでスタミナが尽きるとガード崩しになります。

スマートフォン・タブレットでは画面下のタッチボタンでも遊べます。移動・ガードは押している間、攻撃・回避・ジャンプは押したときに入力します。複数のボタンを同時に使えます。画面やタブを離れると対戦を自動で一時停止します。「操作方法」を開いている間も停止し、閉じると元の状態に戻ります。全画面表示、演出の動きを抑える設定、難易度の保存に対応しています。

## 画面と素材

対戦エリアを中心に、体力・スタミナ・ラウンド数と相手の予測を配置しています。2Dの夕暮れの道場とファイターは Canvas、3Dの林に囲まれた道場とファイターは手続き的なメッシュで描画します。外部画像や外部フォントは使いません。体力・予測バーは滑らかに更新し、OS の「視差効果を減らす」設定にも対応します。モード切り替え時には3DのGPUリソースを解放します。

操作アイコンには GitHub の [Lucide](https://github.com/lucide-icons/lucide) を公式 `lucide-react` パッケージ経由で使用しています。ISC / MIT の著作権表示は `public/third-party-notices.txt` に同梱し、公開画面の「素材クレジット」から確認できます。

3D描画には [Three.js](https://github.com/mrdoob/three.js) を使用しています。MIT ライセンスの著作権表示も同じファイルに同梱しています。

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

`npm run build:pages` で `out/` に静的サイトを生成します。`main` への push で `.github/workflows/deploy-pages.yml` がテスト・ビルド・公開を行います。GitHub のリポジトリ設定で Pages の公開元を「GitHub Actions」にしてください。公開先は [https://nosuke1729.github.io/jevgame/](https://nosuke1729.github.io/jevgame/) です。キーボードとタッチ操作に対応しています。

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
