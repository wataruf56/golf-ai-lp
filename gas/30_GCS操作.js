/**
 * 30_GCS操作.gs
 */

function GCSアップロード_(blob, objectName) {
  if (!blob) throw new Error("GCSアップロード_: blob が空です");
  if (!objectName) throw new Error("GCSアップロード_: objectName が空です");

  const token = ScriptApp.getOAuthToken();
  const url =
    "https://storage.googleapis.com/upload/storage/v1/b/" +
    encodeURIComponent(GCSバケット名) +
    "/o?uploadType=media&name=" +
    encodeURIComponent(objectName);

  const opt = {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "video/mp4",
    },
    payload: blob.getBytes(),
  };

  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code !== 200) throw new Error("GCSアップロード_ 失敗: code=" + code + " body=" + text);

  let json = null;
  try { json = JSON.parse(text); } catch (e) {}

  return { bucket: json?.bucket || GCSバケット名, name: json?.name || objectName };
}

/**
 * gs://bucket/path/to/file.mp4 → { bucket, name }
 */
function GCS_URI分解_(gcsUri) {
  const s = String(gcsUri || "");
  if (!s.startsWith("gs://")) return null;
  const x = s.replace("gs://", "");
  const i = x.indexOf("/");
  if (i < 0) return { bucket: x, name: "" };
  return { bucket: x.slice(0, i), name: x.slice(i + 1) };
}

/**
 * GCS削除
 */
function GCS削除_(gcsUri) {
  const p = GCS_URI分解_(gcsUri);
  if (!p || !p.bucket || !p.name) return { ok: false, reason: "invalid_uri" };

  const token = ScriptApp.getOAuthToken();
  const url =
    "https://storage.googleapis.com/storage/v1/b/" +
    encodeURIComponent(p.bucket) +
    "/o/" +
    encodeURIComponent(p.name);

  const opt = {
    method: "delete",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
    },
  };

  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();

  // 200/204: OK, 404: 既に消えている扱い
  if (code === 200 || code === 204 || code === 404) return { ok: true, code };

  return { ok: false, code, body: res.getContentText() };
}
