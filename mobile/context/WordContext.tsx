// @ts-nocheck
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WordEntry, Status } from '../types/word';
import { reviewCard, getSRSCard, type Rating } from '../lib/srs';

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

const STORAGE_KEY = 'sprightly_words';

const WordContext = createContext<WordEntry[]>([]);
const WordDispatchContext = createContext<Dispatch<Action>>(() => {});

export function WordProvider({ children }: { children: ReactNode }) {
  const [words, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) dispatch({ type: 'LOAD_WORDS', words: JSON.parse(raw) });
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  }, [words]);

  return (
    <WordContext.Provider value={words}>
      <WordDispatchContext.Provider value={dispatch}>
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

