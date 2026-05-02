'use client';

import { useState, useEffect } from 'react';
import FlashCard from '@/components/FlashCard';
import { useWords, useWordDispatch } from '@/context/WordContext';
import { useSettings } from '@/context/SettingsContext';
import { pickNextWord, nextDueMs, getSRSCard } from '@/lib/srs';
import { getDailyNewCount, incrementDailyNewCount } from '@/lib/dailyLimit';
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
  const [current, setCurrent] = useState<WordEntry | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [dailyNewCount, setDailyNewCount] = useState(() => getDailyNewCount());
  const [tick, setTick] = useState(0);

  const newLimitReached = dailyNewCount >= newCardsPerDay;

  // Pick initial card when words load, or when current becomes null
  useEffect(() => {
    if (words.length > 0 && current === null) {
      setCurrent(pickNextWord(words, Date.now(), { skipNew: newLimitReached }));
    }
  }, [words, current, newLimitReached]);

  // Auto-refresh every 10 seconds so learning cards appear when they become due
  useEffect(() => {
    if (current !== null) return;
    const id = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [current]);

  useEffect(() => {
    if (current === null && words.length > 0) {
      setCurrent(pickNextWord(words, Date.now(), { skipNew: newLimitReached }));
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResult(rating: Rating) {
    if (!current) return;
    const wasNew = getSRSCard(current).state === 'new';
    dispatch({ type: 'REVIEW_CARD', id: current.id, rating });

    let nextDailyCount = dailyNewCount;
    if (wasNew) {
      nextDailyCount = incrementDailyNewCount();
      setDailyNewCount(nextDailyCount);
    }

    setSessionCount((n) => n + 1);
    const next = pickNextWord(
      words.filter((w) => w.id !== current.id),
      Date.now(),
      { skipNew: nextDailyCount >= newCardsPerDay },
    );
    setCurrent(next);
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

    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-2xl text-white font-semibold">今日の学習は完了！</p>
        {newLimitReached && (
          <p className="text-amber-200 text-sm">
            本日の新規出題上限（{newCardsPerDay}語）に達しました
          </p>
        )}
        {countdown ? (
          <>
            <p className="text-slate-300 text-sm">次のカードは{countdown}届きます</p>
            <button
              onClick={() => setCurrent(pickNextWord(words, Date.now(), { skipNew: newLimitReached }))}
              className="mt-4 inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              今すぐ確認
            </button>
          </>
        ) : (
          <p className="text-slate-300 text-sm">全ての単語を復習しました。</p>
        )}
      </div>
    );
  }

  const now = Date.now();
  const dueCount = words.filter((w) => getSRSCard(w).due <= now).length;
  const stats = {
    new: words.filter((w) => w.status === 'new').length,
    learning: words.filter((w) => w.status === 'learning').length,
    mastered: words.filter((w) => w.status === 'mastered').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center text-xs text-slate-300">
        <span>このセッション: {sessionCount}問</span>
        <span className="flex items-center gap-2">
          <span>未 {stats.new} / 学習中 {stats.learning} / 習得 {stats.mastered}</span>
          {dueCount > 0 && <span className="text-amber-200">期限{dueCount}件</span>}
          <span className="text-slate-400">
            新規 {dailyNewCount}/{newCardsPerDay}
          </span>
        </span>
      </div>

      <FlashCard key={current.id} word={current} onResult={handleResult} />
    </div>
  );
}
