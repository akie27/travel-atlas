import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages（プロジェクトサイト）は https://<ユーザー名>.github.io/<リポジトリ名>/
// という URL で配信されるため、base をリポジトリ名に合わせる必要があります。
// 例: リポジトリ名が "travel-atlas" なら base: "/travel-atlas/"
// ユーザー名.github.io という「ユーザーサイト」用リポジトリの場合は base: "/" のままでOK。
export default defineConfig({
  plugins: [react()],
  base: "/travel-atlas/", // ← ここをあなたのリポジトリ名に書き換えてください
});
