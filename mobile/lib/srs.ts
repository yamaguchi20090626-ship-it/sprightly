// @ts-nocheck
import type { WordEntry } from '../types/word';

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type SRSState = 'new' | 'learning' | 'review';

export interface SRSCard {
  interval: number;
  easeFactor: number;
  due: number;
  state: SRSState;
  step: number;
}

const MIN_EASE = 1.3;
const INITIAL_EASE = 2.5;
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;

const STEPS_MS = [
  1 * 60 * 1_000,
  10 * 60 * 1_000,
  24 * 60 * 60 * 1_000,
] as const;

const clampEase = (e: number): number => Math.max(MIN_EASE, e);
const daysMs = (days: number): number => Math.round(days * 86_400_000);

function applyFuzz(interval: number, rng: () => number): number {
  const factor = 1 + (rng() * 0.1 - 0.05);
  return Math.max(1, Math.ceil(interval * factor));
}

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

function handleLearning(card: SRSCard, rating: Rating, now: number, rng: () => number): SRSCard {
  const { step } = card;
  switch (rating) {
    case 'again':
      return { ...card, state: 'learning', step: 0, due: now + STEPS_MS[0] };
    case 'hard':
      return { ...card, state: 'learning', step, due: now + STEPS_MS[step] };
    case 'good': {
      const next = step + 1;
      if (next >= STEPS_MS.length) {
        const base = card.interval > 0 ? card.interval : GRADUATING_INTERVAL;
        const interval = applyFuzz(base, rng);
        return { ...card, state: 'review', step: 0, interval, due: now + daysMs(interval) };
      }
      return { ...card, state: 'learning', step: next, due: now + STEPS_MS[next] };
    }
    case 'easy': {
      const interval = applyFuzz(EASY_INTERVAL, rng);
      return { ...card, state: 'review', step: 0, interval, due: now + daysMs(interval) };
    }
  }
}

function handleReview(card: SRSCard, rating: Rating, now: number, rng: () => number): SRSCard {
  switch (rating) {
    case 'again':
      return { ...card, state: 'learning', step: 0, interval: 1, easeFactor: clampEase(card.easeFactor - 0.2), due: now + STEPS_MS[0] };
    case 'hard': {
      const interval = applyFuzz(card.interval * 1.2, rng);
      return { ...card, interval, easeFactor: clampEase(card.easeFactor - 0.15), due: now + daysMs(interval) };
    }
    case 'good': {
      const interval = applyFuzz(card.interval * card.easeFactor, rng);
      return { ...card, interval, due: now + daysMs(interval) };
    }
    case 'easy': {
      const interval = applyFuzz(card.interval * card.easeFactor * 1.3, rng);
      return { ...card, interval, easeFactor: card.easeFactor + 0.1, due: now + daysMs(interval) };
    }
  }
}

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

export function nextDueMs(words: WordEntry[], now: number = Date.now()): number | null {
  const future = words.map((w) => getSRSCard(w).due).filter((d) => d > now);
  return future.length ? Math.min(...future) : null;
}

