// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sprightly_daily';

interface DailyRecord {
  date: string;
  newCount: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getDailyNewCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return 0;
    const rec: DailyRecord = JSON.parse(raw);
    return rec.date === todayStr() ? rec.newCount : 0;
  } catch {
    return 0;
  }
}

export async function incrementDailyNewCount(): Promise<number> {
  const next = (await getDailyNewCount()) + 1;
  await AsyncStorage.setItem(KEY, JSON.stringify({ date: todayStr(), newCount: next }));
  return next;
}

