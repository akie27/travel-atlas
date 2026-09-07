import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import { Search, RotateCcw, Check, MapPin, Globe2, AlertTriangle, Download, Upload, Sparkles } from "lucide-react";

/* =============================================================================
 * 旅の記録アトラス / Travel Atlas
 * -----------------------------------------------------------------------------
 * 学習用メモ：このファイルは「MVC」の考え方に寄せて3つの層に分けて書いています。
 *
 *   MODEL      … データそのものとロジック（地図データの取得・座標変換・
 *                 隣接判定・色の決定・保存/読込）。Reactを一切知らない
 *                 「純粋な関数」の集まりにしてあります。
 *   VIEW       … 見た目だけを担当する部品（TabBar, MapView, RegionList …）。
 *                 propsを受け取って表示するだけで、自分では判断しません。
 *   CONTROLLER … <App> コンポーネント本体。状態(state)を持ち、MODELの関数を
 *                 呼び出し、その結果をVIEWに渡す「橋渡し役」です。
 *
 * 本当はファイルを分けるのが定石です（下記が実際の分け方の例）。
 * このプレビューは1ファイルしか描画できない制約があるためコメントで
 * 層を区切っていますが、GitHubに上げるときはぜひ分割してみてください。
 *
 *   src/
 *     model/topojson.ts   … decodeTopology, computeAdjacency
 *     model/color.ts       … PALETTE, pickColor
 *     model/storage.ts     … loadVisited, saveVisited
 *     model/sources.ts     … SOURCES（データの取得元の定義）
 *     view/MapView.tsx
 *     view/RegionList.tsx
 *     view/SearchBox.tsx
 *     view/TabBar.tsx
 *     App.tsx              … CONTROLLER。上記を組み合わせるだけにする
 * ========================================================================== */

/* ============================== MODEL ==================================== */

/**
 * TopoJSON → 座標配列 へのデコーダー。
 *
 * TopoJSONは「弧(arc)」という線分の断片を複数の図形で使い回すことで
 * ファイルサイズを小さくしたフォーマットです（GeoJSONの数分の1になります）。
 * 座標も「差分(delta encoding)」＋「量子化(quantization)」で圧縮されているため、
 * 1) 差分を累積して元の整数座標に戻す
 * 2) transform（scale・translate）を掛けて実際の経度緯度に戻す
 * という2段階のデコードが必要です。
 *
 * ここでは同時に「どの弧を使っているか(arcSet)」も記録しておきます。
 * 2つの図形が同じ弧を共有していれば、その2つは地図上で隣り合っている
 * ―というシンプルな事実を、あとで隣接判定に利用します。
 */
function decodeTopology(topology, objectName) {
  const { arcs, transform } = topology;

  function decodeArc(rawIndex) {
    // TopoJSONの仕様: 負のインデックスは「反転された弧」を意味する。
    // ビット反転 (~i) で本来のインデックスに戻せる。
    const reversed = rawIndex < 0;
    const index = reversed ? ~rawIndex : rawIndex;
    let x = 0;
    let y = 0;
    const coords = arcs[index].map(([dx, dy]) => {
      x += dx;
      y += dy;
      return transform
        ? [
            x * transform.scale[0] + transform.translate[0],
            y * transform.scale[1] + transform.translate[1],
          ]
        : [x, y];
    });
    return reversed ? coords.slice().reverse() : coords;
  }

  // 複数の弧をつなげて1本の輪(リング)にする。
  // 「前の弧の終点」と「次の弧の始点」は同じ点になるので、2本目以降は
  // 先頭の点を1つ間引いて連結する。
  function arcsToRing(arcIndices) {
    const ring = [];
    arcIndices.forEach((arcIndex, i) => {
      const coords = decodeArc(arcIndex);
      ring.push(...(i === 0 ? coords : coords.slice(1)));
    });
    return ring;
  }

  const absIndex = (i) => (i < 0 ? ~i : i);

  function decodeGeometry(geom) {
    if (geom.type === "Polygon") {
      return {
        coordinates: geom.arcs.map(arcsToRing),
        arcSet: new Set(geom.arcs.flat().map(absIndex)),
      };
    }
    if (geom.type === "MultiPolygon") {
      return {
        coordinates: geom.arcs.map((poly) => poly.map(arcsToRing)),
        arcSet: new Set(geom.arcs.flat(2).map(absIndex)),
      };
    }
    return { coordinates: null, arcSet: new Set() };
  }

  const object = topology.objects[objectName];
  return object.geometries.map((geom, index) => {
    const { coordinates, arcSet } = decodeGeometry(geom);
    return {
      index,
      id: String(geom.id),
      properties: geom.properties || {},
      type: geom.type,
      coordinates,
      arcSet,
    };
  });
}

