/** フォントの読み込みとホバーアニメーションなど、ページ全体に効くCSS。 */
export function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap');
      * { box-sizing: border-box; }
      .tm-region { cursor: pointer; transition: fill 0.25s ease, stroke 0.15s ease, transform 0.15s ease; }
      .tm-region:hover { fill-opacity: 0.85; }
      .tm-listitem:hover { background: #FFF0F7; }
      .tm-swatch { cursor: pointer; transition: transform 0.15s ease; }
      .tm-swatch:hover { transform: scale(1.15) rotate(-6deg); }
      .tm-star-btn:not(:disabled) { transition: transform 0.15s ease; }
      .tm-star-btn:not(:disabled):hover { transform: scale(1.2) rotate(10deg); }
      .tm-star-btn:disabled { cursor: not-allowed; }
      .tm-tab { transition: transform 0.15s ease, box-shadow 0.15s ease; }
      .tm-tab:hover { transform: translateY(-2px); }
      .tm-pill-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
      .tm-pill-btn:hover { transform: translateY(-2px) scale(1.03); }
      .tm-pill-btn:active { transform: translateY(0) scale(0.97); }
      input:focus, button:focus { outline: 3px solid #FFD6E8; outline-offset: 1px; }
      @keyframes tm-spin { to { transform: rotate(360deg); } }
      @keyframes tm-pop-in { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
  );
}
