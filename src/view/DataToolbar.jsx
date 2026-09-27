import { useRef } from "react";
import { Download, Upload, Sparkles } from "lucide-react";
import { styles } from "../styles.js";

/** データの書き出し・読み込みボタン。日本タブ／世界タブ両方のデータをまとめて1ファイルにする。 */
export function DataToolbar({ onExport, onImportFile }) {
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
