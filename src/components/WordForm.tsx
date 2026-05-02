'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchWord, fetchSuggestions, type DictResult } from '@/lib/api';
import { useWords, useWordDispatch } from '@/context/WordContext';

export default function WordForm() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [preview, setPreview] = useState<DictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  const words = useWords();
  const dispatch = useWordDispatch();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 予測変換: 入力変化から 250ms 後に候補を取得
  useEffect(() => {
    if (input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      const list = await fetchSuggestions(input.trim());
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    }, 250);
    return () => clearTimeout(id);
  }, [input]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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

  function handleSuggestionClick(word: string) {
    setInput(word);
    search(word);
  }

  function handleAdd() {
    if (!preview) return;
    const exists = words.some(
      (w) => w.word.toLowerCase() === preview.word.toLowerCase()
    );
    if (exists) {
      setError('この単語はすでに追加されています');
      return;
    }

    dispatch({
      type: 'ADD_WORD',
      word: {
        id: crypto.randomUUID(),
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
    <div className="space-y-4">
      {/* Input + suggestions */}
      <div ref={wrapperRef} className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setAdded(false);
              if (e.target.value.trim().length < 2) setShowSuggestions(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search(input);
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="英単語を入力（例: resilient）"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoComplete="off"
          />

          {/* Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // blur前に閉じないようにする
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => search(input)}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {loading ? '検索中…' : '検索'}
        </button>
      </div>

      {added && (
        <p className="text-green-600 text-sm font-medium">単語を追加しました！</p>
      )}
      {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

      {preview && (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-gray-900">{preview.word}</span>
            {preview.phonetic && (
              <span className="text-gray-500 text-sm">{preview.phonetic}</span>
            )}
          </div>

          {preview.meanings.slice(0, 2).map((m, i) => (
            <div key={i}>
              <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded mb-1">
                {m.partOfSpeech}
              </span>
              <p className="text-sm text-gray-800 leading-relaxed">
                {m.definitions[0]?.definition}
              </p>
              {m.definitions[0]?.example && (
                <p className="text-xs text-gray-500 italic mt-1">
                  &ldquo;{m.definitions[0].example}&rdquo;
                </p>
              )}
            </div>
          ))}

          <button
            onClick={handleAdd}
            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors mt-2"
          >
            追加する
          </button>
        </div>
      )}
    </div>
  );
}
