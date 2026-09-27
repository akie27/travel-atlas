/**
 * TopoJSON → 座標配列 へのデコーダー。
 *
 * TopoJSONは「弧(arc)」という線分の断片を複数の図形で使い回すことで
 * ファイルサイズを小さくしたフォーマットです（GeoJSONの数分の1になります）。
 * 座標も「差分(delta encoding)」＋「量子化(quantization)」で圧縮されているため、
 * 1) 差分を累積して元の整数座標に戻す
 * 2) transform（scale・translate）を掛けて実際の経度緯度に戻す
 * という2段階のデコードが必要です。
 *
 * ここでは同時に「どの弧を使っているか(arcSet)」も記録しておきます。
 * 2つの図形が同じ弧を共有していれば、その2つは地図上で隣り合っている
 * ―というシンプルな事実を、あとで隣接判定に利用します。
 */
export function decodeTopology(topology, objectName) {
  const { arcs, transform } = topology;

  function decodeArc(rawIndex) {
    // TopoJSONの仕様: 負のインデックスは「反転された弧」を意味する。
    // ビット反転 (~i) で本来のインデックスに戻せる。
    const reversed = rawIndex < 0;
    const index = reversed ? ~rawIndex : rawIndex;
    let x = 0;
    let y = 0;
    const coords = arcs[index].map(([dx, dy]) => {
      x += dx;
      y += dy;
      return transform
        ? [
            x * transform.scale[0] + transform.translate[0],
            y * transform.scale[1] + transform.translate[1],
          ]
        : [x, y];
    });
    return reversed ? coords.slice().reverse() : coords;
  }

  // 複数の弧をつなげて1本の輪(リング)にする。
  // 「前の弧の終点」と「次の弧の始点」は同じ点になるので、2本目以降は
  // 先頭の点を1つ間引いて連結する。
  function arcsToRing(arcIndices) {
    const ring = [];
    arcIndices.forEach((arcIndex, i) => {
      const coords = decodeArc(arcIndex);
      ring.push(...(i === 0 ? coords : coords.slice(1)));
    });
    return ring;
  }

  const absIndex = (i) => (i < 0 ? ~i : i);

  function decodeGeometry(geom) {
    if (geom.type === "Polygon") {
      return {
        coordinates: geom.arcs.map(arcsToRing),
        arcSet: new Set(geom.arcs.flat().map(absIndex)),
      };
    }
    if (geom.type === "MultiPolygon") {
      return {
        coordinates: geom.arcs.map((poly) => poly.map(arcsToRing)),
        arcSet: new Set(geom.arcs.flat(2).map(absIndex)),
      };
    }
    return { coordinates: null, arcSet: new Set() };
  }

  const object = topology.objects[objectName];
  return object.geometries.map((geom, index) => {
    const { coordinates, arcSet } = decodeGeometry(geom);
    return {
      index,
      id: String(geom.id),
      properties: geom.properties || {},
      type: geom.type,
      coordinates,
      arcSet,
    };
  });
}

/**
 * 同じid（都道府県コードなど）を持つ複数の図形を1つの地域として合体させる。
 * 例: 東京都は「本土」と「伊豆・小笠原諸島」が別ジオメトリとして格納されている
 * ことがあり、そのままだと一覧に同じ県が2回出てしまう。ここでまとめて
 * 1つのMultiPolygonにし、隣接判定に使うarcSetも合体させる。
 */
export function mergeById(features) {
  const map = new Map();
  for (const f of features) {
    const polygons = f.type === "MultiPolygon" ? f.coordinates : [f.coordinates];
    const existing = map.get(f.id);
    if (!existing) {
      map.set(f.id, { ...f, type: "MultiPolygon", coordinates: [...polygons], arcSet: new Set(f.arcSet) });
    } else {
      existing.coordinates.push(...polygons);
      for (const arc of f.arcSet) existing.arcSet.add(arc);
    }
  }
  return [...map.values()];
}

/**
 * 隣接判定：弧(arc)を1本でも共有していれば「隣り合っている」とみなす。
 * 都道府県(47件)でも世界の国(約170件)でも O(n^2) で一瞬で終わる規模。
 * 戻り値: 各featureのindexに対応する「隣接するindexのSet」の配列。
 */
export function computeAdjacency(features) {
  const neighbors = features.map(() => new Set());
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      let shared = false;
      for (const arc of features[i].arcSet) {
        if (features[j].arcSet.has(arc)) {
          shared = true;
          break;
        }
      }
      if (shared) {
        neighbors[i].add(j);
        neighbors[j].add(i);
      }
    }
  }
  return neighbors;
}

/** デコード済みfeatureの配列をGeoJSONのFeatureCollectionに変換（d3.geoPath用）。 */
export function toFeatureCollection(features) {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: f.properties,
      geometry: { type: f.type, coordinates: f.coordinates },
    })),
  };
}
