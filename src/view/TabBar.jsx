import { MapPin, Globe2 } from "lucide-react";
import { styles } from "../styles.js";

export function TabBar({ tab, setTab, visitedCount }) {
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
