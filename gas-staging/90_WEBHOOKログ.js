/**
 * 90_WEBHOOKログ.gs
 *
 * ※AIプロンプトログ・AI解析結果ログはテスト用としてログを貯めているだけ。
 *   主キー（動画の messageId）で両シートをマッチして確認できる。
 */

function Webhookログ出力_(フェーズ, メッセージ, obj) {
  try {
    if (!WEBHOOKログ_スプレッドシートID) return;

    const ss = SpreadsheetApp.openById(WEBHOOKログ_スプレッドシートID);
    const sheet =
      ss.getSheetByName(WEBHOOKログ_シート名) || ss.insertSheet(WEBHOOKログ_シート名);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["tsJST", "phase", "message", "json"]);
    }

    const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
    const jsonText = obj === undefined ? "" : 安全JSON文字列化_(obj);

    sheet.appendRow([ts, String(フェーズ || ""), String(メッセージ || ""), jsonText]);
  } catch (e) {}
}

function 安全JSON文字列化_(obj) {
  try { return JSON.stringify(obj); } catch (e) { return String(obj); }
}

/**
 * 【テスト用】AIプロンプトログ：AIに送っているプロンプトだけを記録する。
 * 1回目（解析用）のプロンプトのみ。コーチ観察は記録しない。主キーでAI解析結果ログとマッチ。
 * @param {string} 主キー - 動画の messageId（videos のドキュメントID）。自由質問の場合は空
 * @param {string} userId - ユーザーID
 * @param {string} promptText - AIに送信したプロンプト全文
 * @param {string} label - 呼び出し元（自分解析 / プロ比較 / 過去比較 / 自由質問 など）。6モード判別用
 * @param {boolean} [テストモード] - true のとき「テストモードでこのプロンプトが送られた」と分かるように 1 を記録
 */
function AIプロンプトログ出力_(主キー, userId, promptText, label, テストモード) {
  try {
    if (!WEBHOOKログ_スプレッドシートID) return;

    const ss = SpreadsheetApp.openById(WEBHOOKログ_スプレッドシートID);
    const sheet =
      ss.getSheetByName(AIプロンプトログ_シート名) || ss.insertSheet(AIプロンプトログ_シート名);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["主キー", "tsJST", "userId", "label", "promptText", "テストモード"]);
    }

    const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      String(主キー || ""),
      ts,
      String(userId || ""),
      String(label || ""),
      String(promptText || ""),
      テストモード ? "1" : "",
    ]);
  } catch (e) {}
}

/**
 * 【テスト用】AI解析結果ログ：そのプロンプトから返ってきたものを記録する。
 * 主キーはAIプロンプトログの主キーと同じ（動画の messageId）。主キーで両シートをマッチ可能。
 * @param {string} 主キー - 動画の messageId（AIプロンプトログの主キーと同一）
 * @param {string} reviewText - そのプロンプトへの返答（解析結果テキスト）
 * @param {string} coachCheckText - P1〜P10観察メモ（2回目呼び出しの返り）
 * @param {boolean} [テストモード] - true のとき「テストモードでこの返答が返った」と分かるように 1 を記録
 */
function 解析結果ログ出力_(主キー, reviewText, coachCheckText, テストモード) {
  try {
    if (!WEBHOOKログ_スプレッドシートID) return;

    const ss = SpreadsheetApp.openById(WEBHOOKログ_スプレッドシートID);
    const sheet =
      ss.getSheetByName(AI解析結果ログ_シート名) || ss.insertSheet(AI解析結果ログ_シート名);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["主キー", "tsJST", "返答テキスト", "コーチ観察メモ", "テストモード"]);
    }

    const ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      String(主キー || ""),
      ts,
      String(reviewText || ""),
      String(coachCheckText || ""),
      テストモード ? "1" : "",
    ]);
  } catch (e) {}
}

function TEST_ログ出力確認() {
  Webhookログ出力_("テスト", "ログ出力確認", { now: new Date().toISOString() });
  try { SpreadsheetApp.getUi().alert("OK：WEBHOOK_LOG に1行追加されました"); }
  catch (e) { Logger.log("UI alert はスキップ: " + e); }
}
