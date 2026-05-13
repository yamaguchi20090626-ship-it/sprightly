import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wordpocket_streak';

interface StreakData {
  count: number;
  lastDate: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getStreak(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastDate: '' };
}

export async function updateStreak(): Promise<StreakData> {
  const t = today();
  const data = await getStreak();
  if (data.lastDate === t) return data;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const newData: StreakData = {
    count: data.lastDate === yStr ? data.count + 1 : 1,
    lastDate: t,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(newData));
  return newData;
}