/**
 * 同じid（都道府県コードなど）を持つ複数の図形を1つの地域として合体させる。
 * 例: 東京都は「本土」と「伊豆・小笠原諸島」が別ジオメトリとして格納されている
 * ことがあり、そのままだと一覧に同じ県が2回出てしまう。ここでまとめて
 * 1つのMultiPolygonにし、隣接判定に使うarcSetも合体させる。
 */
function mergeById(features) {
  const map = new Map();
  for (const f of features) {
    const polygons = f.type === "MultiPolygon" ? f.coordinates : [f.coordinates];
    const existing = map.get(f.id);
    if (!existing) {
      map.set(f.id, { ...f, type: "MultiPolygon", coordinates: [...polygons], arcSet: new Set(f.arcSet) });
    } else {
      existing.coordinates.push(...polygons);
      for (const arc of f.arcSet) existing.arcSet.add(arc);
    }
  }
  return [...map.values()];
}

/** 隣接判定：弧(arc)を1本でも共有していれば「隣り合っている」とみなす。
 * 都道府県(47件)でも世界の国(約170件)でも O(n^2) で一瞬で終わる規模。
 * 戻り値: 各featureのindexに対応する「隣接するindexのSet」の配列。
 */
function computeAdjacency(features) {
  const neighbors = features.map(() => new Set());
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      let shared = false;
      for (const arc of features[i].arcSet) {
        if (features[j].arcSet.has(arc)) {
          shared = true;
          break;
        }
      }
      if (shared) {
        neighbors[i].add(j);
        neighbors[j].add(i);
      }
    }
  }
  return neighbors;
}

/**
 * 色の決定ロジック（貪欲彩色 + ランダム性）。
 * 「隣接する地域がすでに使っている色」を除いたパレットからランダムに選ぶ。
 * 万が一パレットの色を隣接地域が使い切っていたら（理論上ほぼ起きない）、
 * 全パレットから選び直す。
 */
const PALETTE = [
  "#FF6FA0", "#FFB84C", "#FFE066", "#8CE99A",
  "#63E6E8", "#74C0FC", "#B197FC", "#F783AC",
  "#FFA8A8", "#69DB7C", "#FFD43B", "#DA77F2",
];

