import { describe, it, expect } from 'vitest';
import { reviewCard, type SRSCard } from '../lib/srs';

// Deterministic rng: fuzz factor = 1 + (0.5 * 0.1 - 0.05) = 1.0
// So applyFuzz(x) = Math.max(1, Math.ceil(x))
const rng = () => 0.5;
const NOW = 1_000_000_000_000; // fixed timestamp

function card(overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    interval: 10,
    easeFactor: 2.5,
    due: 0,
    state: 'review',
    step: 0,
    ...overrides,
  };
}

// ─── Learning phase ────────────────────────────────────────────────────────

describe('learning phase', () => {
  it('Again → resets to step 0, due in 1 minute', () => {
    const result = reviewCard(card({ state: 'new', step: 2 }), 'again', NOW, rng);
    expect(result.state).toBe('learning');
    expect(result.step).toBe(0);
    expect(result.due).toBe(NOW + 60_000);
  });

  it('Hard → stays on same step', () => {
    const result = reviewCard(card({ state: 'learning', step: 1 }), 'hard', NOW, rng);
    expect(result.state).toBe('learning');
    expect(result.step).toBe(1);
    expect(result.due).toBe(NOW + 10 * 60_000);
  });

  it('Good → advances to next step', () => {
    const result = reviewCard(card({ state: 'new', step: 0 }), 'good', NOW, rng);
    expect(result.state).toBe('learning');
    expect(result.step).toBe(1);
    expect(result.due).toBe(NOW + 10 * 60_000);
  });

  it('Good on last step → graduates to review with interval ≥ 1', () => {
    const result = reviewCard(card({ state: 'learning', step: 2, interval: 0 }), 'good', NOW, rng);
    expect(result.state).toBe('review');
    expect(result.interval).toBeGreaterThanOrEqual(1);
    expect(result.due).toBeGreaterThan(NOW);
  });

  it('Easy → skips directly to review with 4-day interval', () => {
    const result = reviewCard(card({ state: 'new', step: 0 }), 'easy', NOW, rng);
    expect(result.state).toBe('review');
    expect(result.interval).toBe(4); // Math.ceil(4 * 1.0)
    expect(result.due).toBeGreaterThan(NOW);
  });
});

// ─── Review phase ──────────────────────────────────────────────────────────

describe('review phase', () => {
  it('Again → returns to learning, interval resets to 1', () => {
    const result = reviewCard(card({ interval: 20, easeFactor: 2.5 }), 'again', NOW, rng);
    expect(result.state).toBe('learning');
    expect(result.step).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.due).toBe(NOW + 60_000); // 1 minute
  });

  it('Hard → interval = ceil(interval * 1.2)', () => {
    const result = reviewCard(card({ interval: 10, easeFactor: 2.5 }), 'hard', NOW, rng);
    expect(result.interval).toBe(Math.ceil(10 * 1.2)); // 12
    expect(result.state).toBe('review');
    expect(result.due).toBeGreaterThan(NOW);
  });

  it('Good → interval = ceil(interval * easeFactor)', () => {
    const result = reviewCard(card({ interval: 10, easeFactor: 2.5 }), 'good', NOW, rng);
    expect(result.interval).toBe(Math.ceil(10 * 2.5)); // 25
    expect(result.state).toBe('review');
    expect(result.due).toBeGreaterThan(NOW);
  });

  it('Easy → interval = ceil(interval * easeFactor * 1.3), easeFactor increases', () => {
    const result = reviewCard(card({ interval: 10, easeFactor: 2.5 }), 'easy', NOW, rng);
    expect(result.interval).toBe(Math.ceil(10 * 2.5 * 1.3)); // 33
    expect(result.easeFactor).toBeCloseTo(2.6);
    expect(result.state).toBe('review');
  });

  it('Hard → easeFactor decreases by 0.15', () => {
    const result = reviewCard(card({ easeFactor: 2.5 }), 'hard', NOW, rng);
    expect(result.easeFactor).toBeCloseTo(2.35);
  });

  it('Again → easeFactor decreases by 0.2', () => {
    const result = reviewCard(card({ easeFactor: 2.5 }), 'again', NOW, rng);
    expect(result.easeFactor).toBeCloseTo(2.3);
  });
});

// ─── Common rules ──────────────────────────────────────────────────────────

describe('common rules', () => {
  it('easeFactor never drops below 1.3 on Again', () => {
    const result = reviewCard(card({ easeFactor: 1.3 }), 'again', NOW, rng);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('easeFactor never drops below 1.3 on Hard', () => {
    const result = reviewCard(card({ easeFactor: 1.35 }), 'hard', NOW, rng);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('interval is always ≥ 1 after Good', () => {
    const result = reviewCard(card({ interval: 0, easeFactor: 1.3 }), 'good', NOW, rng);
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });

  it('due is always in the future for review ratings', () => {
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      const result = reviewCard(card(), rating, NOW, rng);
      expect(result.due).toBeGreaterThan(NOW);
    }
  });

  it('due is always in the future for learning ratings', () => {
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      const result = reviewCard(card({ state: 'learning', step: 0 }), rating, NOW, rng);
      expect(result.due).toBeGreaterThan(NOW);
    }
  });

  it('fuzz keeps interval within ±5% of expected', () => {
    // Use real Math.random, run many times, check range
    const base = 10 * 2.5; // Good: interval * easeFactor = 25
    for (let i = 0; i < 200; i++) {
      const result = reviewCard(card({ interval: 10, easeFactor: 2.5 }), 'good', NOW);
      expect(result.interval).toBeGreaterThanOrEqual(Math.ceil(base * 0.95));
      expect(result.interval).toBeLessThanOrEqual(Math.ceil(base * 1.05));
    }
  });

  it('card object is not mutated', () => {
    const original = card();
    const snapshot = { ...original };
    reviewCard(original, 'good', NOW, rng);
    expect(original).toEqual(snapshot);
  });
});
