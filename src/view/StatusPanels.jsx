import { AlertTriangle } from "lucide-react";
import { styles } from "../styles.js";

export function LoadingPanel({ label }) {
  return (
    <div style={styles.panel}>
      <div style={styles.spinner} />
      <p style={styles.panelText}>{label}</p>
      <p style={styles.panelSubText}>初回だけ、外部の地図データを読み込みます</p>
    </div>
  );
}

export function ErrorPanel({ message }) {
  return (
    <div style={styles.panel}>
      <AlertTriangle size={22} color="#B23A6E" />
      <p style={styles.panelText}>地図データを読み込めませんでした</p>
      <p style={styles.panelSubText}>{message}（ネットワーク接続を確認してください）</p>
    </div>
  );
}
