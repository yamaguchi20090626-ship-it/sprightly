'use client';

import { useState, useEffect } from 'react';
import FlashCard from '@/components/FlashCard';
import { useWords, useWordDispatch } from '@/context/WordContext';
import { useSettings } from '@/context/SettingsContext';
import { pickNextWord, nextDueMs, getSRSCard } from '@/lib/srs';
import { getDailyNewCount, incrementDailyNewCount } from '@/lib/dailyLimit';
import { getStreak, updateStreak } from '@/lib/streak';
import type { Rating } from '@/lib/srs';
import type { WordEntry } from '@/types/word';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '間もなく';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes}分後`;
  const hours = Math.ceil(ms / 3_600_000);
  return `${hours}時間後`;
}

export default function StudyPage() {
  const words = useWords();
  const dispatch = useWordDispatch();
  const { newCardsPerDay } = useSettings();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = currentId ? (words.find(w => w.id === currentId) ?? null) : null;
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [dailyNewCount, setDailyNewCount] = useState(() => getDailyNewCount());
  const [tick, setTick] = useState(0);
  const [streak, setStreak] = useState(0);
  const [streakUpdated, setStreakUpdated] = useState(false);

  const newLimitReached = dailyNewCount >= newCardsPerDay;

  useEffect(() => {
    setStreak(getStreak().count);
  }, []);

  useEffect(() => {
    if (words.length > 0 && currentId === null) {
      const next = pickNextWord(words, Date.now(), { skipNew: newLimitReached });
      setCurrentId(next?.id ?? null);
    }
  }, [words, currentId, newLimitReached]);

  useEffect(() => {
    if (currentId !== null) return;
    const id = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [currentId]);

  useEffect(() => {
    if (currentId === null && words.length > 0) {
      const next = pickNextWord(words, Date.now(), { skipNew: newLimitReached });
      setCurrentId(next?.id ?? null);
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResult(rating: Rating) {
    if (!current) return;

    if (!streakUpdated) {
      const updated = updateStreak();
      setStreak(updated.count);
      setStreakUpdated(true);
    }

    const wasNew = getSRSCard(current).state === 'new';
    dispatch({ type: 'REVIEW_CARD', id: current.id, rating });

    let nextDailyCount = dailyNewCount;
    if (wasNew) {
      nextDailyCount = incrementDailyNewCount();
      setDailyNewCount(nextDailyCount);
    }

    setSessionCount((n) => n + 1);
    if (rating !== 'again') setSessionCorrect((n) => n + 1);

    const next = pickNextWord(
      words.filter((w) => w.id !== current.id),
      Date.now(),
      { skipNew: nextDailyCount >= newCardsPerDay },
    );
    setCurrentId(next?.id ?? null);
  }

  if (!words.length) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-300 text-sm mb-4">学習する単語がありません。</p>
        <a
          href="/add"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          単語を追加する
        </a>
      </div>
    );
  }

  if (!current) {
    const nextMs = nextDueMs(words, Date.now());
    const countdown = nextMs ? formatCountdown(nextMs - Date.now()) : null;
    const correctRate = sessionCount > 0 ? Math.round((sessionCorrect / sessionCount) * 100) : null;

    return (
      <div className="flex flex-col items-center py-16 space-y-6">
        <div className="text-6xl">🎉</div>
        <p className="text-2xl text-white font-bold">今日の学習完了！</p>

        {streak > 0 && (
          <div className="flex items-center gap-2 bg-orange-500/20 text-orange-300 px-5 py-2.5 rounded-full">
            <span className="text-xl">🔥</span>
            <span className="font-bold text-lg">{streak}日連続</span>
          </div>
        )}

        {sessionCount > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-300">{sessionCount}</p>
              <p className="text-xs text-slate-300 mt-1">回答数</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{correctRate}%</p>
              <p className="text-xs text-slate-300 mt-1">正解率</p>
            </div>
          </div>
        )}

        {newLimitReached && (
          <p className="text-amber-200 text-sm text-center">
            本日の新規出題上限（{newCardsPerDay}語）に達しました
          </p>
        )}

        {countdown ? (
          <div className="text-center space-y-3">
            <p className="text-slate-300 text-sm">間違えたカードが{countdown}に再出題されます</p>
            <button
              onClick={() => {
                const next = nextDueMs(words, Date.now());
                setCurrentId(pickNextWord(words, next ?? Date.now(), { skipNew: newLimitReached })?.id ?? null);
              }}
              className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              今すぐ確認
            </button>
          </div>
        ) : (
          <p className="text-slate-300 text-sm">全ての単語を復習しました。</p>
        )}

        <a
          href="/add"
          className="text-sm text-indigo-300 hover:text-indigo-100 underline transition-colors"
        >
          単語を追加する
        </a>
      </div>
    );
  }

  const now = Date.now();
  const remaining = words.filter((w) =>
    w.id !== currentId &&
    getSRSCard(w).due <= now &&
    (!newLimitReached || getSRSCard(w).state !== 'new')
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex justify-end items-center text-xs text-slate-300">
        <span className="text-amber-200 font-medium">残り{remaining}問</span>
      </div>

      <FlashCard key={current.id} word={current} onResult={handleResult} />
    </div>
  );
}
