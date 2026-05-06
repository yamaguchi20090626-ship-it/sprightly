// @ts-nocheck
import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Speech from 'expo-speech';
import type { WordEntry } from '../types/word';
import { fetchExamples } from '../lib/api';
import type { Rating } from '../lib/srs';

async function translateToJapanese(text: string): Promise<string> {
  try {
    const q = text.slice(0, 400);
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|ja`
    );
    if (!res.ok) return '翻訳を取得できませんでした';
    const data = await res.json();
    const translated = data?.responseData?.translatedText ?? '';
    if (!translated || translated.startsWith('MYMEMORY WARNING') || translated.startsWith('QUERY LENGTH')) {
      return '翻訳を取得できませんでした';
    }
    if (!/[぀-ゟ゠-ヿ一-龯]/.test(translated)) {
      return '翻訳を取得できませんでした';
    }
    return translated;
  } catch {
    return '翻訳を取得できませんでした';
  }
}

function speak(text: string) {
  Speech.speak(text, { language: 'en-US' });
}

interface Props {
  word: WordEntry;
  onResult: (rating: Rating) => void;
}

export default function FlashCard({ word, onResult }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [japaneseTexts, setJapaneseTexts] = useState<string[] | null>(null);
  const [loadingJa, setLoadingJa] = useState(false);
  const [tatoebaExamples, setTatoebaExamples] = useState<string[] | null>(null);
  const [loadingTatoeba, setLoadingTatoeba] = useState(false);
  const [tatoebaJaTexts, setTatoebaJaTexts] = useState<string[] | null>(null);
  const [loadingTatoebaJa, setLoadingTatoebaJa] = useState(false);

  const flipAnim = useRef(new Animated.Value(0)).current;

  function handleFlip() {
    const toValue = flipped ? 0 : 1;
    Animated.spring(flipAnim, { toValue, useNativeDriver: true }).start();
    setFlipped(!flipped);
  }

  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  async function handleToggleJapanese() {
    if (japaneseTexts !== null) { setJapaneseTexts(null); return; }
    setLoadingJa(true);
    const results = await Promise.all(
      word.meanings.map((m) =>
        m.definitions[0]?.definition
          ? translateToJapanese(m.definitions[0].definition)
          : Promise.resolve('')
      )
    );
    setJapaneseTexts(results);
    setLoadingJa(false);
  }

  async function handleToggleTatoeba() {
    if (tatoebaExamples !== null) {
      setTatoebaExamples(null);
      setTatoebaJaTexts(null);
      return;
    }
    setLoadingTatoeba(true);
    const examples = await fetchExamples(word.word);
    setTatoebaExamples(examples);
    setLoadingTatoeba(false);
  }

  async function handleToggleTatoebaJa() {
    if (tatoebaJaTexts !== null) { setTatoebaJaTexts(null); return; }
    if (!tatoebaExamples?.length) return;
    setLoadingTatoebaJa(true);
    const results = await Promise.all(tatoebaExamples.map(translateToJapanese));
    setTatoebaJaTexts(results);
    setLoadingTatoebaJa(false);
  }

  function handleResult(rating: Rating) {
    setFlipped(false);
    flipAnim.setValue(0);
    setJapaneseTexts(null);
    setTatoebaExamples(null);
    setTatoebaJaTexts(null);
    onResult(rating);
  }

  return (
    <View style={styles.container}>
      {/* Card */}
      <Pressable onPress={handleFlip} style={styles.cardWrapper}>
        {/* Front */}
        <Animated.View style={[styles.card, styles.cardFront, { opacity: frontOpacity }]}>
          <Text style={styles.wordText}>{word.word}</Text>
          {word.phonetic && <Text style={styles.phoneticText}>{word.phonetic}</Text>}
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); speak(word.word); }}
            style={styles.speakerBtn}
          >
            <Text style={styles.speakerIcon}>🔊</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>タップして意味を確認</Text>
        </Animated.View>

        {/* Back */}
        <Animated.View style={[styles.card, styles.cardBack, { opacity: backOpacity, position: 'absolute', top: 0, left: 0, right: 0 }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {word.meanings.map((m, i) => (
              <View key={i} style={styles.meaningBlock}>
                <View style={styles.posTag}>
                  <Text style={styles.posText}>{m.partOfSpeech}</Text>
                </View>
                <Text style={styles.definitionText}>{m.definitions[0]?.definition}</Text>
                {m.definitions[0]?.example && (
                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleLabel}>辞書例文</Text>
                    <Text style={styles.exampleText}>"{m.definitions[0].example}"</Text>
                  </View>
                )}
                {japaneseTexts !== null && (
                  <View style={styles.jaBox}>
                    <Text style={styles.jaText}>{japaneseTexts[i] || '翻訳を取得できませんでした'}</Text>
                  </View>
                )}
              </View>
            ))}

            {word.note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>メモ</Text>
                <Text style={styles.noteText}>{word.note}</Text>
              </View>
            ) : null}

            {tatoebaExamples !== null && (
              <View style={styles.tatoebaBox}>
                <Text style={styles.tatoebaLabel}>Tatoeba 例文</Text>
                {tatoebaExamples.length > 0 ? (
                  tatoebaExamples.map((ex, i) => (
                    <View key={i} style={styles.tatoebaItem}>
                      <Text style={styles.tatoebaText}>"{ex}"</Text>
                      {tatoebaJaTexts?.[i] ? (
                        <Text style={styles.tatoebaJaText}>{tatoebaJaTexts[i]}</Text>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.tatoebaEmpty}>例文が見つかりませんでした。</Text>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Pressable>

      {/* Controls */}
      {flipped && (
        <View style={styles.controls}>
          <View style={styles.linkRow}>
            <TouchableOpacity onPress={handleToggleJapanese} disabled={loadingJa}>
              <Text style={styles.linkText}>
                {loadingJa ? '翻訳中…' : japaneseTexts !== null ? '日本語を非表示' : '日本語で意味を確認'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleTatoeba} disabled={loadingTatoeba}>
              <Text style={[styles.linkText, styles.amberLink]}>
                {loadingTatoeba ? '取得中…' : tatoebaExamples !== null ? '例文を非表示' : '例文を確認 (Tatoeba)'}
              </Text>
            </TouchableOpacity>
            {tatoebaExamples !== null && tatoebaExamples.length > 0 && (
              <TouchableOpacity onPress={handleToggleTatoebaJa} disabled={loadingTatoebaJa}>
                <Text style={[styles.linkText, styles.amberLink]}>
                  {loadingTatoebaJa ? '翻訳中…' : tatoebaJaTexts !== null ? '例文の日本語訳を非表示' : '例文の日本語訳'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.ratingRow}>
            {([
              { rating: 'again', label: 'Again', sub: 'もう一度', bg: '#fee2e2', color: '#b91c1c' },
              { rating: 'hard', label: 'Hard', sub: '難しい', bg: '#ffedd5', color: '#c2410c' },
              { rating: 'good', label: 'Good', sub: '正解', bg: '#dbeafe', color: '#1d4ed8' },
              { rating: 'easy', label: 'Easy', sub: '簡単', bg: '#d1fae5', color: '#065f46' },
            ] as const).map(({ rating, label, sub, bg, color }) => (
              <TouchableOpacity
                key={rating}
                onPress={() => handleResult(rating)}
                style={[styles.ratingBtn, { backgroundColor: bg }]}
              >
                <Text style={[styles.ratingLabel, { color }]}>{label}</Text>
                <Text style={[styles.ratingSub, { color }]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 20 },
  cardWrapper: { minHeight: 280 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    minHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFront: { borderColor: '#e5e7eb', borderWidth: 1 },
  cardBack: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderWidth: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  wordText: { fontSize: 36, fontWeight: 'bold', color: '#111827' },
  phoneticText: { fontSize: 18, color: '#6b7280', marginTop: 8 },
  speakerBtn: { marginTop: 20, padding: 10, backgroundColor: '#f3f4f6', borderRadius: 999 },
  speakerIcon: { fontSize: 20 },
  hintText: { marginTop: 24, fontSize: 12, color: '#9ca3af' },
  meaningBlock: { marginBottom: 20 },
  posTag: { backgroundColor: '#c7d2fe', alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  posText: { fontSize: 12, fontWeight: '600', color: '#3730a3' },
  definitionText: { fontSize: 16, color: '#111827', lineHeight: 24 },
  exampleBox: { marginTop: 6, borderLeftWidth: 2, borderLeftColor: '#93c5fd', paddingLeft: 8 },
  exampleLabel: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  exampleText: { fontSize: 12, color: '#1d4ed8', fontStyle: 'italic', lineHeight: 18 },
  jaBox: { marginTop: 4, borderLeftWidth: 2, borderLeftColor: '#a5b4fc', paddingLeft: 10 },
  jaText: { fontSize: 14, color: '#4338ca', lineHeight: 20 },
  noteBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#c7d2fe' },
  noteLabel: { fontSize: 12, fontWeight: '600', color: '#6366f1', marginBottom: 4 },
  noteText: { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  tatoebaBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#c7d2fe' },
  tatoebaLabel: { fontSize: 12, fontWeight: '600', color: '#d97706', marginBottom: 8 },
  tatoebaItem: { marginBottom: 8 },
  tatoebaText: { fontSize: 14, color: '#92400e', backgroundColor: '#fef3c7', borderRadius: 6, padding: 10, fontStyle: 'italic', lineHeight: 20 },
  tatoebaJaText: { fontSize: 12, color: '#b45309', paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#fcd34d', marginTop: 4, lineHeight: 18 },
  tatoebaEmpty: { fontSize: 12, color: '#d97706' },
  controls: { gap: 12 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  linkText: { fontSize: 14, color: '#a5b4fc', textDecorationLine: 'underline' },
  amberLink: { color: '#fcd34d' },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
  ratingLabel: { fontSize: 14, fontWeight: '600' },
  ratingSub: { fontSize: 11, opacity: 0.7, marginTop: 2 },
});

