// @ts-nocheck
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import FlashCard from '../../components/FlashCard';
import { useWords, useWordDispatch } from '../../context/WordContext';
import { useSettings } from '../../context/SettingsContext';
import { pickNextWord, nextDueMs, getSRSCard } from '../../lib/srs';
import { getDailyNewCount, incrementDailyNewCount } from '../../lib/dailyLimit';
import type { Rating } from '../../lib/srs';
import type { WordEntry } from '../../types/word';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '間もなく';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes}分後`;
  const hours = Math.ceil(ms / 3_600_000);
  return `${hours}時間後`;
}

export default function StudyScreen() {
  const words = useWords();
  const dispatch = useWordDispatch();
  const { newCardsPerDay } = useSettings();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = currentId ? (words.find(w => w.id === currentId) ?? null) : null;
  const [sessionCount, setSessionCount] = useState(0);
  const [dailyNewCount, setDailyNewCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getDailyNewCount().then(setDailyNewCount);
  }, []);

  const newLimitReached = dailyNewCount >= newCardsPerDay;

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

  async function handleResult(rating: Rating) {
    if (!current) return;
    const wasNew = getSRSCard(current).state === 'new';
    dispatch({ type: 'REVIEW_CARD', id: current.id, rating });

    let nextDailyCount = dailyNewCount;
    if (wasNew) {
      nextDailyCount = await incrementDailyNewCount();
      setDailyNewCount(nextDailyCount);
    }

    setSessionCount((n) => n + 1);
    const next = pickNextWord(
      words.filter((w) => w.id !== current.id),
      Date.now(),
      { skipNew: nextDailyCount >= newCardsPerDay },
    );
    setCurrentId(next?.id ?? null);
  }

  if (!words.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>学習する単語がありません。</Text>
        <Link href="/add" asChild>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>単語を追加する</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  if (!current) {
    const nextMs = nextDueMs(words, Date.now());
    const countdown = nextMs ? formatCountdown(nextMs - Date.now()) : null;
    return (
      <View style={styles.centered}>
        <Text style={styles.doneText}>今日の学習は完了！</Text>
        {newLimitReached && (
          <Text style={styles.limitText}>
            本日の新規出題上限（{newCardsPerDay}語）に達しました
          </Text>
        )}
        {countdown ? (
          <>
            <Text style={styles.countdownText}>次のカードは{countdown}届きます</Text>
            <TouchableOpacity
              onPress={() => setCurrentId(pickNextWord(words, Date.now(), { skipNew: newLimitReached })?.id ?? null)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>今すぐ確認</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.countdownText}>全ての単語を復習しました。</Text>
        )}
      </View>
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>このセッション: {sessionCount}問</Text>
        <Text style={styles.statText}>
          未{stats.new} 学習{stats.learning} 習得{stats.mastered}
          {dueCount > 0 ? `  期限${dueCount}件` : ''}
          {'  '}{dailyNewCount}/{newCardsPerDay}
        </Text>
      </View>
      <FlashCard key={current.id} word={current} onResult={handleResult} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, flexGrow: 1 },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20, gap: 12 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  doneText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  limitText: { color: '#fde68a', fontSize: 14, textAlign: 'center' },
  countdownText: { color: '#94a3b8', fontSize: 14 },
  actionBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 4 },
  statText: { color: '#94a3b8', fontSize: 11 },
});

