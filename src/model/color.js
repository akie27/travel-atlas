/**
 * 色の決定ロジック（貪欲彩色 + ランダム性）。
 * 「隣接する地域がすでに使っている色」を除いたパレットからランダムに選ぶ。
 * 万が一パレットの色を隣接地域が使い切っていたら（理論上ほぼ起きない）、
 * 全パレットから選び直す。
 */
export const PALETTE = [
  "#FF6FA0", "#FFB84C", "#FFE066", "#8CE99A",
  "#63E6E8", "#74C0FC", "#B197FC", "#F783AC",
  "#FFA8A8", "#69DB7C", "#FFD43B", "#DA77F2",
];

export function pickColor(neighborIndices, colorByIndex) {
  const used = new Set(
    [...neighborIndices].map((i) => colorByIndex[i]).filter(Boolean)
  );
  const available = PALETTE.filter((c) => !used.has(c));
  const pool = available.length > 0 ? available : PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}
