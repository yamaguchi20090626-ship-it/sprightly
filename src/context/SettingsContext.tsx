'use client';
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type FontSize = 'sm' | 'md' | 'lg';

export interface Settings {
  goalCount: number;
  fontSize: FontSize;
  newCardsPerDay: number;
}

type Action =
  | { type: 'LOAD'; settings: Partial<Settings> }
  | { type: 'SET_GOAL'; count: number }
  | { type: 'SET_FONT_SIZE'; size: FontSize }
  | { type: 'SET_NEW_CARDS_PER_DAY'; count: number };

const DEFAULT: Settings = { goalCount: 100, fontSize: 'md', newCardsPerDay: 20 };

function reducer(state: Settings, action: Action): Settings {
  switch (action.type) {
    case 'LOAD':
      return { ...DEFAULT, ...action.settings };
    case 'SET_GOAL':
      return { ...state, goalCount: Math.max(1, action.count) };
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.size };
    case 'SET_NEW_CARDS_PER_DAY':
      return { ...state, newCardsPerDay: Math.max(1, action.count) };
    default:
      return state;
  }
}

const SettingsContext = createContext<Settings>(DEFAULT);
const SettingsDispatchContext = createContext<Dispatch<Action>>(() => {});

export function useSettings() {
  return useContext(SettingsContext);
}

export function useSettingsDispatch() {
  return useContext(SettingsDispatchContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, dispatch] = useReducer(reducer, DEFAULT);
  const { user } = useAuth();
  const loadedRef = useRef<Settings | null>(null);

  useEffect(() => {
    if (!user) {
      loadedRef.current = null;
      dispatch({ type: 'LOAD', settings: DEFAULT });
      return;
    }
    supabase.from('settings').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) {
        const loaded: Settings = {
          goalCount: data.goal_count,
          fontSize: data.font_size as FontSize,
          newCardsPerDay: data.new_cards_per_day,
        };
        loadedRef.current = loaded;
        dispatch({ type: 'LOAD', settings: loaded });
      } else {
        loadedRef.current = DEFAULT;
        supabase.from('settings').insert({
          user_id: user.id,
          goal_count: DEFAULT.goalCount,
          font_size: DEFAULT.fontSize,
          new_cards_per_day: DEFAULT.newCardsPerDay,
        }).then();
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user || !loadedRef.current) return;
    const l = loadedRef.current;
    if (settings.goalCount === l.goalCount && settings.fontSize === l.fontSize && settings.newCardsPerDay === l.newCardsPerDay) return;
    loadedRef.current = settings;
    supabase.from('settings').upsert({
      user_id: user.id,
      goal_count: settings.goalCount,
      font_size: settings.fontSize,
      new_cards_per_day: settings.newCardsPerDay,
    }).then();
  }, [settings, user?.id]);

  return (
    <SettingsContext.Provider value={settings}>
      <SettingsDispatchContext.Provider value={dispatch}>
        {children}
      </SettingsDispatchContext.Provider>
    </SettingsContext.Provider>
  );
}
