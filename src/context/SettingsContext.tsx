'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';

export type FontSize = 'sm' | 'md' | 'lg';

export interface Settings {
  goalCount: number;
  fontSize: FontSize;
  newCardsPerDay: number;
}

type Action =
  | { type: 'LOAD'; settings: Settings }
  | { type: 'SET_GOAL'; count: number }
  | { type: 'SET_FONT_SIZE'; size: FontSize }
  | { type: 'SET_NEW_CARDS_PER_DAY'; count: number };

const DEFAULT: Settings = { goalCount: 100, fontSize: 'md', newCardsPerDay: 20 };
const KEY = 'sprightly_settings';

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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) dispatch({ type: 'LOAD', settings: JSON.parse(stored) });
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  return (
    <SettingsContext.Provider value={settings}>
      <SettingsDispatchContext.Provider value={dispatch}>
        {children}
      </SettingsDispatchContext.Provider>
    </SettingsContext.Provider>
  );
}
