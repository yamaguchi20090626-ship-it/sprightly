import type { WordEntry } from '@/types/word';

const KEY = 'sprightly_words';

export function loadWords(): WordEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveWords(words: WordEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(words));
}
