/** アプリ全体で使う見た目の定義（色・余白・角丸など）を1か所にまとめたもの。 */
export const styles = {
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
  filterTabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterTabButton: {
    display: "flex", alignItems: "center", padding: "8px 14px", borderRadius: 999,
    border: "2px solid #FFD6E8", background: "#fff", color: "#B189D6",
    fontSize: 12.5, fontWeight: 800, cursor: "pointer",
  },
  filterTabButtonActive: {
    background: "linear-gradient(135deg, #FF8FB7, #B18CFF)", color: "#fff", borderColor: "transparent",
  },
  filterTabCount: {
    marginLeft: 6, fontSize: 11, padding: "0 7px", borderRadius: 999,
    background: "rgba(255,255,255,0.4)",
  },
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
  starButton: {
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    width: 26, height: 26, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer",
  },
  plannedBadge: {
    fontSize: 11, fontWeight: 800, color: "#B8760A", background: "#FFF3D6",
    padding: "2px 8px", borderRadius: 999,
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
