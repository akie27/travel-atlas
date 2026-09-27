/**
 * 都道府県コード(JIS X 0401, 2桁)→ 名称 の対応表。
 * jpn-atlasの座標データには名前が入っていないため、ここで自前の対応表を持つ。
 * これは単なる事実の一覧（電話帳のようなもの）なので著作物性はなく、
 * 自分のコードとして安心して埋め込める。
 */
const PREF_NAMES = {
  "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県", "05": "秋田県",
  "06": "山形県", "07": "福島県", "08": "茨城県", "09": "栃木県", "10": "群馬県",
  "11": "埼玉県", "12": "千葉県", "13": "東京都", "14": "神奈川県", "15": "新潟県",
  "16": "富山県", "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
  "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県", "25": "滋賀県",
  "26": "京都府", "27": "大阪府", "28": "兵庫県", "29": "奈良県", "30": "和歌山県",
  "31": "鳥取県", "32": "島根県", "33": "岡山県", "34": "広島県", "35": "山口県",
  "36": "徳島県", "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
  "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県", "45": "宮崎県",
  "46": "鹿児島県", "47": "沖縄県",
};

/** idから都道府県コード(2桁)を取り出す。2桁のことも5桁(市区町村コード)のこともある。 */
function prefCodeFromId(id) {
  const s = String(id);
  return s.length >= 5 ? s.slice(0, 2) : s.padStart(2, "0");
}

/**
 * データの取得元。どちらも第三者が公開しているオープンデータ。
 * ・日本: jpn-atlas（npmパッケージ経由。出典: 国土地理院「地球地図日本2016」）
 *   すでにSVG用に投影・簡略化済みなので、そのままviewBoxに描画できる。
 * ・世界: topojson/world-atlas （Natural Earthのデータをビルドしたもの、Public Domain）
 */
export const SOURCES = {
  jp: {
    urls: [
      "https://cdn.jsdelivr.net/npm/jpn-atlas@1/japan/japan.json",
      "https://unpkg.com/jpn-atlas@1/japan/japan.json",
    ],
    objectName: "prefectures",
    projected: true, // すでに850x680平面に投影済み。追加の地図投影は不要。
    viewBox: [850, 680],
    getName: (p, id) => PREF_NAMES[prefCodeFromId(id)] || `不明(${id})`,
    getSubName: () => "",
    // 都道府県コード(01〜47)に対応しないものは、結合(merge)処理の副産物である
    // 可能性が高いので一覧から除外する。
    isValid: (id) => Boolean(PREF_NAMES[prefCodeFromId(id)]), // properties引数は使わない
    // 都道府県コードがそのまま北→南のおおよその並び順になっている。
    sortOrder: (p, id) => Number(prefCodeFromId(id)),
  },
  world: {
    urls: [
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
      "https://unpkg.com/world-atlas@2/countries-110m.json",
    ],
    objectName: "countries",
    projected: false,
    viewBox: [960, 500],
    getName: (p) => p.name || "Unknown",
    getSubName: () => "",
    isValid: () => true,
    sortOrder: null, // 世界タブは五十音／アルファベット順のまま
  },
};

/** 複数の候補URLを順番に試し、最初に成功したレスポンスのJSONを返す。 */
export async function fetchWithFallback(urls) {
  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTPエラー: ${res.status} (${url})`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("すべての取得先で失敗しました");
}
