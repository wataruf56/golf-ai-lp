# 指示: ゴルフAIアプリのステージング（テスト）環境を構築する

## 目的

現在、本番環境が1つしかなく、改修するとそのまま全ユーザーに影響する。
「ステージング環境（テスト用）」を追加で構築し、以下の状態を実現する:
- 本番環境: 今まで通り一般ユーザーが使う（変更しない）
- ステージング環境: 開発者（Wataru）だけがテストに使う

## 現在の本番環境の構成

```
LINE Messaging API（本番ボット: ゴルフのあいちゃん）
    ↓ Webhook
GAS (Google Apps Script)
  - scriptId: 1UUV_lA-8vY7z3STszRWa5b2nMyz7KCwA1X7VGU3NmF8oPxfoaSuE8_aK
  - deploymentId: AKfycbwQlDqhbTWgYrRjnMziTLkaJdF1Ja4G2PoaVS7Ubz_cdgh0HmWL24J-Flm1YgiKPRcLkQ
    ↓
Cloud Run (GCPプロジェクト: golf-ai-line-app)
  - swing-analyzer: https://swing-analyzer-10213914862.asia-northeast1.run.app/analyze
  - text-answer: https://text-answer-10213914862.asia-northeast1.run.app/answer
  - gcs-signer
    ↓
Firestore (golf-ai-line-app)
  - コレクション: user_state, videos, dataset_items, dataset_users
GCS
  - バケット: golf-ai-line-videos
Stripe（本番アカウント）
```

### ローカルフォルダ構成
```
ゴルフアプリ/
├── gas/              ← GASコード（clasp push対象）
│   ├── 00_設定.js
│   ├── 10_Firestore操作.js
│   ├── 20_LINE操作.js
│   ├── 30_GCS操作.js
│   ├── 35_Stripe操作.js
│   ├── 40_AI呼び出し（Cloud Run）.js
│   ├── 50_WEBHOOK（doPost）.js
│   ├── 60_worker（自動解析）.js
│   ├── 70_プロンプト.js
│   ├── 80_月次リセット.js
│   ├── 90_WEBHOOKログ.js
│   └── ...
├── cloudrun/
│   ├── swing-analyzer/   ← Node.js (index.js, Dockerfile, package.json)
│   ├── text-answer/
│   └── gcs-signer/
├── .clasp.json           ← 本番GASプロジェクトを指している
└── CLAUDE.md
```

### 設定値の管理方式
- `00_設定.js`: 定数（キー名、URL、コレクション名等）をコード直書き
- Script Properties: シークレット値（LINEトークン、Cloud Run共有シークレット、Stripeキー等）

## 構築するステージング環境

### 方針
- **GCPプロジェクトは同じ `golf-ai-line-app` を使う**（プロジェクトを増やすと料金管理が面倒）
- **Firestore・GCSはコレクション名/バケット名にプレフィックスをつけて分離**
- **Cloud Runはリビジョンタグで分離**
- **GASプロジェクトは新規作成して分離**
- **LINEはテスト用ボットを新規作成して分離**

### 構築する内容

#### 1. Cloud Run: ステージング用リビジョンタグ

swing-analyzerサービスに `staging` タグを付けたリビジョンURLを作る。
これにより本番URLとは別のURLでアクセスできる。

```bash
# 現在の最新リビジョンにstagingタグを付ける
gcloud run services update-traffic swing-analyzer \
  --region=asia-northeast1 \
  --project=golf-ai-line-app \
  --update-tags=staging=LATEST

# これで以下のURLが使えるようになる:
# ステージング: https://staging---swing-analyzer-10213914862.asia-northeast1.run.app/analyze
# 本番（既存）: https://swing-analyzer-10213914862.asia-northeast1.run.app/analyze
```

※ text-answerは今後廃止予定なのでステージング不要。
※ gcs-signerも同様にタグを付ける:
```bash
gcloud run services update-traffic gcs-signer \
  --region=asia-northeast1 \
  --project=golf-ai-line-app \
  --update-tags=staging=LATEST
```

#### 2. Firestore: ステージング用コレクション

本番と同じデータベース内で、コレクション名を変えて分離する。

| 本番 | ステージング |
|---|---|
| `user_state` | `staging_user_state` |
| `videos` | `staging_videos` |
| `dataset_items` | `staging_dataset_items` |
| `dataset_users` | `staging_dataset_users` |

#### 3. GCS: ステージング用バケット

```bash
gcloud storage buckets create gs://golf-ai-line-videos-staging \
  --project=golf-ai-line-app \
  --location=asia-northeast1 \
  --default-storage-class=STANDARD
```

#### 4. GAS: ステージング用プロジェクト

新しいGASプロジェクトを作成し、ステージング用の設定で動かす。

**手順:**

A. Google Apps Scriptで新規プロジェクトを作成（名前: `ゴルフAI_ステージング`）

B. ローカルにステージング用のclaspディレクトリを作成:
```bash
mkdir -p gas-staging
```

