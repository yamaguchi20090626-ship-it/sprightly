const KEY = 'wordpocket_streak';

interface StreakData {
  count: number;
  lastDate: string; // YYYY-MM-DD
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getStreak(): StreakData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastDate: '' };
}

export function updateStreak(): StreakData {
  const t = today();
  const data = getStreak();
  if (data.lastDate === t) return data;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const newData: StreakData = {
    count: data.lastDate === yStr ? data.count + 1 : 1,
    lastDate: t,
  };
  localStorage.setItem(KEY, JSON.stringify(newData));
  return newData;
}
