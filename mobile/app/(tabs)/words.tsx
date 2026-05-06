// @ts-nocheck
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useWords, useWordDispatch } from '../../context/WordContext';
import type { Status, WordEntry } from '../../types/word';

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

const statusLabel: Record<Status, string> = {
  new: '未学習',
  learning: '学習中',
  mastered: '習得済み',
};

const statusColor: Record<Status, { bg: string; text: string }> = {
  new: { bg: '#f1f5f9', text: '#475569' },
  learning: { bg: '#fef9c3', text: '#854d0e' },
  mastered: { bg: '#dcfce7', text: '#166534' },
};

function WordDetail({ word }: { word: WordEntry }) {
  const dispatch = useWordDispatch();
  const [note, setNote] = useState(word.note ?? '');
  const [editing, setEditing] = useState(false);
  const [japaneseTexts, setJapaneseTexts] = useState<string[] | null>(null);
  const [loadingJa, setLoadingJa] = useState(false);

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

  function saveNote() {
    dispatch({ type: 'UPDATE_NOTE', id: word.id, note: note.trim() });
    setEditing(false);
  }

  return (
    <View style={styles.detail}>
      {word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
      {word.meanings.map((m, i) => (
        <View key={i} style={styles.meaningBlock}>
          <View style={styles.posTag}>
            <Text style={styles.posText}>{m.partOfSpeech}</Text>
          </View>
          <Text style={styles.definitionText}>{m.definitions[0]?.definition}</Text>
          {m.definitions[0]?.example ? (
            <Text style={styles.exampleText}>"{m.definitions[0].example}"</Text>
          ) : null}
          {japaneseTexts !== null && (
            <Text style={styles.jaText}>{japaneseTexts[i] || '翻訳を取得できませんでした'}</Text>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={handleToggleJapanese} disabled={loadingJa}>
        <Text style={styles.jaToggleBtn}>
          {loadingJa ? '翻訳中…' : japaneseTexts !== null ? '日本語を非表示' : '日本語で意味を確認'}
        </Text>
      </TouchableOpacity>

      <View style={styles.noteSection}>
        <View style={styles.noteHeader}>
          <Text style={styles.noteLabel}>メモ</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.noteEditBtn}>{word.note ? '編集' : '+ 追加'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {editing ? (
          <View style={styles.noteEditArea}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="覚え方、語源、例など…"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={2}
            />
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={saveNote} style={styles.saveBtnSmall}>
                <Text style={styles.saveBtnText}>保存</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setNote(word.note ?? ''); setEditing(false); }}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={word.note ? styles.noteContent : styles.noteEmpty}>
            {word.note || 'なし'}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function WordsScreen() {
  const words = useWords();
  const dispatch = useWordDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'added' | 'az'>('added');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = q ? words.filter((w) => w.word.toLowerCase().includes(q)) : [...words];
    if (sortOrder === 'az') result.sort((a, b) => a.word.localeCompare(b.word));
    else result.reverse();
    return result;
  }, [words, searchQuery, sortOrder]);

  function confirmDelete(word: WordEntry) {
    Alert.alert('削除', `"${word.word}" を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => dispatch({ type: 'DELETE_WORD', id: word.id }) },
    ]);
  }

  if (!words.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>単語がまだありません。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="単語を検索…"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setSortOrder((s) => (s === 'added' ? 'az' : 'added'))}
          style={[styles.sortBtn, sortOrder === 'az' && styles.sortBtnActive]}
        >
          <Text style={[styles.sortBtnText, sortOrder === 'az' && styles.sortBtnTextActive]}>
            {sortOrder === 'az' ? 'A→Z' : '追加順'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.noResultText}>"{searchQuery}" に一致する単語はありません。</Text>
        }
        renderItem={({ item: w }) => (
          <View style={styles.wordCard}>
            <View style={styles.wordRow}>
              <TouchableOpacity
                style={styles.wordRowLeft}
                onPress={() => setExpandedId((id) => (id === w.id ? null : w.id))}
              >
                <Text style={styles.wordText} numberOfLines={1}>{w.word}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor[w.status].bg }]}>
                  <Text style={[styles.statusText, { color: statusColor[w.status].text }]}>
                    {statusLabel[w.status]}
                  </Text>
                </View>
                <Text style={styles.chevron}>{expandedId === w.id ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              <View style={styles.wordRowRight}>
                <Text style={styles.statsText}>{w.correctCount}/{w.studyCount}回</Text>
                <TouchableOpacity onPress={() => confirmDelete(w)}>
                  <Text style={styles.deleteText}>削除</Text>
                </TouchableOpacity>
              </View>
            </View>
            {expandedId === w.id && <WordDetail word={w} />}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  controls: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  searchInput: { flex: 1, backgroundColor: '#1e293b', color: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  sortBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center' },
  sortBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  sortBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  sortBtnTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingTop: 0, gap: 8 },
  noResultText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 16 },
  wordCard: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  wordText: { fontWeight: '600', color: '#111827', fontSize: 15, flexShrink: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '500' },
  chevron: { color: '#9ca3af', fontSize: 10 },
  wordRowRight: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 },
  statsText: { fontSize: 12, color: '#6b7280' },
  deleteText: { fontSize: 13, color: '#ef4444', fontWeight: '500' },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 8 },
  phonetic: { fontSize: 12, color: '#6b7280' },
  meaningBlock: { gap: 3 },
  posTag: { backgroundColor: '#e0e7ff', alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  posText: { fontSize: 11, fontWeight: '600', color: '#4338ca' },
  definitionText: { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  exampleText: { fontSize: 12, color: '#3b82f6', fontStyle: 'italic', lineHeight: 18 },
  jaText: { fontSize: 12, color: '#4338ca', borderLeftWidth: 2, borderLeftColor: '#a5b4fc', paddingLeft: 8, lineHeight: 18, marginTop: 2 },
  jaToggleBtn: { fontSize: 12, color: '#6366f1', textDecorationLine: 'underline', marginTop: 4 },
  noteSection: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 4 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteLabel: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  noteEditBtn: { fontSize: 12, color: '#6366f1', fontWeight: '500' },
  noteEditArea: { gap: 6 },
  noteInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#1f2937' },
  noteActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  saveBtnSmall: { backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cancelText: { color: '#6b7280', fontSize: 12 },
  noteContent: { fontSize: 14, color: '#374151', lineHeight: 20 },
  noteEmpty: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
});