C. `gas-staging/.clasp.json` を作成（scriptIdは新プロジェクトのもの）

D. 本番の `gas/` フォルダの全ファイルをコピー:
```bash
cp gas/*.js gas-staging/
```

E. `gas-staging/00_設定.js` のステージング用定数を変更:
```javascript
// 以下の定数をステージング用に変更する

/* GCP（バケット名だけ変更） */
const GCSバケット名 = "golf-ai-line-videos-staging";

/* Firestore コレクション名（ステージング用プレフィックス追加） */
const Firestoreコレクション_ユーザー状態 = "staging_user_state";
const Firestoreコレクション_動画 = "staging_videos";
const Firestoreコレクション_データセット項目 = "staging_dataset_items";
const Firestoreコレクション_データセットユーザー = "staging_dataset_users";

/* Cloud Run（ステージング用タグ付きURL） */
const 解析サービスURL =
  "https://staging---swing-analyzer-10213914862.asia-northeast1.run.app/analyze";
const テキスト回答サービスURL =
  "https://staging---text-answer-10213914862.asia-northeast1.run.app/answer";

/* ログ（ステージング用スプレッドシートを別途作成してIDを変更） */
const WEBHOOKログ_スプレッドシートID = "（ステージング用スプレッドシートのID）";
```

F. Script Propertiesをステージング用に設定:
- `LINE_CHANNEL_ACCESS_TOKEN`: テスト用LINEボットのトークン
- `CLOUDRUN_ANALYZE_SHARED_SECRET`: 本番と同じでOK（同じCloud Runサービスなので）
- `STRIPE_SECRET_KEY`: Stripeのテストモードキー（`sk_test_...`）
- `STRIPE_WEBHOOK_SECRET`: ステージング用Webhook署名シークレット
- `STRIPE_PRICE_ID`: Stripeテストモードの価格ID

G. clasp push & deploy:
```bash
cd gas-staging
clasp push --force
clasp deploy
# → デプロイURLをメモ（LINEテスト用ボットのWebhookに設定する）
```

#### 5. LINE: テスト用ボット作成

LINE Developersコンソール（https://developers.line.biz/）で:

A. 既存プロバイダー内に新しいMessaging APIチャネルを作成
   - チャネル名: `ゴルフのあいちゃん（テスト）`
   - 説明: ステージング環境テスト用

B. Webhook URLにステージング用GASのデプロイURLを設定

C. チャネルアクセストークンを発行 → ステージング用GASのScript Propertiesに設定

D. テスト用ボットを自分のLINEに友だち追加

#### 6. Stripe: テストモード

Stripeはテストモードが標準機能として用意されているので、新規作成不要。

A. Stripeダッシュボードで「テストモード」に切り替え
B. テストモードの商品・価格を作成（月額480円）
C. テストモードのAPIキー（`sk_test_...`）をステージング用GASのScript Propertiesに設定
D. テストモードのWebhookエンドポイントを追加（ステージング用GASのデプロイURL + イベント設定）

#### 7. ログ用スプレッドシート

新しいGoogleスプレッドシートを作成:
- 名前: `ゴルフAI_ステージング_ログ`
- シートを3つ作成: `WEBHOOK_LOG`, `AI_PROMPT_LOG`, `AI_解析結果_LOG`
- スプレッドシートIDをステージング用 `00_設定.js` に設定

## ローカルフォルダの最終構成

```
ゴルフアプリ/
├── gas/                  ← 本番用GASコード（変更なし）
│   ├── 00_設定.js
│   └── ...
├── gas-staging/          ← ステージング用GASコード（新規）
│   ├── 00_設定.js        ← ステージング用に定数変更済み
│   ├── .clasp.json       ← ステージング用GASプロジェクトを指す
│   └── ...（他は本番と同じ）
├── cloudrun/             ← Cloud Runコード（共通。デプロイ先タグで分岐）
│   ├── swing-analyzer/
│   ├── text-answer/
│   └── gcs-signer/
├── .clasp.json           ← 本番用GASプロジェクト（変更なし）
└── CLAUDE.md
```

## 開発ワークフロー（環境構築後の運用）

1. `gas-staging/` のコードを改修
2. `cd gas-staging && clasp push --force && clasp deploy --deploymentId <ステージングID>`
3. テスト用LINEボットで動作確認
4. OKなら `gas/` にも同じ変更を反映
5. `cd gas && clasp push --force && clasp deploy --deploymentId <本番ID>`
6. git commit & push

Cloud Runの改修時:
1. コード修正後、stagingタグ付きでデプロイ:
   ```bash
   gcloud run deploy swing-analyzer \
     --source=cloudrun/swing-analyzer \
     --region=asia-northeast1 \
     --project=golf-ai-line-app \
     --tag=staging \
     --no-traffic
   ```
2. ステージングURLでテスト
3. OKなら本番トラフィックに切り替え:
   ```bash
   gcloud run services update-traffic swing-analyzer \
     --to-latest \
     --region=asia-northeast1 \
     --project=golf-ai-line-app
   ```

