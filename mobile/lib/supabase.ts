// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WordEntry } from '../types/word';

const SUPABASE_URL = 'https://yeewmkwyepgapkjqcbmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YCy1D8EcyKMWBJ9063tSHg_GO_fVXmq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
  };
}

export function fromRow(row: any): WordEntry {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? undefined,
    meanings: row.meanings,
    status: row.status,
    addedAt: row.added_at,
    lastStudiedAt: row.last_studied_at ?? undefined,
    masteredAt: row.mastered_at ?? undefined,
    studyCount: row.study_count,
    correctCount: row.correct_count,
    srsState: row.srs_state ?? undefined,
    srsInterval: row.srs_interval ?? undefined,
    srsEaseFactor: row.srs_ease_factor ?? undefined,
    srsDue: row.srs_due ?? undefined,
    srsStep: row.srs_step ?? undefined,
    note: row.note ?? undefined,
  };
}