function pickColor(neighborIndices, colorByIndex) {
  const used = new Set(
    [...neighborIndices].map((i) => colorByIndex[i]).filter(Boolean)
  );
  const available = PALETTE.filter((c) => !used.has(c));
  const pool = available.length > 0 ? available : PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** デコード済みfeatureの配列をGeoJSONのFeatureCollectionに変換（d3.geoPath用）。 */
function toFeatureCollection(features) {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: f.properties,
      geometry: { type: f.type, coordinates: f.coordinates },
    })),
  };
}

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
const SOURCES = {
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
async function fetchWithFallback(urls) {
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

/**
 * 永続化：ブラウザの localStorage を使う。
 * window.storage（Claudeのアーティファクト専用領域）と違い、GitHub Pagesなど
 * どこにデプロイしても動く。ただし欠点として、他の端末・他のブラウザとは
 * 同期されず、ブラウザのデータを消去すると記録も消える。
 */
function loadVisited(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveVisited(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("保存に失敗しました:", e);
  }
}

/**
 * データの書き出し／読み込み。
 * 「訪問済みの県・国＋メモ」を1つのJSONファイルとしてダウンロードし、
 * 別のブラウザ・別の端末でも同じファイルを読み込めば記録を引き継げる。
 * localStorageは端末ごとに独立しているため、この仕組みが「引っ越し用のかばん」になる。
 */
function buildBackupFile(visited) {
  const payload = {
    app: "travel-atlas",
    version: 1,
    exportedAt: new Date().toISOString(),
    visited,
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
function parseBackupFile(text) {
  const parsed = JSON.parse(text);
  const jp = parsed && parsed.visited && typeof parsed.visited.jp === "object" ? parsed.visited.jp : {};
  const world = parsed && parsed.visited && typeof parsed.visited.world === "object" ? parsed.visited.world : {};
  return { jp, world };
}

/* ============================== VIEW ====================================== */

function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.headerBlobA} />
      <div style={styles.headerBlobB} />
      <div style={styles.headerInner}>
        <span style={styles.headerBadge}>
          <MapPin size={22} color="#fff" />
        </span>
        <div>
          <h1 style={styles.title}>
            旅の記録アトラス <span style={{ fontSize: 20 }}>✨</span>
          </h1>
          <p style={styles.subtitle}>行った県・行った国を、あなただけのカラーで塗っていこう！</p>
        </div>
      </div>
    </header>
  );
}

/** データの書き出し・読み込みボタン。日本タブ／世界タブ両方のデータをまとめて1ファイルにする。 */
function DataToolbar({ onExport, onImportFile }) {
  const fileInputRef = useRef(null);
  return (
    <div style={styles.dataToolbar}>
      <span style={styles.dataToolbarLabel}>
        <Sparkles size={14} style={{ marginRight: 4 }} />
        きろくの引っ越し
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.pillButtonGhost} className="tm-pill-btn" onClick={onExport}>
          <Download size={14} style={{ marginRight: 6 }} />
          書き出す
        </button>
        <button style={styles.pillButtonGhost} className="tm-pill-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} style={{ marginRight: 6 }} />
          読み込む
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = ""; // 同じファイルを連続で選べるようにリセット
          }}
        />
      </div>
    </div>
  );
}