## Claude Code で自動実行できる作業

以下をこの順番で実行してください:

### Step 1: ローカルフォルダ構成の作成
```bash
cd ~/ゴルフアプリ
mkdir -p gas-staging
cp gas/*.js gas-staging/
```

### Step 2: gas-staging/00_設定.js のステージング用定数を変更
上記「4-E」の通り、以下の定数を変更:
- `GCSバケット名` → `"golf-ai-line-videos-staging"`
- `Firestoreコレクション_ユーザー状態` → `"staging_user_state"`
- `Firestoreコレクション_動画` → `"staging_videos"`
- `Firestoreコレクション_データセット項目` → `"staging_dataset_items"`
- `Firestoreコレクション_データセットユーザー` → `"staging_dataset_users"`
- `解析サービスURL` → `"https://staging---swing-analyzer-10213914862.asia-northeast1.run.app/analyze"`
- `テキスト回答サービスURL` → `"https://staging---text-answer-10213914862.asia-northeast1.run.app/answer"`
- `WEBHOOKログ_スプレッドシートID` → **後で手動設定（一旦空文字でOK）**

### Step 3: GCSステージング用バケット作成
```bash
gcloud storage buckets create gs://golf-ai-line-videos-staging \
  --project=golf-ai-line-app \
  --location=asia-northeast1 \
  --default-storage-class=STANDARD
```

### Step 4: Cloud Run にステージングタグを付与
```bash
gcloud run services update-traffic swing-analyzer \
  --region=asia-northeast1 \
  --project=golf-ai-line-app \
  --update-tags=staging=LATEST

gcloud run services update-traffic gcs-signer \
  --region=asia-northeast1 \
  --project=golf-ai-line-app \
  --update-tags=staging=LATEST
```

### Step 5: ログ用スプレッドシート作成（GAS で作成）
以下のスクリプトを一時的に実行して、ステージング用スプレッドシートを自動作成:
```javascript
function createStagingLogSheet() {
  const ss = SpreadsheetApp.create("ゴルフAI_ステージング_ログ");
  ss.getActiveSheet().setName("WEBHOOK_LOG");
  ss.insertSheet("AI_PROMPT_LOG");
  ss.insertSheet("AI_解析結果_LOG");
  Logger.log("スプレッドシートID: " + ss.getId());
  Logger.log("URL: " + ss.getUrl());
}
```

### Step 6: GASステージング用プロジェクト作成
```bash
cd ~/ゴルフアプリ/gas-staging

# 新規GASプロジェクト作成
clasp create --type webapp --title "ゴルフAI_ステージング" --rootDir .

# push
clasp push --force

# デプロイ
clasp deploy
```
→ 出力されたデプロイURLとdeploymentIdをメモする

### Step 7: git commit & push
```bash
cd ~/ゴルフアプリ
git add gas-staging/
git commit -m "ステージング環境用GASコード追加（gas-staging/）"
git push
```

## 手動で行う必要がある作業（Claude Codeではできない）

以下はブラウザ操作が必要なため、Wataruさんが手動で行ってください:

1. **LINE Developersコンソール** でテスト用Messaging APIチャネルを作成
   - https://developers.line.biz/ にログイン
   - 既存プロバイダー → 新規チャネル作成 → Messaging API
   - チャネル名: `ゴルフのあいちゃん（テスト）`
   - Webhook URL: Step 6で取得したGASデプロイURL
   - チャネルアクセストークンを発行

2. **Stripeダッシュボード** でテストモードの設定
   - テストモードに切り替え
   - 商品・価格を作成（月額480円テスト用）
   - Webhookエンドポイントを追加（ステージングGASのデプロイURL）
   - テストモードAPIキーをメモ

3. **GASステージング用Script Properties の設定**
   - GASエディタ（https://script.google.com/）でステージング用プロジェクトを開く
   - プロジェクトの設定 → スクリプトプロパティ に以下を設定:
     - `LINE_CHANNEL_ACCESS_TOKEN`: テスト用LINEボットのトークン
     - `CLOUDRUN_ANALYZE_SHARED_SECRET`: 本番と同じ値
     - `CLOUDRUN_TEXT_SHARED_SECRET`: 本番と同じ値
     - `STRIPE_SECRET_KEY`: Stripeテストモードキー（`sk_test_...`）
     - `STRIPE_WEBHOOK_SECRET`: テスト用Webhook署名シークレット
     - `STRIPE_PRICE_ID`: テストモードの価格ID
     - `DATASET_SALT`: 任意の文字列（テスト用）
     - `TEST_MODE`: `false`

4. **ログ用スプレッドシートIDの設定**
   - Step 5で作成したスプレッドシートのIDを `gas-staging/00_設定.js` の `WEBHOOKログ_スプレッドシートID` に設定
   - 再度 `clasp push --force` & `clasp deploy`
