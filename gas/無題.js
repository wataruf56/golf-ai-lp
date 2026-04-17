function TEST_LINEプッシュ() {
  const userId = "U41f8e33f0633a54365d38c8bc2b69517";
  LINEプッシュ送信実行_(userId, "TEST: Script Properties 経由で送信できました");
}

function TEST_テキスト回答() {
  const userId = "ダミーでもOK（空はNG）";
  const ans = テキスト回答_AI_(userId, "テストです。1行で返してください。");
  Logger.log(ans);
}

/**
 * リッチメニュー一括登録（画像はrichmenu_image_data.jsのBase64定数を使用）
 * GASエディタから手動実行する
 *
 * 処理: 1)リッチメニュー作成 → 2)画像アップロード → 3)デフォルト設定
 */
function リッチメニュー登録_3カラム() {
  const TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");

  // --- Step 1: リッチメニュー作成 ---
  const menuBody = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "メインメニュー v4",
    chatBarText: "メニュー",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 913, height: 843 },
        action: { type: "message", text: "解析メニュー" }
      },
      {
        bounds: { x: 913, y: 0, width: 794, height: 843 },
        action: { type: "message", text: "使い方" }
      },
      {
        bounds: { x: 1707, y: 0, width: 793, height: 843 },
        action: { type: "uri", uri: "https://lin.ee/5MkA79c" }
      }
    ]
  };

  const createRes = UrlFetchApp.fetch("https://api.line.me/v2/bot/richmenu", {
    method: "post",
    headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
    payload: JSON.stringify(menuBody),
    muteHttpExceptions: true
  });
  Logger.log("Create: " + createRes.getContentText());
  const richMenuId = JSON.parse(createRes.getContentText()).richMenuId;
  if (!richMenuId) { Logger.log("ERROR: richMenuId取得失敗"); return; }
  Logger.log("richMenuId: " + richMenuId);

  // --- Step 2: 画像アップロード（richmenu_image_data.js の RICHMENU_IMAGE_B64 定数を使用）---
  const imageBytes = Utilities.base64Decode(RICHMENU_IMAGE_B64);
  const uploadRes = UrlFetchApp.fetch(
    "https://api-data.line.me/v2/bot/richmenu/" + richMenuId + "/content",
    {
      method: "post",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "image/png" },
      payload: imageBytes,
      muteHttpExceptions: true
    }
  );
  Logger.log("Upload: " + uploadRes.getContentText());

  // --- Step 3: 全ユーザーのデフォルトに設定 ---
  const defaultRes = UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/user/all/richmenu/" + richMenuId,
    {
      method: "post",
      headers: { "Authorization": "Bearer " + TOKEN },
      muteHttpExceptions: true
    }
  );
  Logger.log("SetDefault: " + defaultRes.getContentText());
  Logger.log("✅ リッチメニュー登録完了！ richMenuId: " + richMenuId);
}

/**
 * API経由で作成されたリッチメニューをすべて削除する
 * LINE管理画面でリッチメニューを作り直す前に実行すること
 */
function リッチメニュー全削除_API() {
  const TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");

  // 1. 既存のリッチメニュー一覧を取得
  const listRes = UrlFetchApp.fetch("https://api.line.me/v2/bot/richmenu/list", {
    method: "get",
    headers: { "Authorization": "Bearer " + TOKEN },
    muteHttpExceptions: true
  });
  Logger.log("一覧取得: " + listRes.getContentText().slice(0, 500));

  const menus = JSON.parse(listRes.getContentText()).richmenus || [];
  Logger.log("リッチメニュー数: " + menus.length);

  if (menus.length === 0) {
    Logger.log("削除対象なし");
    return;
  }

  // 2. デフォルト設定を解除
  const cancelRes = UrlFetchApp.fetch("https://api.line.me/v2/bot/user/all/richmenu", {
    method: "delete",
    headers: { "Authorization": "Bearer " + TOKEN },
    muteHttpExceptions: true
  });
  Logger.log("デフォルト解除: " + cancelRes.getResponseCode());

  // 3. 各リッチメニューを削除
  for (var i = 0; i < menus.length; i++) {
    var id = menus[i].richMenuId;
    var delRes = UrlFetchApp.fetch("https://api.line.me/v2/bot/richmenu/" + id, {
      method: "delete",
      headers: { "Authorization": "Bearer " + TOKEN },
      muteHttpExceptions: true
    });
    Logger.log("削除 " + id + ": " + delRes.getResponseCode());
  }

  Logger.log("✅ 全リッチメニュー削除完了。LINE管理画面から新しく作成してください。");
}

function TEST_runQuery_動画キュー取得() {
  const URL = `https://firestore.googleapis.com/v1/projects/${GCPプロジェクトID}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: Firestoreコレクション_動画 }],
      where: {
        fieldFilter: {
          field: { fieldPath: "status" },
          op: "EQUAL",
          value: { stringValue: 動画ステータス_キュー },
        },
      },
      limit: 3,
    },
  };

  const res = Firestore通信_(URL, "post", body);
  Logger.log("code=" + res.code);
  Logger.log("text(head500)=" + String(res.text || "").slice(0, 500));
  Logger.log("json=" + JSON.stringify(res.json));
}
