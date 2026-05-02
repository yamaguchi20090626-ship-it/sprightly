import type { WordEntry } from '@/types/word';

// ─── Core SRS types ────────────────────────────────────────────────────────

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type SRSState = 'new' | 'learning' | 'review';

export interface SRSCard {
  /** Days until next review (0 for cards not yet in review) */
  interval: number;
  /** Multiplier for interval growth. Range [1.3, ∞), default 2.5 */
  easeFactor: number;
  /** Unix timestamp (ms) when this card is next due */
  due: number;
  state: SRSState;
  /** Index into STEPS_MS for the learning phase (0–2) */
  step: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;
const GRADUATING_INTERVAL = 1; // days: Good graduation from last learning step
const EASY_INTERVAL = 4;       // days: Easy graduation from any learning step

/** Due-time offsets for each learning step */
const STEPS_MS = [
  1 * 60 * 1_000,        // Step 0 → 1 minute
  10 * 60 * 1_000,       // Step 1 → 10 minutes
  24 * 60 * 60 * 1_000,  // Step 2 → 1 day → graduate
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────

const clampEase = (e: number): number => Math.max(MIN_EASE, e);
const daysMs = (days: number): number => Math.round(days * 86_400_000);

/**
 * Apply ±5% random fuzz to an interval and ceil to integer days.
 * Pass a custom `rng` for deterministic testing.
 */
function applyFuzz(interval: number, rng: () => number): number {
  const factor = 1 + (rng() * 0.1 - 0.05);
  return Math.max(1, Math.ceil(interval * factor));
}

// ─── Pure review function ──────────────────────────────────────────────────

/**
 * Compute the next card state after a rating.
 *
 * @param card  Current card state (treated as immutable)
 * @param rating  User's self-assessment
 * @param now  Current Unix timestamp in ms (Date.now())
 * @param rng  Random number source – override in tests for determinism
 * @returns  New card state (no mutation of input)
 */
export function reviewCard(
  card: SRSCard,
  rating: Rating,
  now: number,
  rng: () => number = Math.random,
): SRSCard {
  return card.state === 'review'
    ? handleReview(card, rating, now, rng)
    : handleLearning(card, rating, now, rng);
}

// ── Learning phase ─────────────────────────────────────────────────────────

function handleLearning(
  card: SRSCard,
  rating: Rating,
  now: number,
  rng: () => number,
): SRSCard {
  const { step } = card;

  switch (rating) {
    case 'again':
      // Restart from step 0
      return { ...card, state: 'learning', step: 0, due: now + STEPS_MS[0] };

    case 'hard':
      // Repeat the current step
      return { ...card, state: 'learning', step, due: now + STEPS_MS[step] };

    case 'good': {
      const next = step + 1;
      if (next >= STEPS_MS.length) {
        // Last step complete → graduate to review
        const base = card.interval > 0 ? card.interval : GRADUATING_INTERVAL;
        const interval = applyFuzz(base, rng);
        return { ...card, state: 'review', step: 0, interval, due: now + daysMs(interval) };
      }
      return { ...card, state: 'learning', step: next, due: now + STEPS_MS[next] };
    }

    case 'easy': {
      // Skip directly to review
      const interval = applyFuzz(EASY_INTERVAL, rng);
      return { ...card, state: 'review', step: 0, interval, due: now + daysMs(interval) };
    }
  }
}

// ── Review phase ───────────────────────────────────────────────────────────

function handleReview(
  card: SRSCard,
  rating: Rating,
  now: number,
  rng: () => number,
): SRSCard {
  switch (rating) {
    case 'again':
      // Lapse: return to learning, penalise ease
      return {
        ...card,
        state: 'learning',
        step: 0,
        interval: 1,
        easeFactor: clampEase(card.easeFactor - 0.2),
        due: now + STEPS_MS[0],
      };

    case 'hard': {
      const interval = applyFuzz(card.interval * 1.2, rng);
      return {
        ...card,
        interval,
        easeFactor: clampEase(card.easeFactor - 0.15),
        due: now + daysMs(interval),
      };
    }

    case 'good': {
      const interval = applyFuzz(card.interval * card.easeFactor, rng);
      return { ...card, interval, due: now + daysMs(interval) };
    }

    case 'easy': {
      const interval = applyFuzz(card.interval * card.easeFactor * 1.3, rng);
      return {
        ...card,
        interval,
        easeFactor: card.easeFactor + 0.1,
        due: now + daysMs(interval),
      };
    }
  }
}

// ─── App-level helpers ─────────────────────────────────────────────────────

/** Extract SRS state from a WordEntry, migrating legacy data gracefully */
export function getSRSCard(word: WordEntry): SRSCard {
  const defaultState: SRSState =
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

/**
 * Pick the highest-priority due card.
 * Priority: learning > new > review
 */
export function pickNextWord(
  words: WordEntry[],
  now: number = Date.now(),
  opts: { skipNew?: boolean } = {},
): WordEntry | null {
  const due = words.filter((w) => getSRSCard(w).due <= now);
  if (!due.length) return null;

  for (const targetState of ['learning', 'new', 'review'] as SRSState[]) {
    if (targetState === 'new' && opts.skipNew) continue;
    const pool = due.filter((w) => getSRSCard(w).state === targetState);
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

/** Returns the earliest future due timestamp, or null if none */
export function nextDueMs(words: WordEntry[], now: number = Date.now()): number | null {
  const future = words.map((w) => getSRSCard(w).due).filter((d) => d > now);
  return future.length ? Math.min(...future) : null;
}
