// @ts-nocheck
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { WordEntry, Status } from '../types/word';
import { reviewCard, getSRSCard, type Rating } from '../lib/srs';
import { supabase, toRow, fromRow } from '../lib/supabase';
import { useAuth } from './AuthContext';

type Action =
  | { type: 'LOAD_WORDS'; words: WordEntry[] }
  | { type: 'ADD_WORD'; word: WordEntry }
  | { type: 'REVIEW_CARD'; id: string; rating: Rating }
  | { type: 'UPDATE_NOTE'; id: string; note: string }
  | { type: 'DELETE_WORD'; id: string };

function srsStateToStatus(srsState: 'new' | 'learning' | 'review'): Status {
  if (srsState === 'review') return 'mastered';
  if (srsState === 'learning') return 'learning';
  return 'new';
}

function reducer(state: WordEntry[], action: Action): WordEntry[] {
  switch (action.type) {
    case 'LOAD_WORDS':
      return action.words;
    case 'ADD_WORD':
      return [...state, action.word];
    case 'REVIEW_CARD': {
      const now = Date.now();
      return state.map((w) => {
        if (w.id !== action.id) return w;
        const card = getSRSCard(w);
        const next = reviewCard(card, action.rating, now);
        const isCorrect = action.rating === 'good' || action.rating === 'easy';
        const newStatus = srsStateToStatus(next.state);
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
    case 'UPDATE_NOTE':
      return state.map((w) => (w.id === action.id ? { ...w, note: action.note } : w));
    case 'DELETE_WORD':
      return state.filter((w) => w.id !== action.id);
  }
}

const WordContext = createContext<WordEntry[]>([]);
const WordDispatchContext = createContext<Dispatch<Action>>(() => {});

export function WordProvider({ children }: { children: ReactNode }) {
  const [words, dispatch] = useReducer(reducer, []);
  const { user } = useAuth();
  const wordsRef = useRef(words);
  wordsRef.current = words;

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'LOAD_WORDS', words: [] });
      return;
    }
    supabase
      .from('words')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        dispatch({ type: 'LOAD_WORDS', words: (data ?? []).map(fromRow) });
      });
  }, [user?.id]);

  const supabaseDispatch: Dispatch<Action> = (action) => {
    if (!user) { dispatch(action); return; }

    if (action.type === 'ADD_WORD') {
      dispatch(action);
      supabase.from('words').insert(toRow(action.word, user.id)).then();
      return;
    }

    if (action.type === 'DELETE_WORD') {
      dispatch(action);
      supabase.from('words').delete().eq('id', action.id).eq('user_id', user.id).then();
      return;
    }

    if (action.type === 'REVIEW_CARD') {
      const word = wordsRef.current.find(w => w.id === action.id);
      if (word) {
        const card = getSRSCard(word);
        const now = Date.now();
        const next = reviewCard(card, action.rating, now);
        const isCorrect = action.rating === 'good' || action.rating === 'easy';
        const newStatus = srsStateToStatus(next.state);
        supabase.from('words').update({
          status: newStatus,
          srs_state: next.state,
          srs_interval: next.interval,
          srs_ease_factor: next.easeFactor,
          srs_due: next.due,
          srs_step: next.step,
          study_count: word.studyCount + 1,
          correct_count: word.correctCount + (isCorrect ? 1 : 0),
          last_studied_at: now,
          mastered_at: newStatus === 'mastered' && !word.masteredAt ? now : (word.masteredAt ?? null),
        }).eq('id', action.id).eq('user_id', user.id).then();
      }
      dispatch(action);
      return;
    }

    if (action.type === 'UPDATE_NOTE') {
      dispatch(action);
      supabase.from('words').update({ note: action.note }).eq('id', action.id).eq('user_id', user.id).then();
      return;
    }

    dispatch(action);
  };

  return (
    <WordContext.Provider value={words}>
      <WordDispatchContext.Provider value={supabaseDispatch}>
        {children}
      </WordDispatchContext.Provider>
    </WordContext.Provider>
  );
}

export function useWords() {
  return useContext(WordContext);
}

export function useWordDispatch() {
  return useContext(WordDispatchContext);
}
