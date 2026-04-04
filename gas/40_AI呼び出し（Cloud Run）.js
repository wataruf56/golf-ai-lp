/**
 * 40_AI呼び出し（Cloud Run）.gs
 *
 * 【変更点】
 * - Cloud Run共有シークレット（解析/テキスト）をコード直書きから廃止
 * - Script Properties（PROP_解析サービス共有シークレット / PROP_テキスト回答サービス共有シークレット）から取得して利用するよう変更
 */

function 解析サービス共有シークレット取得_() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty(PROP_解析サービス共有シークレット) || "";
  return String(secret);
}

function テキスト回答サービス共有シークレット取得_() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty(PROP_テキスト回答サービス共有シークレット) || "";
  return String(secret);
}

function CloudRun_JSON呼び出し_(URL, シークレット, payloadObj) {
  const options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "x-shared-secret": String(シークレット || "") },
    payload: JSON.stringify(payloadObj || {}),
  };

  const res = UrlFetchApp.fetch(URL, options);
  const code = res.getResponseCode();
  const text = res.getContentText();

  let json = null;
  try { json = JSON.parse(text); } catch (e) {}

  return { code, text, json };
}

function 動画解析_Gemini_(gcsUri) {
  if (!gcsUri) throw new Error("動画解析_Gemini_: gcsUri が空です");

  const secret = 解析サービス共有シークレット取得_();
  if (!secret) throw new Error("動画解析_Gemini_: 解析サービス共有シークレットが未設定です（Script Properties）");

  const payload = { gcsUri: String(gcsUri) };
  const res = CloudRun_JSON呼び出し_(解析サービスURL, secret, payload);

  if (res.code !== 200) throw new Error("動画解析_Gemini_: Cloud Run エラー code=" + res.code + " body=" + res.text);

  const ok = !!res.json?.ok;
  const reviewText = res.json?.reviewText;

  if (!ok) throw new Error("動画解析_Gemini_: ok=false body=" + res.text);
  if (!reviewText || String(reviewText).trim() === "") throw new Error("動画解析_Gemini_: reviewText が空です body=" + res.text);

  const text = String(reviewText);

  // Geminiが動画を認識できなかった場合のエラーパターン検出
  const エラーパターン = [
    "動画が送られてきません",
    "動画を確認できません",
    "動画が確認できません",
    "動画が提供されていません",
    "映像が確認できません",
    "動画ファイルが見つかりません",
    "動画を受け取っていません",
    "動画がありません",
    "動画データが含まれていません",
  ];
  for (const pat of エラーパターン) {
    if (text.includes(pat)) {
      throw new Error("動画解析_Gemini_: Geminiが動画を認識できませんでした（リトライ対象）: " + text.substring(0, 300));
    }
  }

  // 解析結果が極端に短い場合（正常な解析は通常200文字以上）
  if (text.length < 100) {
    throw new Error("動画解析_Gemini_: 解析結果が短すぎます（" + text.length + "文字）: " + text);
  }

  return text;
}

function テキスト回答_AI_(userId, promptText, ラベル, 主キー) {
  if (!userId) throw new Error("テキスト回答_AI_: userId が空です");
  if (!promptText) throw new Error("テキスト回答_AI_: promptText が空です");

  // テスト用：1回目（解析用）のプロンプトのみ記録。コーチ観察は記録しない。
  if (ラベル !== "コーチ観察") {
    try {
      AIプロンプトログ出力_(
        主キー !== undefined ? String(主キー) : "",
        userId,
        String(promptText),
        ラベル !== undefined ? String(ラベル) : ""
      );
    } catch (e) {}
  }

  const secret = テキスト回答サービス共有シークレット取得_();
  if (!secret) throw new Error("テキスト回答_AI_: テキスト回答サービス共有シークレットが未設定です（Script Properties）");

  const payload = { userId: String(userId), text: String(promptText) };
  const res = CloudRun_JSON呼び出し_(テキスト回答サービスURL, secret, payload);

  if (res.code !== 200) throw new Error("テキスト回答_AI_: Cloud Run エラー code=" + res.code + " body=" + res.text);

  const ok = !!res.json?.ok;
  const answerText = res.json?.answerText;

  if (!ok) throw new Error("テキスト回答_AI_: ok=false body=" + res.text);
  if (!answerText || String(answerText).trim() === "") throw new Error("テキスト回答_AI_: answerText が空です body=" + res.text);

  return String(answerText);
}

/**
 * レベル別パラメータ
 */
function レベル設定取得_(userLevel) {
  const lv = String(userLevel || ユーザーレベル_未設定);

  // 参照事例数 / 返答の長さ（行数）
  if (lv === ユーザーレベル_初心者) return { 事例数: 2, 最大行数: 4, 専門度: "やさしく" };
  if (lv === ユーザーレベル_上級者) return { 事例数: 6, 最大行数: 10, 専門度: "深く" };
  // 中級者/未設定は中間
  return { 事例数: 4, 最大行数: 7, 専門度: "標準" };
}
