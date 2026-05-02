export type Status = 'new' | 'learning' | 'mastered';

export interface Definition {
  definition: string;
  example?: string;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms: string[];
}

export interface WordEntry {
  id: string;
  word: string;
  phonetic?: string;
  meanings: Meaning[];
  status: Status;
  addedAt: number;
  lastStudiedAt?: number;
  masteredAt?: number;
  studyCount: number;
  correctCount: number;
  srsState?: 'new' | 'learning' | 'review';
  srsInterval?: number;
  srsEaseFactor?: number;
  srsDue?: number;
  srsStep?: number;
  note?: string;
}
