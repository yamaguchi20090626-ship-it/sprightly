// @ts-nocheck
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import FlashCard from '../../components/FlashCard';
import { useWords, useWordDispatch } from '../../context/WordContext';
import { useSettings } from '../../context/SettingsContext';
import { pickNextWord, nextDueMs, getSRSCard } from '../../lib/srs';
import { getDailyNewCount, incrementDailyNewCount } from '../../lib/dailyLimit';
import { getStreak, updateStreak } from '../../lib/streak';
import type { Rating } from '../../lib/srs';

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
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [dailyNewCount, setDailyNewCount] = useState(0);
  const [tick, setTick] = useState(0);
  const [streak, setStreak] = useState(0);
  const [streakUpdated, setStreakUpdated] = useState(false);

  useEffect(() => {
    getDailyNewCount().then(setDailyNewCount);
    getStreak().then((s) => setStreak(s.count));
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
  }, [tick]);

  async function handleResult(rating: Rating) {
    if (!current) return;

    if (!streakUpdated) {
      const updated = await updateStreak();
      setStreak(updated.count);
      setStreakUpdated(true);
    }

    const wasNew = getSRSCard(current).state === 'new';
    dispatch({ type: 'REVIEW_CARD', id: current.id, rating });

    let nextDailyCount = dailyNewCount;
    if (wasNew) {
      nextDailyCount = await incrementDailyNewCount();
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
    const correctRate = sessionCount > 0 ? Math.round((sessionCorrect / sessionCount) * 100) : null;

    return (
      <View style={styles.centered}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.doneText}>今日の学習完了！</Text>

        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}日連続</Text>
          </View>
        )}

        {sessionCount > 0 && (
          <View style={styles.sessionGrid}>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionValue}>{sessionCount}</Text>
              <Text style={styles.sessionLabel}>回答数</Text>
            </View>
            <View style={styles.sessionCard}>
              <Text style={[styles.sessionValue, { color: '#4ade80' }]}>{correctRate}%</Text>
              <Text style={styles.sessionLabel}>正解率</Text>
            </View>
          </View>
        )}

        {newLimitReached && (
          <Text style={styles.limitText}>本日の新規出題上限（{newCardsPerDay}語）に達しました</Text>
        )}

        {countdown ? (
          <>
            <Text style={styles.countdownText}>間違えたカードが{countdown}に再出題されます</Text>
            <TouchableOpacity
              onPress={() => {
                const next = nextDueMs(words, Date.now());
                setCurrentId(pickNextWord(words, next ?? Date.now(), { skipNew: newLimitReached })?.id ?? null);
              }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>今すぐ確認</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.countdownText}>全ての単語を復習しました。</Text>
        )}

        <Link href="/add" asChild>
          <TouchableOpacity>
            <Text style={styles.addLink}>単語を追加する</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  const now = Date.now();
  const remaining = words.filter((w) =>
    w.id !== currentId &&
    getSRSCard(w).due <= now &&
    (!newLimitReached || getSRSCard(w).state !== 'new')
  ).length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        {streak > 0 && <Text style={styles.streakSmall}>🔥 {streak}日</Text>}
        <Text style={styles.remainingText}>残り{remaining}問</Text>
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
  doneEmoji: { fontSize: 56 },
  doneText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  streakBadge: { backgroundColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  streakText: { color: '#fb923c', fontSize: 16, fontWeight: '700' },
  sessionGrid: { flexDirection: 'row', gap: 12 },
  sessionCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, alignItems: 'center', minWidth: 100 },
  sessionValue: { fontSize: 24, fontWeight: 'bold', color: '#93c5fd' },
  sessionLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  limitText: { color: '#fde68a', fontSize: 13, textAlign: 'center' },
  countdownText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  actionBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  addLink: { color: '#818cf8', fontSize: 13, textDecorationLine: 'underline', marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 12 },
  streakSmall: { color: '#fb923c', fontSize: 12, fontWeight: '600' },
  remainingText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
});
