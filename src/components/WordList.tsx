'use client';

import { useState, useMemo } from 'react';
import { useWords, useWordDispatch } from '@/context/WordContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Status, WordEntry, Meaning } from '@/types/word';

const POS_PRIORITY: Record<string, number> = {
  verb: 0, noun: 1, adjective: 2, adverb: 3,
  pronoun: 4, preposition: 5, conjunction: 6, interjection: 7, exclamation: 8,
};

function sortMeanings(meanings: Meaning[]): Meaning[] {
  return [...meanings].sort((a, b) => {
    const defDiff = b.definitions.length - a.definitions.length;
    if (defDiff !== 0) return defDiff;
    return (POS_PRIORITY[a.partOfSpeech] ?? 99) - (POS_PRIORITY[b.partOfSpeech] ?? 99);
  });
}

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

const statusLabel: Record<Status, string> = {
  new: '未学習',
  learning: '学習中',
  mastered: '習得済み',
};

const statusColor: Record<Status, string> = {
  new: 'bg-gray-100 text-gray-700',
  learning: 'bg-yellow-100 text-yellow-800',
  mastered: 'bg-green-100 text-green-800',
};

function WordDetail({ word }: { word: WordEntry }) {
  const dispatch = useWordDispatch();
  const { user } = useAuth();
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImage(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${word.id}/${Date.now()}.${ext}`;
    const { data } = await supabase.storage.from('note-images').upload(path, file);
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('note-images').getPublicUrl(path);
      setNoteImages((prev) => [...prev, publicUrl]);
    }
    setUploadingImage(false);
    e.target.value = '';
  }

  function removeImage(url: string) {
    setNoteImages((prev) => prev.filter((u) => u !== url));
  }

  function saveNote() {
    dispatch({ type: 'UPDATE_NOTE', id: word.id, note: note.trim(), noteImages });
    setEditing(false);
  }

  function cancelEdit() {
    setNote(word.note ?? '');
    setNoteImages(word.noteImages ?? []);
    setEditing(false);
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 select-text">
      {word.phonetic && (
        <p className="text-gray-500 text-xs">{word.phonetic}</p>
      )}

      {sortMeanings(word.meanings).map((m, i) => (
        <div key={i} className="space-y-1">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">
            {m.partOfSpeech}
          </span>
          <p className="text-sm text-gray-800 leading-relaxed">
            {m.definitions[0]?.definition}
          </p>
          {m.definitions[0]?.example && (
            <p className="text-xs text-blue-700 italic border-l-2 border-blue-300 pl-2 leading-relaxed">
              <span className="not-italic font-semibold text-blue-600 mr-1">辞書例文</span>
              &ldquo;{m.definitions[0].example}&rdquo;
            </p>
          )}
          {japaneseTexts !== null && (
            <p className="text-xs text-indigo-700 border-l-2 border-indigo-300 pl-2 leading-relaxed">
              {japaneseTexts[i] || '翻訳を取得できませんでした'}
            </p>
          )}
        </div>
      ))}
      <button
        onClick={handleToggleJapanese}
        disabled={loadingJa}
        className="text-xs text-indigo-500 hover:text-indigo-700 underline disabled:opacity-50 transition-colors"
      >
        {loadingJa ? '翻訳中…' : japaneseTexts !== null ? '日本語を非表示' : '日本語で意味を確認'}
      </button>

      {/* メモ欄 */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600">メモ</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              {word.note || noteImages.length > 0 ? '編集' : '+ 追加'}
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="覚え方、語源、例など…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            {noteImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {noteImages.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      onClick={() => removeImage(url)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <label className={`inline-block text-xs text-indigo-600 underline cursor-pointer ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploadingImage ? 'アップロード中…' : '+ 画像を追加'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
            <div className="flex gap-2">
              <button
                onClick={saveNote}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                保存
              </button>
              <button
                onClick={cancelEdit}
                className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">
              {word.note
                ? <span className="text-gray-700">{word.note}</span>
                : <span className="text-gray-400 italic text-xs">なし</span>
              }
            </p>
            {noteImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {noteImages.map((url, i) => (
                  <img key={i} src={url} alt="" className="max-h-32 rounded-lg object-contain" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WordList() {
  const words = useWords();
  const dispatch = useWordDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'added' | 'az' | 'status'>('added');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? words.filter((w) => w.word.toLowerCase().includes(q))
      : [...words];

    const statusPriority: Record<Status, number> = { mastered: 0, learning: 1, new: 2 };
    if (sortOrder === 'az') {
      result.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortOrder === 'status') {
      result.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);
    } else {
      result.reverse();
    }
    return result;
  }, [words, searchQuery, sortOrder]);

  if (!words.length) {
    return (
      <p className="text-center text-slate-300 py-12 text-sm">
        単語がまだありません。
        <a href="/add" className="text-indigo-300 underline ml-1">
          単語を追加
        </a>
        してください。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & sort controls */}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="単語を検索…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-gray-900 placeholder-gray-500"
        />
        <button
          onClick={() => setSortOrder((s) => s === 'added' ? 'az' : s === 'az' ? 'status' : 'added')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 border ${
            sortOrder !== 'added'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
          }`}
        >
          {sortOrder === 'az' ? 'A→Z' : sortOrder === 'status' ? '習得度' : '追加順'}
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="text-slate-300 text-sm text-center py-4">
          &ldquo;{searchQuery}&rdquo; に一致する単語はありません。
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((w) => (
          <div
            key={w.id}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3"
          >
            {/* Row */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setExpandedId((id) => (id === w.id ? null : w.id))}
                className="flex items-center gap-3 min-w-0 text-left flex-1"
              >
                <span className="font-semibold text-gray-900 truncate max-w-[160px]">
                  {w.word}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColor[w.status]}`}>
                  {statusLabel[w.status]}
                </span>
                <span className="text-gray-400 text-xs shrink-0">
                  {expandedId === w.id ? '▲' : '▼'}
                </span>
              </button>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-xs text-gray-500">
                  {w.correctCount}/{w.studyCount}回
                </span>
                <button
                  onClick={() => dispatch({ type: 'DELETE_WORD', id: w.id })}
                  className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                  aria-label="削除"
                >
                  削除
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === w.id && <WordDetail word={w} />}
          </div>
        ))}
      </div>
    </div>
  );
}
