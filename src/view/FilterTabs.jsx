import { styles } from "../styles.js";

/** 「すべて／行った／予定／まだ」の切り替えフィルター。 */
export function FilterTabs({ value, onChange, visitedCount, plannedCount, unvisitedCount }) {
  const options = [
    { key: "all", label: "すべて", emoji: "🗺️" },
    { key: "visited", label: "行った", emoji: "✅", count: visitedCount },
    { key: "planned", label: "予定", emoji: "⭐", count: plannedCount },
    { key: "unvisited", label: "まだ", emoji: "🤍", count: unvisitedCount },
  ];
  return (
    <div style={styles.filterTabs}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            className="tm-pill-btn"
            onClick={() => onChange(opt.key)}
            style={{ ...styles.filterTabButton, ...(active ? styles.filterTabButtonActive : {}) }}
          >
            <span style={{ marginRight: 5 }}>{opt.emoji}</span>
            {opt.label}
            {opt.count != null && <span style={styles.filterTabCount}>{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
