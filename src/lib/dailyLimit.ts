const KEY = 'sprightly_daily';
const ADD_KEY = 'sprightly_daily_add';

interface DailyRecord {
  date: string;   // 'YYYY-MM-DD'
  newCount: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailyNewCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const rec: DailyRecord = JSON.parse(raw);
    return rec.date === todayStr() ? rec.newCount : 0;
  } catch {
    return 0;
  }
}

/** カウントを +1 して新しい値を返す */
export function incrementDailyNewCount(): number {
  const next = getDailyNewCount() + 1;
  localStorage.setItem(KEY, JSON.stringify({ date: todayStr(), newCount: next }));
  return next;
}

export const DAILY_ADD_LIMIT = 20;

export function getDailyAddCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(ADD_KEY);
    if (!raw) return 0;
    const rec: DailyRecord = JSON.parse(raw);
    return rec.date === todayStr() ? rec.newCount : 0;
  } catch {
    return 0;
  }
}

export function incrementDailyAddCount(): number {
  const next = getDailyAddCount() + 1;
  localStorage.setItem(ADD_KEY, JSON.stringify({ date: todayStr(), newCount: next }));
  return next;
}
