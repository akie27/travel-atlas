import { useState, useEffect, useCallback, useRef } from "react";
import { RotateCcw } from "lucide-react";

// MODEL（データとロジック。Reactを知らない純粋な関数の集まり）
import { decodeTopology, mergeById, computeAdjacency, toFeatureCollection } from "./model/geoTopology.js";
import { pickColor } from "./model/color.js";
import { loadVisited, saveVisited, buildBackupFile, parseBackupFile } from "./model/storage.js";
import { SOURCES, fetchWithFallback } from "./model/sources.js";

// VIEW（見た目だけを担当する部品）
import { GlobalStyle } from "./view/GlobalStyle.jsx";
import { Header } from "./view/Header.jsx";
import { TabBar } from "./view/TabBar.jsx";
import { DataToolbar } from "./view/DataToolbar.jsx";
import { LoadingPanel, ErrorPanel } from "./view/StatusPanels.jsx";
import { MapView } from "./view/MapView.jsx";
import { SearchBox } from "./view/SearchBox.jsx";
import { FilterTabs } from "./view/FilterTabs.jsx";
import { RegionList } from "./view/RegionList.jsx";
import { Footer } from "./view/Footer.jsx";

import { styles } from "./styles.js";

/* ============================== CONTROLLER =================================
 * <App> はMODELの関数を呼び出し、その結果をstateとして持ち、VIEWに配るだけの
 * 「橋渡し役」です。地図の描き方や色の決め方といったロジックの中身は、
 * すべて ./model/ 以下のファイルに置いてあります。
 * ========================================================================== */

export default function App() {
  const [tab, setTab] = useState("jp");
  const [search, setSearch] = useState({ jp: "", world: "" });
  const [filterMode, setFilterMode] = useState({ jp: "all", world: "all" });
  const [visited, setVisited] = useState({ jp: {}, world: {} });
  const [planned, setPlanned] = useState({ jp: {}, world: {} });
  const [mapState, setMapState] = useState({
    jp: { status: "idle" },
    world: { status: "idle" },
  });
  // MODELから取ってきた地図データはReactのstateではなくrefにキャッシュする。
  // (座標の配列は巨大で、再レンダリングのたびに比較する必要がないため)
  const dataCache = useRef({});
  // toggleVisitedの中で「今この瞬間のplanned」を読みたいので、
  // stateと同じ内容をrefにも複製しておく（stateは非同期更新のため）。
  const plannedRef = useRef(planned);
  useEffect(() => {
    plannedRef.current = planned;
  }, [planned]);

  // 保存済みの訪問記録・行く予定リストを最初に一度だけ読み込む
  useEffect(() => {
    setVisited({
      jp: loadVisited("visited-jp-v1"),
      world: loadVisited("visited-world-v1"),
    });
    setPlanned({
      jp: loadVisited("planned-jp-v1"),
      world: loadVisited("planned-world-v1"),
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
      const becomingVisited = !current[feature.id];
      if (current[feature.id]) {
        delete current[feature.id];
      } else {
        const data = dataCache.current[tabKey];
        const neighborIdx = data.neighbors[feature.index];
        const colorByIndex = data.features.map((f) => current[f.id]?.color);
        // 「行く予定」だったときのメモがあれば、そのまま引き継ぐ
        const carriedNote = plannedRef.current[tabKey]?.[feature.id]?.note || "";
        current[feature.id] = { color: pickColor(neighborIdx, colorByIndex), note: carriedNote };
      }
      saveVisited(tabKey === "jp" ? "visited-jp-v1" : "visited-world-v1", current);

      // 訪問済みになった場所は「行く予定」から自動的に外す（もう予定ではなく実績なので）
      if (becomingVisited) {
        setPlanned((prevPlanned) => {
          if (!prevPlanned[tabKey][feature.id]) return prevPlanned;
          const nextPlanned = { ...prevPlanned[tabKey] };
          delete nextPlanned[feature.id];
          saveVisited(tabKey === "jp" ? "planned-jp-v1" : "planned-world-v1", nextPlanned);
          return { ...prevPlanned, [tabKey]: nextPlanned };
        });
      }

      return { ...prev, [tabKey]: current };
    });
  }, []);

  // 「行く予定」のON/OFF切り替え。訪問済みの場所には使わない。
  const togglePlanned = useCallback((tabKey, feature) => {
    setPlanned((prev) => {
      const current = { ...prev[tabKey] };
      if (current[feature.id]) {
        delete current[feature.id];
      } else {
        current[feature.id] = { note: "" };
      }
      saveVisited(tabKey === "jp" ? "planned-jp-v1" : "planned-world-v1", current);
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

  // 「行く予定」側のメモだけを更新する
  const updatePlannedNote = useCallback((tabKey, feature, note) => {
    setPlanned((prev) => {
      if (!prev[tabKey][feature.id]) return prev; // 予定になければ何もしない
      const current = {
        ...prev[tabKey],
        [feature.id]: { ...prev[tabKey][feature.id], note },
      };
      saveVisited(tabKey === "jp" ? "planned-jp-v1" : "planned-world-v1", current);
      return { ...prev, [tabKey]: current };
    });
  }, []);

  const resetTab = useCallback((tabKey) => {
    setVisited((prev) => {
      saveVisited(tabKey === "jp" ? "visited-jp-v1" : "visited-world-v1", {});
      return { ...prev, [tabKey]: {} };
    });
    setPlanned((prev) => {
      saveVisited(tabKey === "jp" ? "planned-jp-v1" : "planned-world-v1", {});
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
    buildBackupFile(visited, planned);
    showToast("バックアップを書き出したよ 🎁");
  }, [visited, planned, showToast]);

  // 書き出したJSONファイルを読み込んで、記録を丸ごと上書きする
  const handleImportFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { jp, world, plannedJp, plannedWorld } = parseBackupFile(String(e.target.result));
          setVisited({ jp, world });
          setPlanned({ jp: plannedJp, world: plannedWorld });
          saveVisited("visited-jp-v1", jp);
          saveVisited("visited-world-v1", world);
          saveVisited("planned-jp-v1", plannedJp);
          saveVisited("planned-world-v1", plannedWorld);
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
  const currentPlanned = planned[tab];

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
              planned={currentPlanned}
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

            <FilterTabs
              value={filterMode[tab]}
              onChange={(mode) => setFilterMode((s) => ({ ...s, [tab]: mode }))}
              visitedCount={Object.keys(currentVisited).length}
              plannedCount={Object.keys(currentPlanned).length}
              unvisitedCount={currentData.features.length - Object.keys(currentVisited).length}
            />

            <RegionList
              features={currentData.features}
              visited={currentVisited}
              planned={currentPlanned}
              search={search[tab]}
              filterMode={filterMode[tab]}
              onToggle={(f) => toggleVisited(tab, f)}
              onTogglePlanned={(f) => togglePlanned(tab, f)}
              onNoteChange={(f, note) => updateNote(tab, f, note)}
              onPlannedNoteChange={(f, note) => updatePlannedNote(tab, f, note)}
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
