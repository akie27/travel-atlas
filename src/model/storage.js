/**
 * 永続化：ブラウザの localStorage を使う。
 * サーバー不要でGitHub Pagesなどどこにデプロイしても動く。ただし欠点として、
 * 他の端末・他のブラウザとは同期されず、ブラウザのデータを消去すると記録も消える。
 */
export function loadVisited(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveVisited(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("保存に失敗しました:", e);
  }
}

/**
 * データの書き出し／読み込み。
 * 「訪問済み・行く予定の県・国＋メモ」を1つのJSONファイルとしてダウンロードし、
 * 別のブラウザ・別の端末でも同じファイルを読み込めば記録を引き継げる。
 * localStorageは端末ごとに独立しているため、この仕組みが「引っ越し用のかばん」になる。
 */
export function buildBackupFile(visited, planned) {
  const payload = {
    app: "travel-atlas",
    version: 2,
    exportedAt: new Date().toISOString(),
    visited,
    planned,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `travel-atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** バックアップファイルの中身を検証しつつ取り出す。壊れたファイルなら例外を投げる。 */
export function parseBackupFile(text) {
  const parsed = JSON.parse(text);
  const pick = (obj, key) => (obj && typeof obj[key] === "object" ? obj[key] : {});
  return {
    jp: pick(parsed.visited, "jp"),
    world: pick(parsed.visited, "world"),
    // version 1のバックアップにはplannedが無いので、無ければ空のまま読み込む
    plannedJp: pick(parsed.planned, "jp"),
    plannedWorld: pick(parsed.planned, "world"),
  };
}
