import { useMemo } from "react";
import * as d3 from "d3";
import { styles } from "../styles.js";

export function MapView({ kind, features, fc, visited, planned, highlight, onToggle, projected, viewBox }) {
  const [width, height] = viewBox;

  // 投影(projection)はデータが変わったときだけ計算し直せば十分なのでメモ化する。
  // jpn-atlas（日本）はすでに850x680平面に投影済みのデータなので、
  // 二重に投影しないよう projection を渡さない（= 恒等変換で座標をそのまま使う）。
  // 世界地図はNatural Earth図法を使用。南極や高緯度地方の間延びが
  // Equal Earth図法より穏やかで、全体の見た目もやわらかい。
  const { pathFor, centroidFor } = useMemo(() => {
    const projection = projected
      ? null
      : d3.geoNaturalEarth1().fitSize([width, height], fc);
    const gen = d3.geoPath(projection);
    const toGeom = (feature) => ({ type: "Feature", geometry: { type: feature.type, coordinates: feature.coordinates } });
    return {
      pathFor: (feature) => gen(toGeom(feature)),
      centroidFor: (feature) => gen.centroid(toGeom(feature)),
    };
  }, [fc, projected, width, height]);

  return (
    <div style={styles.mapWrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={styles.svg}
        role="img"
        aria-label={kind === "jp" ? "日本地図" : "世界地図"}
      >
        {/* 海。陸地と見分けがつく色で全面を塗ってから、その上に陸地を重ねる */}
        <defs>
          <linearGradient id="tm-sea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BEE3FF" />
            <stop offset="100%" stopColor="#DCD3FF" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="url(#tm-sea)" />
        {features.map((f) => {
          const d = pathFor(f);
          if (!d) return null;
          const entry = visited[f.id];
          const isPlanned = !entry && Boolean(planned[f.id]);
          const isHighlighted =
            highlight && highlight.trim().length > 0 && f.name.includes(highlight.trim());
          return (
            <path
              key={f.id}
              d={d}
              fill={entry ? entry.color : isPlanned ? "#FFF6DD" : "#FFFBFE"}
              stroke={isHighlighted ? "#FF6FA0" : isPlanned ? "#FFB020" : "#C9B8E8"}
              strokeWidth={isHighlighted ? 2.5 : isPlanned ? 1.6 : 0.7}
              strokeDasharray={isPlanned ? "4 2" : undefined}
              className="tm-region"
              onClick={() => onToggle(f)}
            >
              <title>{f.name}{isPlanned ? "（行く予定）" : ""}</title>
            </path>
          );
        })}
        {/* 「行く予定」の場所には、図形の重心に⭐マークを立てる */}
        {features.map((f) => {
          const entry = visited[f.id];
          if (entry || !planned[f.id]) return null;
          const [cx, cy] = centroidFor(f);
          if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
          return (
            <text
              key={`star-${f.id}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={kind === "jp" ? 13 : 11}
              style={{ pointerEvents: "none" }}
            >
              ⭐
            </text>
          );
        })}
      </svg>
    </div>
  );
}
