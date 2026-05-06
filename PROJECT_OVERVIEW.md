# Sprightly — プロジェクト概要

> Last updated: 2026-05-06

---

## プロジェクト概要

**Sprightly** は、Anki スタイルの間隔反復（SRS）を使って英単語を効率的に暗記する学習アプリ。

- **Web版**: https://sprightlyeitango.vercel.app （Next.js / Vercel）
- **モバイル版**: Expo Go で動作確認済み（iOS/Android）

---

## 技術スタック

| レイヤー | Web | Mobile |
|---------|-----|--------|
| フレームワーク | Next.js 16.2.4 (App Router) | Expo SDK 54 / React Native 0.81 |
| 言語 | TypeScript 5 | TypeScript 5 |
| スタイリング | Tailwind CSS v4 | StyleSheet.create（NativeWind導入済み） |
| ルーティング | Next.js App Router | expo-router（ファイルベース） |
| 状態管理 | Context API + useReducer | 同上 |
| ストレージ | localStorage（同期） | AsyncStorage（非同期） |
| 音声 | Web Speech API | expo-speech |
| テスト | Vitest | なし（SRSロジックはWebテストで担保） |

---

## 主な機能

| 機能 | 説明 |
|------|------|
| SRS学習 | Anki準拠の間隔反復。4段階評価（Again/Hard/Good/Easy）。学習フェーズ: 1分→10分→1日→卒業 |
| 単語追加 | dictionaryapi.dev から自動取得。Datamuse API でオートコンプリート |
| CSV一括インポート | 英単語のCSVを取り込み、辞書APIで一括登録 |
| フラッシュカード | カードフリップアニメーション。英英定義・例文・日本語訳（MyMemory API）を表示 |
| 発音 | スピーカーボタンで英語音声読み上げ |
| Tatoeba例文 | 英→日フィルタで実用的な例文を取得 |
| 進捗グラフ | masteredAt タイムスタンプをもとにした習得累積グラフ（SVG） |
| 1日の新規上限 | 設定可能な1日あたりの新規カード上限（デフォルト20枚） |
| ユーザーメモ | 各単語にメモを追加・編集可能 |
| フォントサイズ設定 | 小/中/大 の3段階 |

---

## リポジトリ構成

```
sprightly/                       ← Next.js プロジェクトルート
├── src/                           Web アプリ本体
├── mobile/                        Expo モバイルアプリ（別プロジェクト）
├── DESIGN.md                      技術設計ドキュメント（実装詳細）
└── PROJECT_OVERVIEW.md            このファイル
```

**Git リモート:**
- `origin` → `github.com/yamaguchi20090626-ship-it/sprightly`（開発用）
- `eitango` → `github.com/yamaguchi20090626-ship-it/sprightly_eitango`（Vercel 連携用）

Vercel へのデプロイは `git push eitango master:main` で行う。

---

## 経緯

### Phase 0 — MVP（Next.js Web アプリ）

- 英単語フラッシュカード機能を Next.js で実装
- SRSアルゴリズム（Anki準拠）を純粋関数として `src/lib/srs.ts` に実装
- 状態は localStorage に JSON で全件保存
- 外部API: dictionaryapi.dev（定義）、Datamuse（補完）、MyMemory（翻訳）、Tatoeba（例文）
- Vitest で SRS エンジンのユニットテストを整備

### Phase 1 — Vercel デプロイ（Web 公開）

- GitHub リポジトリ作成・プッシュ
- Vercel に接続してデプロイ
- **ハマりポイント**: `sprightly` という名前が GitHub で使用済みだったため `sprightly_eitango` という名前で作成。最初は `origin`（sprightly）にプッシュしており、Vercel が `sprightly_eitango` を見ているためビルドが古い状態のまま進まなかった。
- **ハマりポイント**: Next.js 16 は `tsconfig.json` の `exclude` 設定を無視してプロジェクト直下の全 `.ts`/`.tsx` を TypeScript チェッカーに渡す。`mobile/` 配下に `expo-router` を参照するファイルがあると Vercel ビルドが失敗する。試みた解決策:
  - tsconfig `exclude` 設定 → 無効
  - `.vercelignore` に `mobile/` 追加 → 無効
  - `vercel.json` の `buildCommand: "rm -rf mobile && npm run build"` → 無効
  - `next.config.ts` の `ignoreBuildErrors: true` → 無効
  - `src/types/expo-modules.d.ts` でスタブ宣言 → ローカルは動作、Vercel では無効
  - **最終解決策**: `mobile/` 配下の全 TypeScript ファイル（25ファイル）に `// @ts-nocheck` を追加 → 成功

### Phase 2 — Expo モバイルアプリ作成

- `mobile/` ディレクトリに `create-expo-app` で Expo プロジェクトを新規作成
- Web 版のロジック（srs.ts, types/word.ts）はそのままコピー
- プラットフォーム依存部分を差し替え:
  - `localStorage` → `AsyncStorage`（非同期のため各関数を `async` 化）
  - `window.speechSynthesis` → `expo-speech`
  - `crypto.randomUUID()` → `expo-crypto`
  - `<svg>` → `react-native-svg`
  - CSS 3D カードフリップ → `Animated.spring + opacity` 補間
  - Tatoeba プロキシ経由 → 直接 API 呼び出し（React Native は CORS 制限なし）
- expo-router でファイルベースの5タブナビゲーションを実装
- **ハマりポイント**: iOS 実機での Expo Go 接続
  - 同一 Wi-Fi でも接続不可（`"The internet connection appears to be offline"`）
  - Windows Firewall でポート 8081/19000/19001 を開放しても解消せず
  - `--tunnel` モードの ngrok が `"remote gone away"` で失敗
  - 再試行で `--tunnel` が成功し、Expo Go で接続できた

---

## コマンドリファレンス

```bash
# Web 開発
npm run dev              # localhost:3000 で起動
npm run build            # プロダクションビルド
npm test                 # SRS ユニットテスト実行

# Web デプロイ（Vercel）
git push eitango master:main

# モバイル開発
cd mobile
npx expo start --tunnel  # iOS 実機テスト（推奨）
npx expo start --lan     # 同一 LAN での接続（Windows Firewall 設定が必要）
```
