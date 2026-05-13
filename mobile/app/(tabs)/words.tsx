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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useWords, useWordDispatch } from '../../context/WordContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSubscription } from '../../context/SubscriptionContext';
import type { Status, WordEntry } from '../../types/word';

async function translateToJapanese(text: string): Promise<string> {
  try {
    const q = text.slice(0, 400);
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return '翻訳を取得できませんでした';
    const data = await res.json();
    const translated = data[0]?.map((item: unknown[]) => item[0]).join('') ?? '';
    if (!translated || !/[぀-ゟ゠-ヿ一-龯]/.test(translated)) {
      return '翻訳を取得できませんでした';
    }
    return translated;
  } catch {
    return '翻訳を取得できませんでした';
  }
}

const POS_PRIORITY: Record<string, number> = {
  verb: 0, noun: 1, adjective: 2, adverb: 3,
  pronoun: 4, preposition: 5, conjunction: 6, interjection: 7, exclamation: 8,
};

function sortMeanings(meanings: WordEntry['meanings']) {
  return [...meanings].sort((a, b) => {
    const defDiff = b.definitions.length - a.definitions.length;
    if (defDiff !== 0) return defDiff;
    return (POS_PRIORITY[a.partOfSpeech] ?? 99) - (POS_PRIORITY[b.partOfSpeech] ?? 99);
  });
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
  const { user } = useAuth();
  const { isPremium, setShowPaywall } = useSubscription();
  const [note, setNote] = useState(word.note ?? '');
  const [editing, setEditing] = useState(false);
  const [noteImages, setNoteImages] = useState<string[]>(word.noteImages ?? []);
  const [uploadingImage, setUploadingImage] = useState(false);
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

  async function handlePickImage() {
    if (!isPremium) { setShowPaywall(true); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('許可が必要です', '写真ライブラリへのアクセスを許可してください。'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !user) return;
    setUploadingImage(true);
    const uri = result.assets[0].uri;
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${word.id}/${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data } = await supabase.storage.from('note-images').upload(path, blob, { contentType: `image/${ext}` });
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('note-images').getPublicUrl(path);
      setNoteImages((prev) => [...prev, publicUrl]);
    }
    setUploadingImage(false);
  }

  function removeImage(url: string) {
    setNoteImages((prev) => prev.filter((u) => u !== url));
  }

  function saveNote() {
    dispatch({ type: 'UPDATE_NOTE', id: word.id, note: note.trim(), noteImages });
    setEditing(false);
  }

  return (
    <View style={styles.detail}>
      {word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
      {sortMeanings(word.meanings).map((m, i) => (
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
              <Text style={styles.noteEditBtn}>{word.note || noteImages.length > 0 ? '編集' : '+ 追加'}</Text>
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
            {noteImages.length > 0 && (
              <View style={styles.imageRow}>
                {noteImages.map((url, i) => (
                  <View key={i} style={styles.imageThumbWrap}>
                    <Image source={{ uri: url }} style={styles.imageThumb} />
                    <TouchableOpacity onPress={() => removeImage(url)} style={styles.removeImageBtn}>
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage}>
              <Text style={styles.addImageBtn}>
                {uploadingImage ? 'アップロード中…' : isPremium ? '+ 画像を追加' : '🔒 画像を追加 (プレミアム)'}
              </Text>
            </TouchableOpacity>
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={saveNote} style={styles.saveBtnSmall}>
                <Text style={styles.saveBtnText}>保存</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setNote(word.note ?? ''); setNoteImages(word.noteImages ?? []); setEditing(false); }}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={word.note ? styles.noteContent : styles.noteEmpty}>
              {word.note || 'なし'}
            </Text>
            {noteImages.length > 0 && (
              <View style={styles.imageRow}>
                {noteImages.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.noteImageView} resizeMode="contain" />
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default function WordsScreen() {
  const words = useWords();
  const dispatch = useWordDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'added' | 'az' | 'status'>('added');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const STATUS_PRIORITY: Record<Status, number> = { mastered: 0, learning: 1, new: 2 };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = q ? words.filter((w) => w.word.toLowerCase().includes(q)) : [...words];
    if (sortOrder === 'az') result.sort((a, b) => a.word.localeCompare(b.word));
    else if (sortOrder === 'status') result.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
    else result = [...result].reverse();
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
          onPress={() => setSortOrder((s) => s === 'added' ? 'az' : s === 'az' ? 'status' : 'added')}
          style={[styles.sortBtn, sortOrder !== 'added' && styles.sortBtnActive]}
        >
          <Text style={[styles.sortBtnText, sortOrder !== 'added' && styles.sortBtnTextActive]}>
            {sortOrder === 'az' ? 'A→Z' : sortOrder === 'status' ? '習得度' : '追加順'}
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
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: 64, height: 64, borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  removeImageText: { color: '#fff', fontSize: 12, lineHeight: 18 },
  addImageBtn: { fontSize: 12, color: '#6366f1', textDecorationLine: 'underline', marginTop: 2 },
  noteImageView: { width: '100%', height: 140, borderRadius: 8 },
});

