# JEV // 読み合いの闘技場

Jev を敵ファイターの戦術判断に使う、ブラウザーで遊べる 2D・1対1対戦アクションゲームです。先に2ラウンド勝つと最終勝者になります。通常攻撃で牽制し、強攻撃を狙い、ガード・回避で相手の攻めを崩します。

## 技術構成

- Next.js 16 / React 19 / TypeScript
- HTML Canvas 2D による軽量描画（追加の描画ライブラリは不要）
- Next.js のサーバー側 API route (`/api/decision`)
- TypeSafe の Jev System One API

ゲームループは固定 60 Hz の更新と `requestAnimationFrame` 描画です。Jev は約300〜680 ms 間隔（難易度で変化）で戦術意図とプレイヤー行動予測をまとめて判断します。キャラクターの操作・物理・当たり判定はローカルのゲームロジックが実行します。通信は非同期で、応答待ちでもゲームは止まりません。古い応答は破棄します。

## セットアップ

Node.js 20.9 以降を用意してください。

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

`npm run build:pages` で `out/` に静的サイトを生成します。`main` への push で `.github/workflows/deploy-pages.yml` がテスト・ビルド・公開を行います。GitHub のリポジトリ設定で Pages の公開元を「GitHub Actions」にしてください。公開先は `https://nosuke1729.github.io/jevgame/` です。PC ブラウザーでキーボード操作できます。

GitHub Pages はサーバー側 API を実行できません。そのため Pages 版は、プレイヤー行動の記録と予測を使う標準AIで遊べますが、Jev の実通信は行いません。`JEV_API_KEY` を Pages・GitHub Actions・クライアント JavaScript に登録しないでください。Jev 対戦を公開するには、別途サーバー側 API を安全にホストする必要があります。ローカルの Next.js 版では従来どおり Jev を使用できます。
