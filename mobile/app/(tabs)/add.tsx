// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { fetchWord, fetchSuggestions, type DictResult } from '../../lib/api';
import { useWords, useWordDispatch } from '../../context/WordContext';

export default function AddScreen() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [preview, setPreview] = useState<DictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  const words = useWords();
  const dispatch = useWordDispatch();

  useEffect(() => {
    if (input.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const id = setTimeout(async () => {
      const list = await fetchSuggestions(input.trim());
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    }, 250);
    return () => clearTimeout(id);
  }, [input]);

  async function search(term: string) {
    const q = term.trim();
    if (!q) return;
    setShowSuggestions(false);
    setSuggestions([]);
    setLoading(true);
    setError('');
    setPreview(null);
    setAdded(false);
    const result = await fetchWord(q);
    setLoading(false);
    if (!result) {
      setError('単語が見つかりませんでした。スペルを確認してください。');
      return;
    }
    setPreview(result);
  }

  function handleAdd() {
    if (!preview) return;
    const exists = words.some((w) => w.word.toLowerCase() === preview.word.toLowerCase());
    if (exists) { setError('この単語はすでに追加されています'); return; }
    dispatch({
      type: 'ADD_WORD',
      word: {
        id: Crypto.randomUUID(),
        word: preview.word,
        phonetic: preview.phonetic,
        meanings: preview.meanings,
        status: 'new',
        addedAt: Date.now(),
        studyCount: 0,
        correctCount: 0,
      },
    });
    setAdded(true);
    setInput('');
    setPreview(null);
    setError('');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>単語を追加</Text>

        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={(t) => { setInput(t); setAdded(false); }}
              onSubmitEditing={() => search(input)}
              placeholder="英単語を入力（例: resilient）"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.dropdown}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => { setInput(s); search(s); }}
                    style={styles.suggestionItem}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => search(input)} disabled={loading} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>{loading ? '検索中…' : '検索'}</Text>
          </TouchableOpacity>
        </View>

        {added && <Text style={styles.successText}>単語を追加しました！</Text>}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewWord}>{preview.word}</Text>
              {preview.phonetic && <Text style={styles.previewPhonetic}>{preview.phonetic}</Text>}
            </View>
            {preview.meanings.slice(0, 2).map((m, i) => (
              <View key={i} style={styles.meaningBlock}>
                <View style={styles.posTag}>
                  <Text style={styles.posText}>{m.partOfSpeech}</Text>
                </View>
                <Text style={styles.definitionText}>{m.definitions[0]?.definition}</Text>
                {m.definitions[0]?.example && (
                  <Text style={styles.exampleText}>"{m.definitions[0].example}"</Text>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
              <Text style={styles.addBtnText}>追加する</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  heading: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: 8, zIndex: 10 },
  inputWrapper: { flex: 1, position: 'relative' },
  input: { backgroundColor: '#1e293b', color: '#f1f5f9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', zIndex: 20, marginTop: 4 },
  suggestionItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  suggestionText: { color: '#e2e8f0', fontSize: 14 },
  searchBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  successText: { color: '#4ade80', fontSize: 14, fontWeight: '500' },
  errorText: { color: '#f87171', fontSize: 14, fontWeight: '500' },
  previewCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: '#334155' },
  previewHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  previewWord: { fontSize: 22, fontWeight: 'bold', color: '#f1f5f9' },
  previewPhonetic: { fontSize: 14, color: '#94a3b8' },
  meaningBlock: { gap: 4 },
  posTag: { backgroundColor: '#312e81', alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  posText: { fontSize: 11, fontWeight: '600', color: '#a5b4fc' },
  definitionText: { fontSize: 14, color: '#e2e8f0', lineHeight: 20 },
  exampleText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', lineHeight: 18 },
  addBtn: { backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

