import { createClient } from '@supabase/supabase-js';
import type { WordEntry } from '../types/word';

const SUPABASE_URL = 'https://yeewmkwyepgapkjqcbmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YCy1D8EcyKMWBJ9063tSHg_GO_fVXmq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function toRow(word: WordEntry, userId: string) {
  return {
    id: word.id,
    user_id: userId,
    word: word.word,
    phonetic: word.phonetic ?? null,
    meanings: word.meanings,
    status: word.status,
    added_at: word.addedAt,
    last_studied_at: word.lastStudiedAt ?? null,
    mastered_at: word.masteredAt ?? null,
    study_count: word.studyCount,
    correct_count: word.correctCount,
    srs_state: word.srsState ?? null,
    srs_interval: word.srsInterval ?? null,
    srs_ease_factor: word.srsEaseFactor ?? null,
    srs_due: word.srsDue ?? null,
    srs_step: word.srsStep ?? null,
    note: word.note ?? null,
    note_images: word.noteImages ?? [],
  };
}

export function fromRow(row: Record<string, unknown>): WordEntry {
  return {
    id: row.id as string,
    word: row.word as string,
    phonetic: (row.phonetic as string | null) ?? undefined,
    meanings: row.meanings as WordEntry['meanings'],
    status: row.status as WordEntry['status'],
    addedAt: row.added_at as number,
    lastStudiedAt: (row.last_studied_at as number | null) ?? undefined,
    masteredAt: (row.mastered_at as number | null) ?? undefined,
    studyCount: row.study_count as number,
    correctCount: row.correct_count as number,
    srsState: (row.srs_state as WordEntry['srsState']) ?? undefined,
    srsInterval: (row.srs_interval as number | null) ?? undefined,
    srsEaseFactor: (row.srs_ease_factor as number | null) ?? undefined,
    srsDue: (row.srs_due as number | null) ?? undefined,
    srsStep: (row.srs_step as number | null) ?? undefined,
    note: (row.note as string | null) ?? undefined,
    noteImages: (row.note_images as string[] | null) ?? [],
  };
}
