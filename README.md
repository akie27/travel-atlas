# 旅の記録アトラス ✨

行った都道府県・行った国を、地図上でランダムなカラーに塗って記録していくWebアプリです。
Reactの学習（MVCに寄せた構成）を目的に作りました。

**デモ**: `npm run build` 後、GitHub Pagesで公開できます（下記手順参照）。

## できること

- 日本タブ：都道府県境入りの地図をクリック、または一覧のチェックで色を塗る
- 世界タブ：国境入りの世界地図で同じことができる
- 隣り合う都道府県・国とは異なる色を自動選択（貪欲彩色アルゴリズム）
- 訪問済みの場所にメモを残せる
- 県名・国名で検索
- 記録はブラウザの `localStorage` に自動保存（サーバー送信なし）
- 記録をJSONファイルとして書き出し／読み込み（機種変更・共有用）

## 使用技術

- React + Vite
- [d3](https://d3js.org/)（`d3-geo`, `d3-geo-path`）— TopoJSONの座標を地図として描画
- [lucide-react](https://lucide.dev/) — アイコン

## 構成（MVCの考え方）

`src/App.jsx` の中を、コメントで3つの層に区切っています。

| 層 | 役割 | 主な中身 |
|---|---|---|
| MODEL | データとロジック（Reactを知らない） | `decodeTopology`, `computeAdjacency`, `pickColor`, `mergeById`, `loadVisited`/`saveVisited`, `buildBackupFile`/`parseBackupFile` |
| VIEW | 見た目だけの部品 | `TabBar`, `MapView`, `RegionList`, `SearchBox`, `DataToolbar` |
| CONTROLLER | 状態管理と橋渡し | `App`（state・データ取得・イベントハンドラ） |

本格的なプロジェクトにする場合は、`model/`・`view/`・`App.jsx` のようにファイルを分割するのがおすすめです。

## ローカルで動かす

```bash
npm install
npm run dev
```

## GitHub Pagesへのデプロイ手順

1. **`vite.config.js` の `base` を自分のリポジトリ名に書き換える**
   ```js
   base: "/あなたのリポジトリ名/",
   ```
   （`https://ユーザー名.github.io/` という「ユーザーサイト」用リポジトリの場合は `base: "/"` のままでOK）

2. **GitHubに新しいリポジトリを作り、このプロジェクトをpush**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/ユーザー名/リポジトリ名.git
   git push -u origin main
   ```

3. **リポジトリの Settings → Pages を開く**
   「Build and deployment」の Source を **GitHub Actions** に設定する。

4. **push すると自動でビルド・公開される**
   `.github/workflows/deploy.yml` が `main` ブランチへのpushをトリガーに
   `npm run build` → GitHub Pagesへのデプロイ を自動で行います。
   数分後、`https://ユーザー名.github.io/リポジトリ名/` で公開されます。

## データの出典・ライセンス

- 日本の地図データ: [jpn-atlas](https://github.com/biskwikman/jpn-atlas)（出典: 国土地理院「地球地図日本2016」）
- 世界の地図データ: [topojson/world-atlas](https://github.com/topojson/world-atlas)（Natural Earthのデータをビルドしたもの、Public Domain）
- 都道府県コード対応表は事実の一覧（JIS X 0401）であり、著作物性のない自前データです。

このリポジトリ自体のコードは [MIT License](./LICENSE) です。

## データの扱いについて

訪問記録・メモはブラウザの `localStorage` にのみ保存され、どこにも送信されません。
他の人がこのサイトを開いても、あなたの記録には触れられません（各ブラウザ・各端末ごとに独立しています）。
「書き出す」機能でバックアップを作成し、別の端末で「読み込む」ことで記録を引き継げます。
