import { Search } from "lucide-react";
import { styles } from "../styles.js";

export function SearchBox({ value, onChange, placeholder }) {
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
