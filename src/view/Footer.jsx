import { styles } from "../styles.js";

export function Footer() {
  return (
    <footer style={styles.footer}>
      <p>
        日本地図データ: jpn-atlas（出典: 国土地理院「地球地図日本2016」）／
        世界地図データ: topojson/world-atlas（出典: Natural Earth, Public Domain）
      </p>
      <p>訪問記録はこのブラウザの localStorage に保存され、他の人やサーバーには送信されません（ブラウザやキャッシュを変えると引き継がれません）。「書き出す」でバックアップも作れます。📥</p>
    </footer>
  );
}
