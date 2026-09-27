import { MapPin } from "lucide-react";
import { styles } from "../styles.js";

export function Header() {
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