function TabBar({ tab, setTab, visitedCount }) {
  const tabs = [
    { key: "jp", label: "日本", icon: MapPin, count: visitedCount.jp },
    { key: "world", label: "世界", icon: Globe2, count: visitedCount.world },
  ];
  return (
    <div style={styles.tabBar}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="tm-tab"
            style={{ ...styles.tabButton, ...(active ? styles.tabButtonActive : {}) }}
          >
            <Icon size={16} />
            <span>{t.label}</span>
            <span style={styles.tabCount}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function LoadingPanel({ label }) {
  return (
    <div style={styles.panel}>
      <div style={styles.spinner} />
      <p style={styles.panelText}>{label}</p>
      <p style={styles.panelSubText}>初回だけ、外部の地図データを読み込みます</p>
    </div>
  );
}

function ErrorPanel({ message }) {
  return (
    <div style={styles.panel}>
      <AlertTriangle size={22} color="#B23A6E" />
      <p style={styles.panelText}>地図データを読み込めませんでした</p>
      <p style={styles.panelSubText}>{message}（ネットワーク接続を確認してください）</p>
    </div>
  );
}

function MapView({ kind, features, fc, visited, highlight, onToggle, projected, viewBox }) {
  const [width, height] = viewBox;

  // 投影(projection)はデータが変わったときだけ計算し直せば十分なのでメモ化する。
  // jpn-atlas（日本）はすでに850x680平面に投影済みのデータなので、
  // 二重に投影しないよう projection を渡さない（= 恒等変換で座標をそのまま使う）。
  // 世界地図はNatural Earth図法を使用。南極や高緯度地方の間延びが
  // Equal Earth図法より穏やかで、全体の見た目もやわらかい。
  const pathFor = useMemo(() => {
    const projection = projected
      ? null
      : d3.geoNaturalEarth1().fitSize([width, height], fc);
    const gen = d3.geoPath(projection);
    return (feature) =>
      gen({ type: "Feature", geometry: { type: feature.type, coordinates: feature.coordinates } });
  }, [fc, projected, width, height]);

  return (
    <div style={styles.mapWrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={styles.svg}
        role="img"
        aria-label={kind === "jp" ? "日本地図" : "世界地図"}
      >
        {/* 海。陸地と見分けがつく色で全面を塗ってから、その上に陸地を重ねる */}
        <defs>
          <linearGradient id="tm-sea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BEE3FF" />
            <stop offset="100%" stopColor="#DCD3FF" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="url(#tm-sea)" />
        {features.map((f) => {
          const d = pathFor(f);
          if (!d) return null;
          const entry = visited[f.id];
          const isHighlighted =
            highlight && highlight.trim().length > 0 && f.name.includes(highlight.trim());
          return (
            <path
              key={f.id}
              d={d}
              fill={entry ? entry.color : "#FFFBFE"}
              stroke={isHighlighted ? "#FF6FA0" : "#C9B8E8"}
              strokeWidth={isHighlighted ? 2.5 : 0.7}
              className="tm-region"
              onClick={() => onToggle(f)}
            >
              <title>{f.name}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={styles.searchBox}>
      <Search size={16} color="#5B6E6E" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.searchInput}
      />
    </div>
  );
}

function RegionList({ features, visited, search, onToggle, onNoteChange, headerLabel }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...features].sort((a, b) =>
      a.sortOrder != null && b.sortOrder != null
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name, "ja")
    );
    if (!q) return sorted;
    return sorted.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.subName || "").toLowerCase().includes(q)
    );
  }, [features, search]);

  const visitedCount = Object.keys(visited).length;

  return (
    <div style={styles.listWrap}>
      <div style={styles.listHeader}>
        <span>{headerLabel}</span>
        <span style={styles.listHeaderCount}>
          {visitedCount} / {features.length} 訪問済み
        </span>
      </div>
      <ul style={styles.list}>
        {filtered.map((f) => {
          const entry = visited[f.id];
          const checked = Boolean(entry);
          return (
            <li key={f.id} className="tm-listitem" style={styles.listItem}>
              <span
                onClick={() => onToggle(f)}
                className="tm-swatch"
                style={{
                  ...styles.swatch,
                  background: checked ? entry.color : "#fff",
                  borderColor: checked ? entry.color : "#E7D6EE",
                }}
              >
                {checked && <Check size={12} color="#fff" strokeWidth={3} />}
              </span>
              <span onClick={() => onToggle(f)} style={{ ...styles.listItemName, cursor: "pointer" }}>
                {f.name}
              </span>
              {f.subName ? <span style={styles.listItemSub}>{f.subName}</span> : null}
              {checked ? (
                <input
                  type="text"
                  defaultValue={entry.note || ""}
                  placeholder="メモ（例: 2023年の桜の時期に）"
                  style={styles.noteInput}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => onNoteChange(f, e.target.value)}
                />
              ) : (
                <span style={styles.noteHint}>訪問済みにするとメモを書けます</span>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li style={styles.emptyRow}>該当する{headerLabel}が見つかりません</li>
        )}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <p>
        日本地図データ: jpn-atlas（出典: 国土地理院「地球地図日本2016」）／
        世界地図データ: topojson/world-atlas（出典: Natural Earth, Public Domain）
      </p>
      <p>訪問記録はこのブラウザの localStorage に保存され、他の人やサーバーには送信されません（ブラウザやキャッシュを変えると引き継がれません）。「書き出す」でバックアップも作れます。💕</p>
    </footer>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap');
      * { box-sizing: border-box; }
      .tm-region { cursor: pointer; transition: fill 0.25s ease, stroke 0.15s ease, transform 0.15s ease; }
      .tm-region:hover { fill-opacity: 0.85; }
      .tm-listitem:hover { background: #FFF0F7; }
      .tm-swatch { cursor: pointer; transition: transform 0.15s ease; }
      .tm-swatch:hover { transform: scale(1.15) rotate(-6deg); }
      .tm-tab { transition: transform 0.15s ease, box-shadow 0.15s ease; }
      .tm-tab:hover { transform: translateY(-2px); }
      .tm-pill-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
      .tm-pill-btn:hover { transform: translateY(-2px) scale(1.03); }
      .tm-pill-btn:active { transform: translateY(0) scale(0.97); }
      input:focus, button:focus { outline: 3px solid #FFD6E8; outline-offset: 1px; }
      @keyframes tm-spin { to { transform: rotate(360deg); } }
      @keyframes tm-pop-in { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
  );
}

/* ============================== STYLES ===================================== */

const styles = {
  page: {
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
    background: "linear-gradient(160deg, #FFF0F7 0%, #F3EEFF 45%, #EAF6FF 100%)",
    color: "#4A2B5C",
    minHeight: "100%",
    padding: "0 0 40px",
  },
  header: { position: "relative", padding: "28px 20px 12px", overflow: "hidden" },
  headerBlobA: {
    position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: "50%",
    background: "radial-gradient(circle, #FFD6E8 0%, rgba(255,214,232,0) 70%)", pointerEvents: "none",
  },
  headerBlobB: {
    position: "absolute", top: 10, left: "40%", width: 120, height: 120, borderRadius: "50%",
    background: "radial-gradient(circle, #D8C7FF 0%, rgba(216,199,255,0) 70%)", pointerEvents: "none",
  },
  headerInner: { position: "relative", display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 900, margin: "0 auto" },
  headerBadge: {
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    width: 40, height: 40, borderRadius: "50%",
    background: "linear-gradient(135deg, #FF8FB7, #B18CFF)",
    boxShadow: "0 4px 12px rgba(255, 111, 160, 0.35)",
  },
  title: { fontFamily: "'Mochiy Pop One', sans-serif", fontWeight: 400, fontSize: 26, margin: 0, color: "#FF3D8A" },
  subtitle: { margin: "6px 0 0", fontSize: 13.5, color: "#7A5C94", fontWeight: 700 },
  tabBar: {
    display: "flex", gap: 10, maxWidth: 900, margin: "18px auto 0", padding: "0 20px",
  },
  tabButton: {
    display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
    borderRadius: 999, border: "2px solid #FFD6E8", background: "#fff",
    color: "#B189D6", cursor: "pointer", fontSize: 14.5, fontWeight: 800,
    boxShadow: "0 3px 0 #FFD6E8",
  },
  tabButtonActive: {
    background: "linear-gradient(135deg, #FF8FB7, #B18CFF)", color: "#fff", borderColor: "transparent",
    boxShadow: "0 4px 14px rgba(177, 140, 255, 0.45)",
  },
  tabCount: {
    fontSize: 11.5, padding: "1px 8px", borderRadius: 999,
    background: "rgba(255,255,255,0.35)",
  },
  dataToolbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
    maxWidth: 900, margin: "14px auto 0", padding: "10px 18px",
    background: "#fff", borderRadius: 999, border: "2px dashed #E4C9F5",
  },
  dataToolbarLabel: { display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 800, color: "#B189D6" },
  pillButtonGhost: {
    display: "flex", alignItems: "center", padding: "7px 14px", borderRadius: 999,
    border: "2px solid #FFD6E8", background: "#FFF7FB", color: "#FF3D8A", fontSize: 12.5, fontWeight: 800,
    cursor: "pointer",
  },
  main: { maxWidth: 900, margin: "18px auto 0", padding: "0 20px", display: "flex", flexDirection: "column", gap: 16 },
  panel: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 8, background: "#fff", borderRadius: 24, padding: "48px 20px",
    border: "2px solid #FFE3F0", boxShadow: "0 8px 24px rgba(255, 143, 183, 0.15)",
  },
  panelText: { fontWeight: 800, margin: 0 },
  panelSubText: { fontSize: 12.5, color: "#9C7FB8", margin: 0, textAlign: "center" },
  spinner: {
    width: 28, height: 28, borderRadius: "50%",
    border: "4px solid #FFE3F0", borderTopColor: "#FF6FA0",
    animation: "tm-spin 0.8s linear infinite",
  },
  mapWrap: {
    background: "#fff", borderRadius: 24, border: "2px solid #FFE3F0", padding: 10, overflow: "hidden",
    boxShadow: "0 10px 28px rgba(177, 140, 255, 0.18)",
  },
  svg: { width: "100%", height: "auto", display: "block", borderRadius: 16 },
  toolRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  searchBox: {
    flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 8,
    background: "#fff", border: "2px solid #FFD6E8", borderRadius: 999, padding: "10px 16px",
  },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 14, background: "transparent", color: "#4A2B5C", fontWeight: 600 },
  resetButton: {
    display: "flex", alignItems: "center", padding: "10px 16px", borderRadius: 999,
    border: "2px solid #FFD6E8", background: "#fff", color: "#FF3D8A", fontSize: 13.5, fontWeight: 800, cursor: "pointer",
  },
  listWrap: { background: "#fff", borderRadius: 24, border: "2px solid #FFE3F0", overflow: "hidden", boxShadow: "0 10px 28px rgba(177, 140, 255, 0.15)" },
  listHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 18px", borderBottom: "2px solid #FFE3F0", fontWeight: 800, color: "#FF3D8A",
    background: "linear-gradient(90deg, #FFF0F7, #F3EEFF)",
  },
  listHeaderCount: { fontSize: 12, fontWeight: 700, color: "#B189D6" },
  list: { listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" },
  listItem: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
    borderBottom: "1px solid #FCEEF6", fontSize: 14, flexWrap: "wrap",
  },
  swatch: {
    width: 22, height: 22, borderRadius: "50%", border: "2px solid #E7D6EE",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  listItemName: { flex: "0 0 auto", fontWeight: 700 },
  listItemSub: { fontSize: 12, color: "#B189D6" },
  noteInput: {
    flex: 1, minWidth: 0, border: "1px solid transparent", borderRadius: 999,
    padding: "6px 12px", fontSize: 12.5, color: "#7A5C94", background: "#FFF0F7", fontWeight: 600,
  },
  noteHint: { flex: 1, minWidth: 0, fontSize: 12, color: "#D9C6E8", fontStyle: "italic" },
  emptyRow: { padding: "16px", fontSize: 13, color: "#B189D6", textAlign: "center" },
  toast: {
    position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #FF8FB7, #B18CFF)", color: "#fff",
    padding: "10px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13.5,
    boxShadow: "0 8px 24px rgba(177, 140, 255, 0.4)", animation: "tm-pop-in 0.2s ease", zIndex: 50,
  },
  footer: {
    maxWidth: 900, margin: "22px auto 0", padding: "0 20px", fontSize: 11.5,
    color: "#B189D6", lineHeight: 1.7, fontWeight: 600,
  },
};

/* ============================== CONTROLLER ================================= */

export default function App() {
  const [tab, setTab] = useState("jp");
  const [search, setSearch] = useState({ jp: "", world: "" });
  const [visited, setVisited] = useState({ jp: {}, world: {} });
  const [mapState, setMapState] = useState({
    jp: { status: "idle" },
    world: { status: "idle" },
  });
  // MODELから取ってきた地図データはReactのstateではなくrefにキャッシュする。
  // (座標の配列は巨大で、再レンダリングのたびに比較する必要がないため)
  const dataCache = useRef({});

  // 保存済みの訪問記録を最初に一度だけ読み込む
  useEffect(() => {
    setVisited({
      jp: loadVisited("visited-jp-v1"),
      world: loadVisited("visited-world-v1"),
    });
  }, []);

  // タブを開いたときに、まだ読み込んでいなければ地図データを取得する（遅延読み込み）
  useEffect(() => {
    if (dataCache.current[tab]) return;
    let cancelled = false;
    setMapState((s) => ({ ...s, [tab]: { status: "loading" } }));

    (async () => {
      try {
        const src = SOURCES[tab];
        const topology = await fetchWithFallback(src.urls);

        const rawFeatures = decodeTopology(topology, src.objectName);
        const valid = rawFeatures.filter((f) => f.coordinates && src.isValid(f.id, f.properties));
        const merged = mergeById(valid);
        // フィルタや合体で並び順・件数が変わるため、indexはここで振り直す。
        // （隣接判定はこのindexを使って配列を参照するため、ズレると誤動作する）
        const features = merged.map((f, i) => ({
          ...f,
          index: i,
          name: src.getName(f.properties, f.id),
          subName: src.getSubName(f.properties, f.id),
          sortOrder: src.sortOrder ? src.sortOrder(f.properties, f.id) : null,
        }));
        const neighbors = computeAdjacency(features);
        const fc = toFeatureCollection(features);

        if (cancelled) return;
        dataCache.current[tab] = {
          features,
          neighbors,
          fc,
          projected: src.projected,
          viewBox: src.viewBox,
        };
        setMapState((s) => ({ ...s, [tab]: { status: "ready" } }));
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setMapState((s) => ({
          ...s,
          [tab]: { status: "error", message: String(err && err.message ? err.message : err) },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab]);

  // チェックのON/OFF切り替え = 色を塗る/消す（メモも一緒に消える）
  const toggleVisited = useCallback((tabKey, feature) => {
    setVisited((prev) => {
      const current = { ...prev[tabKey] };
      if (current[feature.id]) {
        delete current[feature.id];
      } else {
        const data = dataCache.current[tabKey];
        const neighborIdx = data.neighbors[feature.index];
        const colorByIndex = data.features.map((f) => current[f.id]?.color);
        current[feature.id] = { color: pickColor(neighborIdx, colorByIndex), note: "" };
      }
      saveVisited(tabKey === "jp" ? "visited-jp-v1" : "visited-world-v1", current);
      return { ...prev, [tabKey]: current };
    });
  }, []);

  // メモだけを更新する（色・チェック状態はそのまま）
  const updateNote = useCallback((tabKey, feature, note) => {
    setVisited((prev) => {
      if (!prev[tabKey][feature.id]) return prev; // 未訪問なら何もしない
      const current = {
        ...prev[tabKey],
        [feature.id]: { ...prev[tabKey][feature.id], note },
      };
      saveVisited(tabKey === "jp" ? "visited-jp-v1" : "visited-world-v1", current);
      return { ...prev, [tabKey]: current };
    });
  }, []);

  const resetTab = useCallback((tabKey) => {
    setVisited((prev) => {
      saveVisited(tabKey === "jp" ? "visited-jp-v1" : "visited-world-v1", {});
      return { ...prev, [tabKey]: {} };
    });
  }, []);

  // 小さな通知（トースト）。2.5秒で自動的に消える。
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2500);
  }, []);

  // 日本＋世界のデータをまとめて1つのJSONファイルとして書き出す
  const handleExport = useCallback(() => {
    buildBackupFile(visited);
    showToast("バックアップを書き出したよ 🎁");
  }, [visited, showToast]);

  // 書き出したJSONファイルを読み込んで、記録を丸ごと上書きする
  const handleImportFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { jp, world } = parseBackupFile(String(e.target.result));
          setVisited({ jp, world });
          saveVisited("visited-jp-v1", jp);
          saveVisited("visited-world-v1", world);
          showToast("きろくを読み込んだよ 🌈");
        } catch {
          showToast("読み込めなかったよ…ファイルを確認してね 🙏");
        }
      };
      reader.readAsText(file);
    },
    [showToast]
  );

  const currentData = dataCache.current[tab];
  const currentStatus = mapState[tab].status;
  const currentVisited = visited[tab];

  return (
    <div style={styles.page}>
      <GlobalStyle />
      <Header />
      <TabBar
        tab={tab}
        setTab={setTab}
        visitedCount={{ jp: Object.keys(visited.jp).length, world: Object.keys(visited.world).length }}
      />
      <DataToolbar onExport={handleExport} onImportFile={handleImportFile} />

      <main style={styles.main}>
        {currentStatus === "loading" && (
          <LoadingPanel label={tab === "jp" ? "日本地図を読み込み中…" : "世界地図を読み込み中…"} />
        )}
        {currentStatus === "error" && <ErrorPanel message={mapState[tab].message} />}

        {currentStatus === "ready" && currentData && (
          <>
            <MapView
              kind={tab}
              features={currentData.features}
              fc={currentData.fc}
              projected={currentData.projected}
              viewBox={currentData.viewBox}
              visited={currentVisited}
              highlight={search[tab]}
              onToggle={(f) => toggleVisited(tab, f)}
            />

            <div style={styles.toolRow}>
              <SearchBox
                value={search[tab]}
                onChange={(v) => setSearch((s) => ({ ...s, [tab]: v }))}
                placeholder={tab === "jp" ? "県名で検索（例: 京都）" : "国名で検索（例: France）"}
              />
              <button style={styles.resetButton} className="tm-pill-btn" onClick={() => resetTab(tab)}>
                <RotateCcw size={14} style={{ marginRight: 6 }} />
                塗りをリセット
              </button>
            </div>

            <RegionList
              features={currentData.features}
              visited={currentVisited}
              search={search[tab]}
              onToggle={(f) => toggleVisited(tab, f)}
              onNoteChange={(f, note) => updateNote(tab, f, note)}
              headerLabel={tab === "jp" ? "県名" : "国名"}
            />
          </>
        )}
      </main>

      <Footer />
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
