# Sprightly — 実装設計ドキュメント

> バージョン: 2026-05-02  
> 対象コード: `src/` 全体（Next.js 16.2.4 App Router / React 19 / TypeScript / Tailwind CSS v4）

---

## 目次

1. [システム全体像](#1-システム全体像)
2. [ディレクトリ構成と責務](#2-ディレクトリ構成と責務)
3. [データモデル](#3-データモデル)
4. [状態管理](#4-状態管理)
5. [SRSアルゴリズム](#5-srsアルゴリズム)
6. [外部API・内部API](#6-外部api内部api)
7. [永続化層](#7-永続化層)
8. [コンポーネント設計](#8-コンポーネント設計)
9. [ページ設計](#9-ページ設計)
10. [スタイリング規則](#10-スタイリング規則)
11. [既知の技術的負債](#11-既知の技術的負債)
12. [拡張ロードマップ](#12-拡張ロードマップ)

---

## 1. システム全体像

```
ブラウザ
 ├─ localStorage["sprightly_words"]     → WordEntry[]（全単語・SRS状態）
 └─ localStorage["sprightly_settings"]  → Settings（目標数・フォントサイズ）

Next.js (App Router)
 ├─ /                → redirect to /study
 ├─ /add             → 単語追加（1語 or CSV一括）
 ├─ /study           → SRSフラッシュカード学習
 ├─ /words           → 単語一覧・検索・削除
 ├─ /progress        → 進捗グラフ・統計
 ├─ /settings        → 設定（目標語数・フォントサイズ）
 └─ /api/examples    → Tatoeba CORS プロキシ（Route Handler）

外部API
 ├─ api.dictionaryapi.dev   → 単語定義取得（クライアント直接）
 ├─ tatoeba.org/api_v0      → 例文取得（サーバー経由プロキシ）
 └─ api.mymemory.translated.net → 日本語翻訳（クライアント直接）
```

**データフロー（学習セッション）**

```
[study/page.tsx]
  pickNextWord(words, now)  ←  WordContext（全単語）
       ↓ カードを表示
  [FlashCard.tsx]
       ↓ 4段階評価 (again / hard / good / easy)
  dispatch({ type: 'REVIEW_CARD', id, rating })
       ↓
  [WordContext reducer]
  getSRSCard(word) → reviewCard(card, rating, now) → 次状態
  WordEntry に srs* フィールドを書き戻す
       ↓
  saveWords(words)  →  localStorage
```

---

## 2. ディレクトリ構成と責務

```
src/
├─ app/
│   ├─ layout.tsx           ルートレイアウト。Provider 積み上げ場所。
│   ├─ globals.css          CSS変数定義・Tailwind import。
│   ├─ page.tsx             / → /study リダイレクト。
│   ├─ add/page.tsx         WordForm + CsvImport を配置するだけ。
│   ├─ study/page.tsx       SRSロジック + カード切り替え。
│   ├─ words/page.tsx       WordList を配置するだけ。
│   ├─ progress/page.tsx    統計カード + SVG折れ線グラフ。
│   ├─ settings/page.tsx    goalCount / fontSize 設定UI。
│   └─ api/
│       └─ examples/route.ts  GET /api/examples?word=xxx → Tatoeba プロキシ。
│
├─ components/
│   ├─ NavBar.tsx           スティッキーナビ。usePathname でアクティブ判定。
│   ├─ AppShell.tsx         fontSize Context を div クラスに適用する薄いラッパ。
│   ├─ WordForm.tsx         1語検索・プレビュー・追加フォーム。
│   ├─ CsvImport.tsx        CSV一括インポート（直列API呼び出し）。
│   ├─ FlashCard.tsx        カードフリップ + 4ボタン評価 + 例文取得。
│   ├─ WordList.tsx         検索・ソート・展開詳細付き単語一覧。
│   └─ ProgressStats.tsx    目標達成バー + ステータス別横棒グラフ。
│
├─ context/
│   ├─ WordContext.tsx      WordEntry[] の CRUD + REVIEW_CARD アクション。
│   └─ SettingsContext.tsx  Settings の読み書き。
│
├─ lib/
│   ├─ api.ts               fetchWord（辞書）/ fetchExamples（プロキシ経由）。
│   ├─ storage.ts           loadWords / saveWords（localStorage ラッパ）。
│   └─ srs.ts               SRSアルゴリズム純粋関数群。
│
├─ types/
│   └─ word.ts              共通型定義（WordEntry / SRSCard / Rating など）。
│
└─ __tests__/
    └─ srs.test.ts          Vitest 単体テスト（18ケース）。
```

---

## 3. データモデル

### 3.1 `WordEntry`（`src/types/word.ts`）

```typescript
export interface WordEntry {
  // ── 識別・基本情報 ─────────────────────────────
  id: string;              // crypto.randomUUID()
  word: string;            // 正規化済み英単語（API返却値そのまま）
  phonetic?: string;       // 発音記号。例: "/rɪˈzɪliənt/"
  meanings: Meaning[];     // 品詞ごとの定義リスト（最大 all partOfSpeech）

  // ── 表示用ステータス ──────────────────────────
  status: Status;          // 'new' | 'learning' | 'mastered'
                           // srsState から自動導出（review → mastered）

  // ── タイムスタンプ ────────────────────────────
  addedAt: number;         // Date.now()
  lastStudiedAt?: number;  // 最後にREVIEW_CARDが発火した時刻
  masteredAt?: number;     // status が初めて 'mastered' になった時刻（progress グラフ用）

  // ── 学習統計 ──────────────────────────────────
  studyCount: number;      // REVIEW_CARD 発火回数
  correctCount: number;    // rating が 'good' or 'easy' だった回数

  // ── SRS フィールド（optional: 後方互換）────────
  srsState?: 'new' | 'learning' | 'review';
  srsInterval?: number;    // 日数（整数）
  srsEaseFactor?: number;  // 小数。デフォルト 2.5
  srsDue?: number;         // Unix ms タイムスタンプ
  srsStep?: number;        // learning フェーズのステップ index (0-2)
}
```

**`Meaning` / `Definition`**

```typescript
export interface Definition {
  definition: string;
  example?: string;
}

export interface Meaning {
  partOfSpeech: string;    // "noun" | "verb" | "adjective" | ...
  definitions: Definition[]; // API から最大3件に絞る
  synonyms: string[];      // 最大5件
}
```

**`Status` 遷移ルール**

| SRS `state` | 表示 `status` | 意味 |
|------------|--------------|------|
| `'new'` | `'new'` | 一度も学習していない |
| `'learning'` | `'learning'` | 学習フェーズ中 |
| `'review'` | `'mastered'` | 卒業・定期復習フェーズ |

`srsState` が未設定の既存データは `getSRSCard()` が `status` フィールドから移行する。

### 3.2 `Settings`（`src/context/SettingsContext.tsx`）

```typescript
export interface Settings {
  goalCount: number;        // 習得目標語数。デフォルト 100。最小値 1。
  fontSize: 'sm' | 'md' | 'lg'; // デフォルト 'md'
}
```

localStorage キー: `'sprightly_settings'`

---

## 4. 状態管理

### 4.1 `WordContext`

**Provider 配置**: `src/app/layout.tsx` の最外層。

**アクション一覧**

| action.type | payload | 動作 |
|-------------|---------|------|
| `LOAD_WORDS` | `words: WordEntry[]` | 初期ロード。localStorage から流し込む。 |
| `ADD_WORD` | `word: WordEntry` | 末尾に追加。 |
| `REVIEW_CARD` | `id: string, rating: Rating` | SRS計算 → 全フィールド更新（後述）。 |
| `DELETE_WORD` | `id: string` | 該当IDを配列から除去。 |

**`REVIEW_CARD` の詳細ロジック**

```typescript
case 'REVIEW_CARD': {
  const now = Date.now();
  return state.map((w) => {
    if (w.id !== action.id) return w;
    const card = getSRSCard(w);                         // 既存or移行データからSRSCard生成
    const next = reviewCard(card, action.rating, now);  // 純粋関数で次状態算出
    const isCorrect = action.rating === 'good' || action.rating === 'easy';
    const newStatus = srsStateToStatus(next.state);     // 'review' → 'mastered' 等

    return {
      ...w,
      status: newStatus,
      srsState: next.state,
      srsInterval: next.interval,
      srsEaseFactor: next.easeFactor,
      srsDue: next.due,
      srsStep: next.step,
      studyCount: w.studyCount + 1,
      correctCount: w.correctCount + (isCorrect ? 1 : 0),
      lastStudiedAt: now,
      masteredAt: newStatus === 'mastered' && !w.masteredAt ? now : w.masteredAt,
    };
  });
}
```

**副作用**: `useEffect([words])` で `saveWords(words)` を呼ぶ。状態変化のたびに全件をlocalStorageに書き込む。

### 4.2 `SettingsContext`

**アクション一覧**

| action.type | payload | 動作 |
|-------------|---------|------|
| `LOAD` | `settings: Settings` | 初期ロード。`DEFAULT` とマージ（`{ ...DEFAULT, ...settings }`）。 |
| `SET_GOAL` | `count: number` | `Math.max(1, count)` で下限保証。 |
| `SET_FONT_SIZE` | `size: FontSize` | 'sm' \| 'md' \| 'lg'。 |

---

## 5. SRSアルゴリズム

実装: `src/lib/srs.ts`。テスト: `src/__tests__/srs.test.ts`（18ケース、全通過）。

### 5.1 型定義

```typescript
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type SRSState = 'new' | 'learning' | 'review';

export interface SRSCard {
  interval: number;    // 日数（整数）。未学習時は 0。
  easeFactor: number;  // 区間乗数。範囲 [1.3, ∞)。デフォルト 2.5。
  due: number;         // Unix ms タイムスタンプ。0 = 即出題。
  state: SRSState;
  step: number;        // learning フェーズのステップ index (0–2)
}
```

### 5.2 定数

```typescript
const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;
const GRADUATING_INTERVAL = 1;  // 日数: learning 最終ステップから卒業時
const EASY_INTERVAL = 4;        // 日数: Easy で即卒業時

const STEPS_MS = [
  1  * 60 * 1_000,       // Step 0: 1分後
  10 * 60 * 1_000,       // Step 1: 10分後
  24 * 60 * 60 * 1_000,  // Step 2: 1日後 → 卒業
] as const;
```

### 5.3 エントリポイント

```typescript
export function reviewCard(
  card: SRSCard,
  rating: Rating,
  now: number,
  rng: () => number = Math.random,  // テスト時に固定値を渡せる
): SRSCard
```

- 入力を**ミュートしない**（`{ ...card, ... }` でコピー）
- `card.state === 'review'` → `handleReview`、それ以外 → `handleLearning`

### 5.4 Learningフェーズ

| rating | 動作 |
|--------|------|
| `again` | `state='learning', step=0, due=now+STEPS_MS[0]` (1分後) |
| `hard` | `state='learning', step=現step, due=now+STEPS_MS[現step]` |
| `good` | `step+1 < 3` → 次ステップへ進む。`step+1 >= 3` → 卒業（後述）。 |
| `easy` | 即卒業。`interval=applyFuzz(4)`, `state='review'` |

**卒業条件（good on step 2）**:
```typescript
const base = card.interval > 0 ? card.interval : GRADUATING_INTERVAL;  // 既存interval or 1日
const interval = applyFuzz(base, rng);
return { ...card, state: 'review', step: 0, interval, due: now + daysMs(interval) };
```

### 5.5 Reviewフェーズ

| rating | interval 計算 | easeFactor 変化 |
|--------|-------------|----------------|
| `again` | interval=1（固定）、`state='learning', step=0, due=now+1分` | `-0.2`（下限 1.3）|
| `hard` | `ceil(interval × 1.2)` | `-0.15`（下限 1.3）|
| `good` | `ceil(interval × easeFactor)` | 変化なし |
| `easy` | `ceil(interval × easeFactor × 1.3)` | `+0.1` |

### 5.6 ファズ処理

```typescript
function applyFuzz(interval: number, rng: () => number): number {
  const factor = 1 + (rng() * 0.1 - 0.05);  // ±5%
  return Math.max(1, Math.ceil(interval * factor));
}
```

- `rng()` デフォルトは `Math.random`
- `rng()=0.5` のとき factor=1.0（deterministic テスト用）
- 結果は必ず整数・最小1日

### 5.7 ユーティリティ関数

**`getSRSCard(word: WordEntry): SRSCard`**  
既存データからSRSCard生成。`srsState` 未設定の場合 `status` フィールドから移行:
- `status='mastered'` → `srsState='review', srsInterval=4`
- `status='learning'` → `srsState='learning'`
- それ以外 → `srsState='new'`

**`pickNextWord(words: WordEntry[], now: number): WordEntry | null`**  
1. `getSRSCard(w).due <= now` のカードのみ対象
2. 優先順位: `learning` > `new` > `review`
3. 同優先度内はランダム選択（`Math.random()`）

**`nextDueMs(words: WordEntry[], now: number): number | null`**  
`due > now` のカードの中で最小の `due` を返す。なければ `null`。

---

## 6. 外部API・内部API

### 6.1 Free Dictionary API（辞書定義取得）

```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```

- **認証**: 不要
- **呼び出し元**: クライアント直接（`src/lib/api.ts` の `fetchWord`）
- **レート制限**: 公式明記なし。実装上の制限: CSV一括時は300ms間隔を挿入
- **レスポンス処理**:
  - `data[0]` のみ使用
  - `phonetic`: `entry.phonetic ?? entry.phonetics[].text` の最初
  - `meanings`: 全 `partOfSpeech` 取得。`definitions` は先頭3件のみ
  - `synonyms`: 先頭5件のみ
- **エラー処理**: `!res.ok` または例外 → `null` 返却

### 6.2 Tatoeba API（例文取得） ← サーバープロキシ経由

**内部エンドポイント**: `GET /api/examples?word={word}`  
**実装**: `src/app/api/examples/route.ts`

```
外部 URL: https://tatoeba.org/api_v0/search?query={word}&from=eng
```

- **なぜプロキシが必要か**: `tatoeba.org` は `Access-Control-Allow-Origin` を返さないためブラウザからの直接呼び出し不可
- **レスポンス処理**: `data.results[].text` を最大5件取得
- **エラー時**: `{ examples: [] }` を返す（例外もキャッチ）
- **クライアント呼び出し**: `src/lib/api.ts` の `fetchExamples(word)`

### 6.3 MyMemory 翻訳API（日本語訳）

```
GET https://api.mymemory.translated.net/get?q={text}&langpair=en|ja
```

- **認証**: 不要（無料枠）
- **呼び出し元**: クライアント直接（`FlashCard.tsx` 内インライン実装）
- **入力制限**: 400文字でスライス（`text.slice(0, 400)`）
- **結果取得**: `data.responseData.translatedText`
- **エラー処理**: 例外 → `''` 返却

---

## 7. 永続化層

### 7.1 localStorage スキーマ

| キー | 型 | 内容 |
|------|----|------|
| `sprightly_words` | `JSON(WordEntry[])` | 全単語データ |
| `sprightly_settings` | `JSON(Settings)` | アプリ設定 |

### 7.2 `src/lib/storage.ts`

```typescript
export function loadWords(): WordEntry[]      // SSR時は[]を返す
export function saveWords(words: WordEntry[]): void
```

- `typeof window === 'undefined'` チェックでSSR安全
- `JSON.parse` 失敗時は `[]` を返す

### 7.3 書き込みタイミング

WordContext の `useEffect([words])` が words 変化のたびに `saveWords` を呼ぶ。  
SettingsContext の `useEffect([settings])` が settings 変化のたびに書き込む。

**注意**: 単語数が増えるほど毎回全件書き込みが発生する。現状は局所的な問題ではないが、1000語を超えると顕在化する可能性がある（→ [技術的負債 §11.1](#111-全件書き込みのパフォーマンス)）。

---

## 8. コンポーネント設計

全コンポーネントは `'use client'` ディレクティブ付き（localStorageアクセスとReact hooksのため）。

### 8.1 `NavBar`

```
Props: なし
Hooks: usePathname()
```

- `links` 配列でルートとラベルを管理
- アクティブリンク: `pathname === href` で `bg-sky-600 text-white` を適用
- sticky + `z-10` でスクロール時も常に表示

### 8.2 `AppShell`

```
Props: { children: ReactNode }
Hooks: useSettings()
```

- `fontClass = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }` をルート div に適用
- children 全体のフォントサイズをここで一元制御

### 8.3 `WordForm`

```
Props: なし
Hooks: useWords(), useWordDispatch()
State: input, preview, loading, error, added
```

**フロー**:
1. input → Enter or 検索ボタン → `fetchWord(term)` → `preview` セット
2. 重複チェック: `words.some(w => w.word.toLowerCase() === preview.word.toLowerCase())`
3. 追加: `ADD_WORD` dispatch。`studyCount=0, correctCount=0, status='new'`
4. SRS フィールドは追加時に**セットしない**（`getSRSCard` で移行済み扱いが必要な場合は `srsDue=0` がデフォルト）

### 8.4 `CsvImport`

```
Props: なし
Hooks: useWords(), useWordDispatch()
State: status, progress, result, error
Ref: fileRef（inputリセット用）
```

**CSV パースルール** (`parseCsv`):
- `\r?\n` で行分割 → 各行の1列目（`,`で分割した`[0]`）を取得
- 前後の引用符・空白を除去
- 空行・ヘッダー行（`/^(word|英単語|english|単語)$/i`）を除外
- 先頭が英字でなければ除外

**インポートフロー**:
1. 重複は `skipped`（API呼び出しなし）
2. 未重複 → `fetchWord` → 成功なら `ADD_WORD`、失敗なら `notFound`
3. **直列処理**: 各単語の間に `await new Promise(r => setTimeout(r, 300))` を挿入（APIレート制限対策）
4. 完了後 `fileRef.current.value = ''` でinputリセット

### 8.5 `FlashCard`

```
Props: { word: WordEntry, onResult: (rating: Rating) => void }
Hooks: useState x6（flipped, japaneseTexts, loadingJa, tatoebaExamples, loadingTatoeba, tatoebaJaTexts, loadingTatoebaJa）
```

**カードフリップ実装**:
```
perspective: 1000px  → 親 div
transformStyle: preserve-3d  → 子 div（カード本体）
transform: rotateY(0deg) / rotateY(180deg)  → state で切り替え
backfaceVisibility: hidden  → 表・裏それぞれに適用
```

**評価ボタン**: カード裏面（`flipped=true`）のときのみ表示

| ボタン | 色 | 日本語ラベル |
|--------|-----|-------------|
| Again | red-100 / text-red-700 | もう一度 |
| Hard | orange-100 / text-orange-700 | 難しい |
| Good | blue-100 / text-blue-700 | 正解 |
| Easy | emerald-100 / text-emerald-700 | 簡単 |

**評価後リセット**: `handleResult(rating)` で `flipped=false`、全取得済みデータを `null` リセット → `onResult(rating)` 呼び出し

**単語ハイライト** (`highlightWord`):
```typescript
function highlightWord(sentence: string, word: string): React.ReactNode {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = sentence.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase()
      ? <strong key={i} className="text-amber-500 font-bold not-italic">{part}</strong>
      : part
  );
}
```

### 8.6 `WordList`

```
Props: なし
Hooks: useWords(), useWordDispatch()
State: searchQuery, sortOrder('added'|'az'), expandedId
```

**フィルタ・ソート** (`useMemo`):
1. `searchQuery` で `word.toLowerCase().includes(q)` フィルタ
2. `sortOrder='az'` → `localeCompare`、`'added'` → `reverse()`（追加順の新しい順）

**展開詳細** (`WordDetail` サブコンポーネント):
- クリックで `expandedId` をトグル（同一IDなら閉じる）
- phonetic、meanings（全品詞）、辞書例文を表示

### 8.7 `ProgressStats`

```
Props: なし
Hooks: useWords(), useSettings()
```

**目標達成バー**:
- `achievePct = Math.min(100, Math.round((masteredCount / goalCount) * 100))`

**横棒グラフ**:
- `maxCount = Math.max(...counts, 1)`（ゼロ除算防止）
- 各バー幅: `(count / maxCount) * 100%`

---

## 9. ページ設計

### 9.1 `/add`

`WordForm` + `CsvImport` の垂直積み（`space-y-8`）。

### 9.2 `/study`

**State**: `current: WordEntry | null`, `sessionCount: number`, `tick: number`

**カード選択ロジック**:
```
初期表示: useEffect([words, current]) → current===nullのとき pickNextWord(words, now)
評価後: handleResult() → pickNextWord(words.filter(not current), now) → setCurrent
due切れ待機: useEffect([current]) → current===null のとき 10秒ごと tick++ → pickNextWord 再試行
```

**"no due cards" 画面**:
- `nextDueMs(words)` で次の due を取得
- `formatCountdown(ms)`: 60分未満 → `${Math.ceil(ms/60_000)}分後`、以上 → `${Math.ceil(ms/3_600_000)}時間後`
- 「今すぐ確認」ボタンで手動 `pickNextWord`

**ステータスバー表示**:
```typescript
const dueCount = words.filter(w => getSRSCard(w).due <= Date.now()).length;
```

### 9.3 `/words`

`WordList` のみ。

### 9.4 `/progress`

**SVGグラフ定数**:
```typescript
const PAD = { l: 44, r: 20, t: 16, b: 38 };
const CW = 476;   // チャート幅
const CH = 180;   // チャート高さ
const VW = 540;   // viewBox幅
const VH = 234;   // viewBox高さ
```

**データ準備**（`useMemo`）:
1. `masteredAt ?? lastStudiedAt ?? addedAt` で習得タイムスタンプ推定
2. 昇順ソート → 累積カウント点列生成
3. 先頭に「最初の習得日 - 1日、count=0」を追加（グラフ原点）
4. 末尾に「現在時刻、同count」を追加（今日まで線を引く）

**座標変換**:
- X軸: `PAD.l + ((ms - xMin) / range) * CW`
- Y軸: `PAD.t + CH - (count / max) * CH`（上が多）

**Y軸目盛り**: 0, 25%, 50%, 75%, 100% の5本（重複値は `filter(unique)`）  
**X軸ラベル**: 最大5点を等間隔サンプリング（`M/D` 形式）

### 9.5 `/settings`

- goalCount: `<input type="number" min=1 max=9999>`
- fontSize: 3ボタン（小/中/大）、アクティブ = `bg-indigo-600 text-white`

---

## 10. スタイリング規則

### 10.1 カラーパレット

```css
:root {
  --bg-app: #1a3357;   /* ページ背景（落ち着いた濃紺） */
  --bg-nav: #0f2540;   /* ナビゲーション背景 */
}
body { background-color: var(--bg-app); color: #f1f5f9; }
```

### 10.2 カード・パネル類

| 用途 | クラス |
|------|--------|
| 白カード（明るい要素） | `bg-white border border-gray-200 rounded-xl` |
| 半透明パネル（ダーク背景上） | `bg-white/10 rounded-xl` |
| フラッシュカード表 | `bg-white border-gray-200 rounded-2xl` |
| フラッシュカード裏 | `bg-indigo-50 border-indigo-100 rounded-2xl` |

### 10.3 ステータスバッジ

```typescript
const statusColor = {
  new: 'bg-gray-100 text-gray-600',
  learning: 'bg-yellow-100 text-yellow-700',
  mastered: 'bg-green-100 text-green-700',
};
```

### 10.4 フォントサイズ制御

`AppShell` の div に `text-sm` / `text-base` / `text-lg` を付与。  
個別コンポーネント内で `text-xs`, `text-sm` 等を使う場合は AppShell クラスからの相対値となる点に注意。

### 10.5 最大幅制約

`<main className="max-w-2xl mx-auto px-4 py-8">` で全ページ最大幅 672px。  
NavBar も同じ `max-w-2xl mx-auto` で揃える。

---

## 11. 既知の技術的負債

### 11.1 全件書き込みのパフォーマンス

`useEffect([words])` が words 変化のたびに `JSON.stringify(全件)` を localStorage に書く。  
単語数 < 500語 では問題ないが、超えると 1回の評価で数十ms のブロッキングが発生しうる。

**対策案**: `useRef` で前回スナップショットを保持し、差分がある場合だけ書き込む。

### 11.2 `study/page.tsx` の `eslint-disable` コメント

```typescript
useEffect(() => {
  // ...
}, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
```

`words` を deps に含めると無限ループするため一時的に外している。  
正しい修正: `tick` と `words` を組み合わせた `useCallback` か `useRef` でwords最新値を参照する。

### 11.3 MyMemory 翻訳のレート制限

無料枠は 1日 5,000文字。ヘビーユーザーが多数の例文を翻訳すると制限に達する。エラー時は空文字を返すだけでユーザーに通知しない。

### 11.4 SRS フィールドが `ADD_WORD` 時に未設定

新規追加時に `srsDue` を設定しないため、`getSRSCard(w).due = 0`（即出題対象）となる。  
これは意図どおりだが、ドキュメント化されていない暗黙の挙動。

### 11.5 `progress/page.tsx` のマスタリングタイムスタンプ推定

`masteredAt` が未設定の既存データは `lastStudiedAt ?? addedAt` で代替する。  
これはグラフの日付を誤った方向にずらす可能性がある（実際の習得日と乖離）。

### 11.6 CsvImport の直列API呼び出し

300ms間隔 × N語で大きなCSVほど時間がかかる。50語 = 最低15秒。キャンセル手段がない。

---

## 12. 拡張ロードマップ

### 優先度 HIGH

#### A. SRS統計の可視化
`/progress` ページに SRS固有の統計を追加する。

**追加すべき指標**:
- 本日の期限カード数（`getSRSCard(w).due <= startOfDay`）
- 学習フェーズ別内訳（learning/step別）
- 平均 easeFactor（モチベーション指標）

#### B. 単語インポート時のSRSフィールド初期化

`ADD_WORD` の `word` オブジェクトに以下を追加:
```typescript
srsState: 'new',
srsInterval: 0,
srsEaseFactor: 2.5,
srsDue: 0,       // 即出題
srsStep: 0,
```
`getSRSCard` の移行ロジックへの依存をなくし、新規追加は常に明示的な初期値を持つ。

### 優先度 MEDIUM

#### C. 学習セッション上限

1セッションで出題する新規カード枚数を設定可能にする（例: 新規は1日20枚まで）。  
`Settings` に `newCardsPerDay: number` を追加。`pickNextWord` が `'new'` を選ぶとき、当日すでに出題済みの新規カード数をカウントして制限。

#### D. データエクスポート / バックアップ

`words: WordEntry[]` を JSON または CSV にエクスポートするボタンを `/settings` に追加。  
実装: `URL.createObjectURL(new Blob([JSON.stringify(words)], {type:'application/json'}))`

#### E. オフライン対応 / PWA

`next.config.ts` に `next-pwa` を追加。Service Worker でページキャッシュ。  
外部APIへの fetch は失敗してもUIが壊れない設計にすること（現状は `try/catch` で `null` 返却済み）。

### 優先度 LOW

#### F. クラウド同期

現状 localStorage のみ。バックエンドを追加する場合:
1. `loadWords()` / `saveWords()` を抽象化したアダプタインタフェースに差し替える
2. 楽観的更新 + バックグラウンド同期で UX を維持する

#### G. 音声読み上げ

`window.speechSynthesis.speak(new SpeechSynthesisUtterance(word))` で実装可能。  
`FlashCard` のフロント面に「発音を聞く」ボタンを追加。

#### H. カードの手動難易度調整

単語一覧から特定単語の `easeFactor` や `srsDue` を直接編集できる UI。
