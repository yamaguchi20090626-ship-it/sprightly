// @ts-nocheck
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSettings, useSettingsDispatch, type FontSize } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import { getDailyNewCount } from '../../lib/dailyLimit';

const fontSizes: Array<{ value: FontSize; label: string }> = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
];

export default function SettingsScreen() {
  const settings = useSettings();
  const dispatch = useSettingsDispatch();
  const { signOut } = useAuth();
  const [todayNewCount, setTodayNewCount] = useState(0);

  useEffect(() => {
    getDailyNewCount().then(setTodayNewCount);
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>設定</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1日の新規出題数</Text>
        <Text style={styles.cardDesc}>
          1日に初めて出題する新規単語の上限。学習中・復習カードは制限なし。
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={String(settings.newCardsPerDay)}
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              if (!isNaN(n) && n > 0) dispatch({ type: 'SET_NEW_CARDS_PER_DAY', count: n });
            }}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.unit}>語 / 日</Text>
        </View>
        <Text style={styles.cardDesc}>
          本日の新規出題済み:{' '}
          <Text style={styles.boldText}>{todayNewCount}</Text> 語
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>目標単語数</Text>
        <Text style={styles.cardDesc}>習得済みの単語がこの数に達したら目標達成です。</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={String(settings.goalCount)}
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              if (!isNaN(n) && n > 0) dispatch({ type: 'SET_GOAL', count: n });
            }}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={styles.unit}>語</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>文字サイズ</Text>
        <View style={styles.fontSizeRow}>
          {fontSizes.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              onPress={() => dispatch({ type: 'SET_FONT_SIZE', size: value })}
              style={[
                styles.fontSizeBtn,
                settings.fontSize === value && styles.fontSizeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.fontSizeBtnText,
                  settings.fontSize === value && styles.fontSizeBtnTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.cardDesc}>
          現在:{' '}
          <Text style={styles.boldText}>
            {fontSizes.find((f) => f.value === settings.fontSize)?.label}
          </Text>
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, gap: 14 },
  heading: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardDesc: { fontSize: 12, color: '#4b5563', lineHeight: 18 },
  boldText: { fontWeight: '700', color: '#111827' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    width: 90,
  },
  unit: { fontSize: 14, color: '#374151', fontWeight: '500' },
  fontSizeRow: { flexDirection: 'row', gap: 8 },
  fontSizeBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f3f4f6' },
  fontSizeBtnActive: { backgroundColor: '#4f46e5' },
  fontSizeBtnText: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  fontSizeBtnTextActive: { color: '#fff' },
  logoutBtn: { backgroundColor: '#dc2626', borderRadius: 14, padding: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

