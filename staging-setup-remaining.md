# ステージング環境 — 残作業手順書

作成日: 2026-04-20

## 完了済みタスク

| # | タスク | ステータス |
|---|---|---|
| 1 | GAS ステージングプロジェクト作成・デプロイ | 完了 |
| 2 | LINE Official Account作成（テスト） | 完了 |
| 3 | Messaging API有効化 | 完了 |
| 4 | Webhook URL設定・有効化 | 完了 |
| 5 | チャネルアクセストークン発行 | 完了 |
| 6 | 応答メッセージOFF設定 | 完了 |
| 7 | Script Properties: LINE_CHANNEL_ACCESS_TOKEN | 完了 |
| 8 | ログ用スプレッドシート作成・00_設定.jsにID反映 | 完了 |

## 残作業（手動で実施が必要）

### 1. Stripeテストモード設定

Stripeダッシュボード（https://dashboard.stripe.com/test）で以下を実施：

1. **テストモードに切り替え**（右上のトグル）
2. **商品を作成**:
   - 名前: `ゴルフAI月額プラン（テスト）`
   - 価格: 480円/月（recurring）
   - 作成後、**Price ID**（`price_xxx`）をコピー
3. **Webhook Endpointを作成**:
   - URL: `https://script.google.com/macros/s/AKfycbz0hvLgGYvKPnMk5f81-zpG_Gd1Ym92yzlnzJEBn0BPw-eC-O8D994lEbwlMDBsnM8k/exec`
   - イベント: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
   - 作成後、**Webhook Signing Secret**（`whsec_xxx`）をコピー
4. **テスト用Secret Key**をコピー:
   - ダッシュボード → 開発者 → APIキー → テスト用シークレットキー（`sk_test_xxx`）

### 2. GAS Script Properties追加設定

GASプロジェクト設定画面: https://script.google.com/home/projects/1cOuQrZft95f2HOYx3R6wAYkbYjxW1ltZxBCH-hZqIFQhPCdHFiwU2Kmr/settings

「スクリプト プロパティを編集」をクリックして、以下を追加：

| プロパティ名 | 値 | 備考 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | （設定済み） | テスト用LINEトークン |
| `CLOUDRUN_ANALYZE_SHARED_SECRET` | 本番と同じ値 | 本番のScript Propertiesからコピー |
| `CLOUDRUN_TEXT_SHARED_SECRET` | 本番と同じ値 | 本番のScript Propertiesからコピー |
| `DATASET_SALT` | 任意の文字列 | テスト用なので適当でOK（例: `staging-salt-2026`） |
| `STRIPE_SECRET_KEY` | `sk_test_xxx` | 上記手順1-4で取得 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` | 上記手順1-3で取得 |
| `STRIPE_PRICE_ID` | `price_xxx` | 上記手順1-2で取得 |

本番のScript Propertiesは以下から確認:
https://script.google.com/home/projects/1UUV_lA-8vY7z3STszRWa5b2nMyz7KCwA1X7VGU3NmF8oPxfoaSuE8_aK/settings

### 3. GCSステージング用バケット作成

GCPコンソール（https://console.cloud.google.com/storage）で:
- バケット名: `golf-ai-line-videos-staging`
- リージョン: `asia-northeast1`（東京）
- 既存バケット `golf-ai-line-videos` と同じ設定

### 4. Cloud Runステージングリビジョン作成（任意）

現在の `00_設定.js` では staging タグ付きURLを使用:
```
https://staging---swing-analyzer-4amu3rxdsq-an.a.run.app/analyze
https://staging---text-answer-4amu3rxdsq-an.a.run.app/answer
```

Cloud Runでリビジョンタグ `staging` を作成するか、または本番URLをそのまま使うかを判断:
- 本番URLを使う場合: `00_設定.js` の `解析サービスURL` を本番URLに変更

### 5. clasp push & 再デプロイ

00_設定.jsのスプレッドシートIDを反映したコードをGASに反映:

```bash
cd /path/to/ゴルフアプリ/gas-staging
clasp push --force
clasp deploy --deploymentId AKfycbz0hvLgGYvKPnMk5f81-zpG_Gd1Ym92yzlnzJEBn0BPw-eC-O8D994lEbwlMDBsnM8k
```

## ステージング環境の設定値まとめ

```
LINE Official Account: ゴルフのあいちゃん（テスト） @038ugafj
LINE Channel ID: 2009833953
LINE Channel Secret: 60f288c1f2e39945bfc77bac79896d55

GAS Script ID: 1cOuQrZft95f2HOYx3R6wAYkbYjxW1ltZxBCH-hZqIFQhPCdHFiwU2Kmr
GAS Deploy ID: AKfycbz0hvLgGYvKPnMk5f81-zpG_Gd1Ym92yzlnzJEBn0BPw-eC-O8D994lEbwlMDBsnM8k
GAS Web App URL: https://script.google.com/macros/s/AKfycbz0hvLgGYvKPnMk5f81-zpG_Gd1Ym92yzlnzJEBn0BPw-eC-O8D994lEbwlMDBsnM8k/exec

ログSpreadsheet ID: 1zTIktA5N2HzH5dsijEQz7cLli8ebvFU52JqlImpRlpY
```
