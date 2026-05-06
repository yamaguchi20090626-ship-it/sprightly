# Sprightly — Technical Design Document

> 対象読者: 実装担当エンジニア。このドキュメントだけで実装・修正・拡張が可能なレベルで記述する。
> Last updated: 2026-05-06

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [データモデル](#2-データモデル)
3. [SRSエンジン](#3-srsエンジン)
4. [状態管理](#4-状態管理)
5. [外部API仕様](#5-外部api仕様)
6. [Web実装詳細](#6-web実装詳細)
7. [モバイル実装詳細](#7-モバイル実装詳細)
8. [プラットフォーム差異一覧](#8-プラットフォーム差異一覧)
9. [ストレージ設計](#9-ストレージ設計)
10. [デプロイ構成](#10-デプロイ構成)
11. [既知の技術的負債](#11-既知の技術的負債)

---

## 1. アーキテクチャ概要

```
sprightly/
├── src/                        ← Next.js 16.2.4 (Web / Vercel)
│   ├── app/                      App Router
│   │   ├── page.tsx              / → /study redirect
│   │   ├── study/page.tsx        SRS学習画面
│   │   ├── add/page.tsx          単語追加
│   │   ├── words/page.tsx        単語一覧
│   │   ├── progress/page.tsx     進捗グラフ
│   │   ├── settings/page.tsx     設定
│   │   └── api/examples/         Tatoebaプロキシ (Route Handler)
│   ├── components/               React コンポーネント
│   ├── context/                  WordContext, SettingsContext
│   ├── lib/                      srs.ts, api.ts, storage.ts, dailyLimit.ts
│   └── types/                    word.ts
└── mobile/                     ← Expo SDK 54 / React Native 0.81 (iOS/Android)
    ├── app/
    │   ├── _layout.tsx           Root Stack + Providers
    │   └── (tabs)/               ファイルベースルーティング (expo-router)
    │       ├── index.tsx         学習
    │       ├── add.tsx           単語追加
    │       ├── words.tsx         単語一覧
    │       ├── progress.tsx      進捗グラフ
    │       └── settings.tsx      設定
    ├── components/
    ├── context/                  WordContext, SettingsContext (AsyncStorage版)
    ├── lib/                      srs.ts(同一), api.ts(Tatoeba直接呼出し), dailyLimit.ts(async)
    └── types/                    word.ts (Web版と完全同一)
```

### コード共有戦略

モノレポパッケージ化せず単純ファイルコピーで管理。規模に対してモノレポ設定のオーバーヘッドが不釣り合いなため。

| ファイル | Web | Mobile | 差異 |
|---------|-----|--------|------|
| `types/word.ts` | `src/types/` | `mobile/types/` | なし（バイト単位で同一） |
| `lib/srs.ts` | `src/lib/` | `mobile/lib/` | なし（バイト単位で同一） |
| `lib/api.ts` | `src/lib/` | `mobile/lib/` | `fetchExamples` のみ変更（プロキシ→直接） |
| `lib/dailyLimit.ts` | `src/lib/` | `mobile/lib/` | `localStorage`→`AsyncStorage`、全関数が `async` |
| `context/WordContext.tsx` | `src/context/` | `mobile/context/` | ストレージ層のみ変更 |
| `context/SettingsContext.tsx` | `src/context/` | `mobile/context/` | ストレージ層のみ変更 |

---

## 2. データモデル

### WordEntry（唯一の永続化エンティティ）

```typescript
// src/types/word.ts  /  mobile/types/word.ts（同一）

export type Status = 'new' | 'learning' | 'mastered';

export interface Definition {
  definition: string;
  example?: string;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];  // API から最大3件に絞る
  synonyms: string[];         // API から最大5件に絞る
}

export interface WordEntry {
  id: string;           // crypto.randomUUID() / Crypto.randomUUID()
  word: string;         // API返却値そのまま（dictionaryapi.dev が正規化済み）
  phonetic?: string;    // 例: /ˈhæpɪ/
  meanings: Meaning[];

  // SRS state から自動導出: 'review' → 'mastered'
  status: Status;

  // タイムスタンプ（Unixミリ秒）
  addedAt: number;
  lastStudiedAt?: number;
  masteredAt?: number;      // 初めて 'mastered' になった時刻。以後変更しない

  // 統計
  studyCount: number;       // REVIEW_CARD のたびに +1
  correctCount: number;     // rating が 'good' or 'easy' のとき +1

  // SRS フィールド（省略可: getSRSCard が status から移行）
  srsState?: 'new' | 'learning' | 'review';
  srsInterval?: number;     // 日数（整数）
  srsEaseFactor?: number;   // 乗数。範囲: [1.3, ∞)。デフォルト 2.5
  srsDue?: number;          // 次回レビュー予定時刻（Unixミリ秒）。0 = 即出題
  srsStep?: number;         // 学習フェーズのステップ番号（0, 1, 2）

  note?: string;            // ユーザーメモ
}
```

### Status 遷移ルール

| srsState | status（表示用） |
|----------|-----------------|
| `'new'` | `'new'` |
| `'learning'` | `'learning'` |
| `'review'` | `'mastered'` |

`srsState` が未設定の既存データは `getSRSCard()` が `status` から推定して移行する。

### SettingsState

```typescript
type FontSize = 'sm' | 'md' | 'lg';

interface Settings {
  goalCount: number;        // デフォルト: 100, 最小値: 1
  fontSize: FontSize;       // デフォルト: 'md'
  newCardsPerDay: number;   // デフォルト: 20, 最小値: 1
}
```

---

## 3. SRSエンジン

ファイル: `src/lib/srs.ts`（`mobile/lib/srs.ts` と完全同一）  
テスト: `src/__tests__/srs.test.ts`（Vitest, 決定論的RNGで検証）

### 定数

```typescript
const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;
const GRADUATING_INTERVAL = 1;   // 日: learningの最終stepから卒業時
const EASY_INTERVAL = 4;         // 日: easyで即卒業時

const STEPS_MS = [
  1  * 60 * 1_000,       // step 0: 1分
  10 * 60 * 1_000,       // step 1: 10分
  24 * 60 * 60 * 1_000,  // step 2: 1日 → 卒業判定
];
```

### 状態遷移図

```
new ──good/easy──▶ learning ──good(step=2完了)──▶ review
                      │                               │
                   again                           again
                      └──────────(step=0)─────────────┘
```

### 学習フェーズ（handleLearning）

| rating | 次 state | 次 step | 次 due |
|--------|---------|---------|--------|
| again  | learning | 0      | now + STEPS[0]（1分） |
| hard   | learning | 現状維持 | now + STEPS[step] |
| good   | learning / review | step+1 / 0 | STEPS[step+1] / daysMs(interval) |
| easy   | review   | 0      | now + daysMs(4) |

good で step が最終（index 2）を超えた場合:
```typescript
const base = card.interval > 0 ? card.interval : GRADUATING_INTERVAL;
const interval = applyFuzz(base, rng);
// → state='review', interval=interval, due=now+daysMs(interval)
```

### レビューフェーズ（handleReview）

| rating | interval | easeFactor | state |
|--------|----------|------------|-------|
| again  | 1（固定） | ef − 0.2   | learning, step=0, due=now+STEPS[0] |
| hard   | interval × 1.2 | ef − 0.15 | review |
| good   | interval × ef  | 変化なし    | review |
| easy   | interval × ef × 1.3 | ef + 0.1 | review |

全ケースで `clampEase(MIN_EASE=1.3)` を適用。

### applyFuzz

```typescript
// ±5% のランダム揺らぎを加える（インターバルをわずかにずらす）
function applyFuzz(interval: number, rng: () => number = Math.random): number {
  const factor = 1 + (rng() * 0.1 - 0.05);
  return Math.max(1, Math.ceil(interval * factor));
}

const daysMs = (days: number) => Math.round(days * 86_400_000);
```

テスト時は `rng = () => 0.5`（factor=1.0）を渡して決定論的にする。

### カード選択（pickNextWord）

```typescript
export function pickNextWord(
  words: WordEntry[],
  now: number = Date.now(),
  opts: { skipNew?: boolean } = {},
): WordEntry | null
// 1. due <= now のカードのみ対象
// 2. 優先順位: 'learning' > 'new' > 'review'
// 3. 同優先度内は Math.random() でランダム選択
// opts.skipNew=true で 'new' をスキップ（1日の新規上限到達時）
```

### getSRSCard（WordEntry → SRSCard）

```typescript
export function getSRSCard(word: WordEntry): SRSCard {
  const defaultState =
    word.srsState ??
    (word.status === 'mastered' ? 'review' : word.status === 'learning' ? 'learning' : 'new');
  return {
    interval: word.srsInterval ?? (word.status === 'mastered' ? 4 : 0),
    easeFactor: word.srsEaseFactor ?? INITIAL_EASE,
    due: word.srsDue ?? 0,
    state: defaultState,
    step: word.srsStep ?? 0,
  };
}
```

---

## 4. 状態管理

### WordContext（両プラットフォーム共通のReducer）

```typescript
type Action =
  | { type: 'LOAD_WORDS'; words: WordEntry[] }
  | { type: 'ADD_WORD'; word: WordEntry }
  | { type: 'REVIEW_CARD'; id: string; rating: Rating }
  | { type: 'UPDATE_NOTE'; id: string; note: string }
  | { type: 'DELETE_WORD'; id: string };
```

#### REVIEW_CARD の処理

```typescript
case 'REVIEW_CARD': {
  const now = Date.now();
  return state.map((w) => {
    if (w.id !== action.id) return w;
    const card = getSRSCard(w);
    const next = reviewCard(card, action.rating, now);
    const isCorrect = action.rating === 'good' || action.rating === 'easy';
    const newStatus = srsStateToStatus(next.state); // 'review' → 'mastered'
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

### SettingsContext

Actions: `LOAD`, `SET_GOAL`, `SET_FONT_SIZE`, `SET_NEW_CARDS_PER_DAY`

`SET_GOAL`・`SET_NEW_CARDS_PER_DAY` は `value > 0` のバリデーションあり。不正値は無視（state 変更なし）。

### 初期化パターン

**Web（同期）:**
```typescript
useEffect(() => {
  const raw = localStorage.getItem(KEY);
  if (raw) dispatch({ type: 'LOAD_WORDS', words: JSON.parse(raw) });
}, []);
useEffect(() => {
  localStorage.setItem(KEY, JSON.stringify(words));
}, [words]);
```

**Mobile（非同期）:**
```typescript
useEffect(() => {
  AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
    if (raw) dispatch({ type: 'LOAD_WORDS', words: JSON.parse(raw) });
  });
}, []);
useEffect(() => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}, [words]);
```

---

## 5. 外部API仕様

### Datamuse（単語補完）

```
GET https://api.datamuse.com/sug?s=<prefix>&max=8
Response: [{ word: string, score: number }, ...]
条件: prefix.trim().length >= 2 のとき呼び出し
使用値: word のみ抽出（最大8件）
```

### dictionaryapi.dev（英英辞書）

```
GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>
Response: DictEntry[]
使用値:
  data[0].word
  data[0].phonetic ?? data[0].phonetics[].text (最初に text があるもの)
  data[0].meanings[]: partOfSpeech, definitions[:3], synonyms[:5]
エラー: !res.ok or 例外 → null 返却
```

### MyMemory（英→日 翻訳）

```
GET https://api.mymemory.translated.net/get?q=<text>&langpair=en|ja
Response: { responseData: { translatedText: string } }
制限: テキストは 400文字でスライス
エラー: 例外 → 空文字列返却
呼び出し元: FlashCard コンポーネント（インライン実装）
```

### Tatoeba（例文）

**Web** — Next.js Route Handler 経由（CORS回避）:
```
クライアント → GET /api/examples?word=<word>
  ↓ src/app/api/examples/route.ts
外部 → GET https://tatoeba.org/api_v0/search?query=<word>&from=eng
返却: results[:5].map(r => r.text)（エラー時: []）
```

**Mobile** — 直接呼び出し（React Native は CORS 制限なし）:
```typescript
// mobile/lib/api.ts
GET https://tatoeba.org/en/api_v0/search?query=<word>&from=eng&to=jpn&limit=5
返却: (data.results ?? []).slice(0, 3).map(r => r.text)
```

---

## 6. Web実装詳細

### ルーティング

```
/               → redirect('/study')
/study          → src/app/study/page.tsx
/add            → src/app/add/page.tsx
/words          → src/app/words/page.tsx
/progress       → src/app/progress/page.tsx
/settings       → src/app/settings/page.tsx
/api/examples   → src/app/api/examples/route.ts (GET)
```

### StudyPage のロジック

```
1. words = useWords()
2. settings = useSettings()
3. dailyNewCount = getDailyNewCount()（同期・初回mount時）
4. skipNew = dailyNewCount >= settings.newCardsPerDay
5. currentWord = pickNextWord(words, Date.now(), { skipNew })
6. currentWord が null かつ nextDueMs() が存在:
     → setInterval(10秒) で tick++ → pickNextWord 再試行
7. ユーザーが rating 選択:
     a. dispatch({ type: 'REVIEW_CARD', id, rating })
     b. wasNew（選択前の srsState='new'）なら incrementDailyNewCount()
     c. 次のカードを再選択して setCurrent
```

### FlashCard（Web）

**カードフリップ**: CSS のみ（JS 不要）
```css
/* 親 */
perspective: 1000px;

/* カード本体 */
transform-style: preserve-3d;
transform: rotateY(0deg) / rotateY(180deg);  /* flipped state で切り替え */

/* 表・裏 */
backface-visibility: hidden;
/* 裏面は初期 rotateY(180deg) */
```

**音声（Web Speech API）:**
```typescript
window.speechSynthesis.speak(
  Object.assign(new SpeechSynthesisUtterance(text), { lang: 'en-US' })
);
```

**評価ボタン色:**
| ボタン | 背景 | テキスト |
|--------|------|---------|
| Again  | red-100 | red-700 |
| Hard   | orange-100 | orange-700 |
| Good   | blue-100 | blue-700 |
| Easy   | emerald-100 | emerald-700 |

**単語ハイライト関数:**
```typescript
function highlightWord(sentence: string, word: string): React.ReactNode {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = sentence.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase()
      ? <strong key={i} className="text-amber-500 font-bold">{part}</strong>
      : part
  );
}
```

### ProgressPage SVGチャート仕様

```typescript
const PAD = { l: 44, r: 20, t: 16, b: 38 };
const CW = 476; const CH = 180; const VW = 540; const VH = 234;
// viewBox="0 0 540 234"
```

データ準備:
```
1. masteredAt でソートした累積点列を作成
2. 先頭に「最初の日 - 1日、count=0」を追加（グラフ原点）
3. 末尾に「現在時刻、同count」を追加（今日まで線を引く）
```

座標変換:
```typescript
xScale(ms) = PAD.l + ((ms - xMin) / xRange) * CW
yScale(n)  = PAD.t + CH - (n / max) * CH
```

グリッド: Y軸 0/25/50/75/100% の5本。X軸ラベル最大5点（`M/D` 形式）。

### NavBar のアクティブ判定

```typescript
const isActive = (href: string) =>
  pathname === href || pathname.startsWith(href + '/');
// active: 'bg-sky-600 text-white'
// inactive: 'hover:bg-white/10'
```

### CsvImport のパースルール

```typescript
// 1行目: word のみ使用（CSV 1列目）
// スキップ条件:
//   - 空行
//   - /^(word|英単語|english|単語)$/i にマッチするヘッダー行
//   - /^[a-zA-Z]/ にマッチしない行
// インポート: 直列処理、各単語間に 300ms 待機（APIレート制限対策）
```

### スタイリング規則

```css
/* カラーパレット */
--bg-app: #1a3357;   /* ページ背景 */
--bg-nav: #0f2540;   /* ナビ背景 */

/* ステータスバッジ */
new:       bg-gray-100  text-gray-600
learning:  bg-yellow-100 text-yellow-700
mastered:  bg-green-100  text-green-700
```

最大幅: `max-w-2xl mx-auto px-4` で全ページ共通（672px）。

---

## 7. モバイル実装詳細

### ナビゲーション構造

```
app/_layout.tsx        → Stack (headerShown: false)
  └── (tabs)/_layout.tsx → Tabs（5タブ）
        ├── index.tsx      学習（graduation-cap アイコン）
        ├── add.tsx        単語追加（plus-circle）
        ├── words.tsx      単語一覧（list）
        ├── progress.tsx   進捗（bar-chart）
        └── settings.tsx   設定（cog）
```

タブバーのスタイル:
```typescript
tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' }
tabBarActiveTintColor: '#818cf8'
tabBarInactiveTintColor: '#64748b'
headerStyle: { backgroundColor: '#0f172a' }
```

### FlashCard アニメーション（Mobile）

CSS 3D transform 非対応のため opacity 切り替えで実装:

```typescript
const flipAnim = useRef(new Animated.Value(0)).current;

const frontOpacity = flipAnim.interpolate({
  inputRange: [0, 0.5, 1], outputRange: [1, 0, 0],
});
const backOpacity = flipAnim.interpolate({
  inputRange: [0, 0.5, 1], outputRange: [0, 0, 1],
});

function flip() {
  Animated.spring(flipAnim, {
    toValue: flipped ? 0 : 1,
    useNativeDriver: true,
  }).start();
  setFlipped(!flipped);
}
```

```tsx
<Animated.View style={[StyleSheet.absoluteFill, { opacity: frontOpacity }]}>
  {/* 表面 */}
</Animated.View>
<Animated.View style={[StyleSheet.absoluteFill, { opacity: backOpacity }]}>
  {/* 裏面 */}
</Animated.View>
```

### expo-speech（音声）

```typescript
import * as Speech from 'expo-speech';
Speech.speak(word, { language: 'en-US' });
```

### expo-crypto（UUID）

```typescript
import * as Crypto from 'expo-crypto';
id: Crypto.randomUUID(),
```

### react-native-svg（進捗グラフ）

```typescript
import { Svg, Line, Polyline, Circle, Text as SvgText, Path } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width - 32;
const PAD = { l: 40, r: 10, t: 10, b: 30 };
const CW = SCREEN_W - PAD.l - PAD.r;
const CH = 140;
// 座標計算ロジックは Web 版と同一
```

### DailyLimit の非同期パターン（Mobile）

```typescript
// index.tsx
const [dailyNewCount, setDailyNewCount] = useState(0);

useEffect(() => {
  getDailyNewCount().then(setDailyNewCount);
}, []);

async function handleResult(rating: Rating) {
  const wasNew = getSRSCard(currentWord).state === 'new';
  dispatch({ type: 'REVIEW_CARD', id: currentWord.id, rating });
  if (wasNew) {
    const next = await incrementDailyNewCount();
    setDailyNewCount(next);
  }
  // 次のカードを選択...
}
```

### iOS キーボード対応

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <TextInput ... />
</KeyboardAvoidingView>
```

---

## 8. プラットフォーム差異一覧

| 機能 | Web | Mobile |
|------|-----|--------|
| ストレージ | `localStorage`（同期） | `AsyncStorage`（非同期） |
| TTS | `window.speechSynthesis` | `expo-speech` |
| UUID生成 | `crypto.randomUUID()` | `Crypto.randomUUID()`（expo-crypto） |
| SVGグラフ | `<svg>` JSX | `react-native-svg` |
| カードフリップ | CSS rotateY | Animated.spring + opacity補間 |
| Tatoeba呼出し | `/api/examples` Route Handler 経由 | 直接呼び出し（CORS不要） |
| ナビゲーション | Next.js App Router | expo-router |
| スタイリング | Tailwind CSS v4 | StyleSheet.create / inline |
| テキスト入力 | `<input>` | `<TextInput>` |
| タップ操作 | `<button>` | `<TouchableOpacity>` / `<Pressable>` |
| 削除確認 | なし（即削除） | `Alert.alert()` |
| dailyLimit 戻り値 | `number`（同期） | `Promise<number>`（非同期） |

---

## 9. ストレージ設計

### キー一覧

| キー | 内容 | 型 |
|-----|------|----|
| `sprightly_words` | 単語リスト全体 | `WordEntry[]`（JSON） |
| `sprightly_settings` | ユーザー設定 | `Settings`（JSON） |
| `sprightly_daily` | 今日の新規カード数 | `{ date: string; newCount: number }`（JSON） |

### `sprightly_daily` のフォーマット

```typescript
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// date が今日と異なれば newCount=0 を返す（日付をまたいだ自動リセット）
```

---

## 10. デプロイ構成

### Web（Vercel）

- リポジトリ: `github.com/yamaguchi20090626-ship-it/sprightly_eitango`
- ブランチ: `main`
- ビルドコマンド: `npm run build`（Vercel 自動検出）
- 環境変数: なし

**重要制約**: Next.js 16 は `tsconfig.json` の `exclude` 設定に関わらず、プロジェクト直下の全 `.ts`/`.tsx` を TypeScript チェッカーに渡す。`mobile/` 配下の全ファイルに `// @ts-nocheck` が必要（`expo-router` 等が未インストールのため）。

git のリモートは2つ設定されている:
```bash
origin  → https://github.com/yamaguchi20090626-ship-it/sprightly.git
eitango → https://github.com/yamaguchi20090626-ship-it/sprightly_eitango.git
```
Vercel へのデプロイは `eitango` へのプッシュが必要:
```bash
git push eitango master:main
```

### Mobile（Expo）

- 開発: `cd mobile && npx expo start --tunnel`（iOS 実機はトンネル経由が安定）
- ビルド: EAS Build（`eas build --platform ios`）
- 設定ファイル: `mobile/app.json`
  - iOS Bundle ID: `com.yourname.sprightly`（App Store 申請時に変更要）
  - Android Package: `com.yourname.sprightly`

---

## 11. 既知の技術的負債

### 全件書き込みのパフォーマンス

`useEffect([words])` が words 変化のたびに全件を JSON シリアライズしてストレージに書く。500語超で顕在化する可能性がある。対策: 差分検知して変化があるときのみ書き込む。

### `study/page.tsx` の exhaustive-deps 抑制

```typescript
useEffect(() => { ... }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
```

`words` を deps に含めると無限ループするため一時回避。正しい修正は `useRef` で最新 words を参照するか `useCallback` でラップする。

### MyMemory 無料枠の上限

1日5,000文字。多数の例文翻訳でヒットする。エラー時は空文字列を返すだけでユーザーへの通知がない。

### CsvImport のキャンセル不可

300ms × N 語の直列処理にキャンセル手段がない。50語 = 最低15秒の待機が発生する。

### Mobile の `// @ts-nocheck`

モバイルファイル全体に型チェックが効かない状態。Vercel の TypeScript スキャン回避のための暫定措置。根本解決策: Next.js プロジェクトルートから `mobile/` を物理的に分離する（別ディレクトリ配置または submodule 化）。
