import { useMemo } from "react";
import { Check, Star } from "lucide-react";
import { styles } from "../styles.js";

export function RegionList({
  features,
  visited,
  planned,
  search,
  filterMode,
  onToggle,
  onTogglePlanned,
  onNoteChange,
  onPlannedNoteChange,
  headerLabel,
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...features].sort((a, b) =>
      a.sortOrder != null && b.sortOrder != null
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name, "ja")
    );
    const byFilter = sorted.filter((f) => {
      if (filterMode === "visited") return Boolean(visited[f.id]);
      if (filterMode === "planned") return !visited[f.id] && Boolean(planned[f.id]);
      if (filterMode === "unvisited") return !visited[f.id];
      return true;
    });
    if (!q) return byFilter;
    return byFilter.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.subName || "").toLowerCase().includes(q)
    );
  }, [features, search, filterMode, visited, planned]);

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
          const plannedEntry = planned[f.id];
          const isPlanned = !checked && Boolean(plannedEntry);
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
              <button
                type="button"
                className="tm-star-btn"
                onClick={() => onTogglePlanned(f)}
                disabled={checked}
                title={checked ? "訪問済みです" : isPlanned ? "行く予定を解除" : "行く予定にする"}
                style={{
                  ...styles.starButton,
                  opacity: checked ? 0.25 : 1,
                  color: isPlanned ? "#FFB020" : "#D9C6E8",
                }}
              >
                <Star size={16} fill={isPlanned ? "#FFB020" : "none"} strokeWidth={2} />
              </button>
              <span onClick={() => onToggle(f)} style={{ ...styles.listItemName, cursor: "pointer" }}>
                {f.name}
              </span>
              {f.subName ? <span style={styles.listItemSub}>{f.subName}</span> : null}
              {isPlanned && <span style={styles.plannedBadge}>行く予定</span>}
              {checked ? (
                <input
                  type="text"
                  defaultValue={entry.note || ""}
                  placeholder="メモ（例: 2023年の桜の時期に）"
                  style={styles.noteInput}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => onNoteChange(f, e.target.value)}
                />
              ) : isPlanned ? (
                <input
                  type="text"
                  defaultValue={plannedEntry.note || ""}
                  placeholder="メモ（例: 桜の季節に行きたい）"
                  style={{ ...styles.noteInput, background: "#FFF6DD", color: "#8A6A16" }}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => onPlannedNoteChange(f, e.target.value)}
                />
              ) : (
                <span style={styles.noteHint}>☆ をつけるとメモを書けます</span>
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
