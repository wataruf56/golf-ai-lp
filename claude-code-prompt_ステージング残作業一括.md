# 指示: ステージング環境の残作業を一括実施

## 背景

ゴルフAI LINEボット「ゴルフのあいちゃん」のステージング環境を構築中。
以下はすでに完了している:
- GASステージングプロジェクト作成済み（scriptId: `1cOuQrZft95f2HOYx3R6wAYkbYjxW1ltZxBCH-hZqIFQhPCdHFiwU2Kmr`）
- LINE Official Account「ゴルフのあいちゃん（テスト）」@038ugafj 作成済み
- Messaging API有効化・Webhook URL設定・チャネルアクセストークン発行済み
- GAS Script Properties に `LINE_CHANNEL_ACCESS_TOKEN` 設定済み
- ログ用スプレッドシート作成済み（ID: `1zTIktA5N2HzH5dsijEQz7cLli8ebvFU52JqlImpRlpY`）
- `gas-staging/00_設定.js` にスプレッドシートID反映済み

## やることリスト（この順番で実施）

---

### タスク1: 本番のScript Propertiesからシークレット値を取得

本番GASプロジェクトのScript Propertiesに格納されている以下の値を取得する。

本番のscriptId: `1UUV_lA-8vY7z3STszRWa5b2nMyz7KCwA1X7VGU3NmF8oPxfoaSuE8_aK`
本番の `.clasp.json`: プロジェクトルートの `.clasp.json`（rootDir: "gas"）

以下のGASスクリプトを本番プロジェクトで実行して値を取得:
```javascript
function getScriptProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  console.log(JSON.stringify(props, null, 2));
}
```

取得したい値:
- `CLOUDRUN_ANALYZE_SHARED_SECRET`
- `CLOUDRUN_TEXT_SHARED_SECRET`
- `DATASET_SALT`

※ これらは clasp run で実行するか、GASエディタのログで確認する。
※ clasp run が使えない場合は、ユーザーに確認して手動取得する。

---

### タスク2: GCSステージング用バケット作成

```bash
gcloud storage buckets create gs://golf-ai-line-videos-staging \
  --project=golf-ai-line-app \
  --location=asia-northeast1 \
  --uniform-bucket-level-access
```

バケットが既に存在する場合はスキップ。

---

### タスク3: ステージングGASのScript Properties追加設定

取得した値を使って、ステージングGASプロジェクトのScript Propertiesに以下を追加する。

GASプロジェクト設定URL: https://script.google.com/home/projects/1cOuQrZft95f2HOYx3R6wAYkbYjxW1ltZxBCH-hZqIFQhPCdHFiwU2Kmr/settings

以下をGASエディタまたはclasp経由で設定:
```javascript
function setStaginProps() {
  const sp = PropertiesService.getScriptProperties();
  // LINE_CHANNEL_ACCESS_TOKEN は設定済みなのでスキップ
  sp.setProperty("CLOUDRUN_ANALYZE_SHARED_SECRET", "【タスク1で取得した値】");
  sp.setProperty("CLOUDRUN_TEXT_SHARED_SECRET", "【タスク1で取得した値】");
  sp.setProperty("DATASET_SALT", "staging-salt-2026");
  // Stripe関連はテストモードのキーが必要（後で設定）
  // sp.setProperty("STRIPE_SECRET_KEY", "sk_test_xxx");
  // sp.setProperty("STRIPE_WEBHOOK_SECRET", "whsec_xxx");
  // sp.setProperty("STRIPE_PRICE_ID", "price_xxx");
}
```

※ Stripe関連3つは後回しでOK。まずLINE + Cloud Run の疎通確認を優先する。

---

### タスク4: 70_プロンプト.js に動画直接版プロンプト関数を追加（本番）

`claude-code-prompt_70_動画直接版追加.md` の指示に従って実施する。

対象: `gas/70_プロンプト.js`（本番コード）

追加する関数:
1. `プロンプト_自分解析_単体_動画直接_()`
2. `プロンプト_自分解析_テキストあり_動画直接_(userMessage)`
3. `プロンプト_比較_動画直接_(userMessage)`
4. `プロンプト_過去比較_動画直接_(userMessage)`
5. `プロンプト_質問モード_動画直接_(userPrompt)`

詳細な仕様は `claude-code-prompt_70_動画直接版追加.md` を参照すること。

実装後:
```bash
cd /path/to/ゴルフアプリ
clasp push --force
clasp deploy --deploymentId AKfycbwQlDqhbTWgYrRjnMziTLkaJdF1Ja4G2PoaVS7Ubz_cdgh0HmWL24J-Flm1YgiKPRcLkQ
```

---

### タスク5: gas-staging にも 70_プロンプト.js を同期

タスク4で追加した動画直接版関数を含む最新の `gas/70_プロンプト.js` を `gas-staging/70_プロンプト.js` にコピーする。

```bash
cp gas/70_プロンプト.js gas-staging/70_プロンプト.js
```

---

### タスク6: gas-staging を clasp push & デプロイ

```bash
cd /path/to/ゴルフアプリ/gas-staging
clasp push --force
clasp deploy --deploymentId AKfycbz0hvLgGYvKPnMk5f81-zpG_Gd1Ym92yzlnzJEBn0BPw-eC-O8D994lEbwlMDBsnM8k
```

※ gas-staging の `.clasp.json` の scriptId は `1cOuQrZft95f2HOYx3R6wAYkbYjxW1ltZxBCH-hZqIFQhPCdHFiwU2Kmr`
※ rootDir が空文字（""）なので、gas-staging/ ディレクトリ直下から実行する必要がある

---

### タスク7: Cloud Runステージングリビジョン確認

`gas-staging/00_設定.js` のCloud Run URLがstaging タグを使っている:
```
https://staging---swing-analyzer-4amu3rxdsq-an.a.run.app/analyze
https://staging---text-answer-4amu3rxdsq-an.a.run.app/answer
```

以下を確認:
1. swing-analyzerサービスに `staging` タグ付きリビジョンが存在するか
2. 存在しなければ、本番のURLに書き換えるか、タグ付きリビジョンを作成する

確認コマンド:
```bash
gcloud run revisions list --service=swing-analyzer --project=golf-ai-line-app --region=asia-northeast1
gcloud run services describe swing-analyzer --project=golf-ai-line-app --region=asia-northeast1 --format="yaml(status.traffic)"
```

もしstagingタグが存在しない場合、`gas-staging/00_設定.js` の解析サービスURLを本番URLに変更:
```javascript
const 解析サービスURL = "https://swing-analyzer-10213914862.asia-northeast1.run.app/analyze";
const テキスト回答サービスURL = "https://text-answer-10213914862.asia-northeast1.run.app/answer";
```

変更した場合は、タスク6のclasp push & deployを再実行。

---

## 注意事項

- 本番の `gas/` フォルダのファイルは、70_プロンプト.js への関数追加以外は変更しない
- `gas-staging/` は本番コードのコピーだが、`00_設定.js` だけステージング用に変更済み
- clasp push する際は、対象ディレクトリの `.clasp.json` の scriptId を必ず確認すること（本番とステージングを間違えない）
- 本番の clasp は プロジェクトルート（`.clasp.json` の rootDir: "gas"）から実行
- ステージングの clasp は `gas-staging/` ディレクトリから実行（rootDir: ""）
