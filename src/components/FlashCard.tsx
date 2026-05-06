'use client';

import { useState } from 'react';
import type { WordEntry } from '@/types/word';
import { fetchExamples } from '@/lib/api';
import type { Rating } from '@/lib/srs';

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
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
}

function SpeakerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
  );
}

function highlightWord(sentence: string, word: string): React.ReactNode {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = sentence.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <strong key={i} className="text-amber-500 font-bold not-italic">
        {part}
      </strong>
    ) : (
      part
    )
  );
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

  async function handleToggleJapanese(e: React.MouseEvent) {
    e.stopPropagation();
    if (japaneseTexts !== null) {
      setJapaneseTexts(null);
      return;
    }
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

  async function handleToggleTatoeba(e: React.MouseEvent) {
    e.stopPropagation();
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

  async function handleToggleTatoebaJa(e: React.MouseEvent) {
    e.stopPropagation();
    if (tatoebaJaTexts !== null) {
      setTatoebaJaTexts(null);
      return;
    }
    if (!tatoebaExamples?.length) return;
    setLoadingTatoebaJa(true);
    const results = await Promise.all(tatoebaExamples.map(translateToJapanese));
    setTatoebaJaTexts(results);
    setLoadingTatoebaJa(false);
  }

  function handleResult(rating: Rating) {
    setFlipped(false);
    setJapaneseTexts(null);
    setTatoebaExamples(null);
    setTatoebaJaTexts(null);
    onResult(rating);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Card */}
      <div
        className="w-full max-w-md cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '320px',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-white border border-gray-200 rounded-2xl shadow-md flex flex-col items-center justify-center p-8"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-4xl font-bold text-gray-900">{word.word}</p>
            {word.phonetic && (
              <p className="text-gray-500 mt-3 text-lg">{word.phonetic}</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); speak(word.word); }}
              className="mt-5 p-2.5 rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-400 hover:text-indigo-500 transition-colors"
              aria-label="発音を聞く"
            >
              <SpeakerIcon />
            </button>
            <p className="text-gray-400 text-xs mt-6">タップして意味を確認</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-md p-6 overflow-y-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="space-y-5">
              {word.meanings.map((m, i) => (
                <div key={i} className="space-y-2">
                  <span className="inline-block bg-indigo-200 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded">
                    {m.partOfSpeech}
                  </span>
                  <p className="text-gray-900 text-base font-medium leading-relaxed">
                    {m.definitions[0]?.definition}
                  </p>
                  {m.definitions[0]?.example && (
                    <p className="text-blue-700 text-xs italic leading-relaxed border-l-2 border-blue-300 pl-2">
                      <span className="not-italic font-semibold text-blue-600 mr-1">辞書例文</span>
                      &ldquo;{m.definitions[0].example}&rdquo;
                    </p>
                  )}
                  {japaneseTexts !== null && (
                    <p className="text-indigo-700 text-sm leading-relaxed border-l-2 border-indigo-300 pl-3">
                      {japaneseTexts[i] || '翻訳を取得できませんでした'}
                    </p>
                  )}
                </div>
              ))}

              {word.note && (
                <div className="pt-3 border-t border-indigo-200">
                  <p className="text-xs font-semibold text-indigo-600 mb-1">メモ</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{word.note}</p>
                </div>
              )}

              {tatoebaExamples !== null && (
                <div className="pt-3 border-t border-indigo-200 space-y-2">
                  <p className="text-xs font-semibold text-amber-600">Tatoeba 例文</p>
                  {tatoebaExamples.length > 0 ? (
                    tatoebaExamples.map((ex, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 leading-relaxed italic">
                          &ldquo;{highlightWord(ex, word.word)}&rdquo;
                        </p>
                        {tatoebaJaTexts?.[i] && (
                          <p className="text-xs text-amber-700 pl-3 border-l-2 border-amber-300 leading-relaxed">
                            {tatoebaJaTexts[i]}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-amber-500">例文が見つかりませんでした。</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      {flipped && (
        <>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={handleToggleJapanese}
              disabled={loadingJa}
              className="text-sm text-indigo-200 hover:text-white underline disabled:opacity-50 transition-colors"
            >
              {loadingJa ? '翻訳中…' : japaneseTexts !== null ? '日本語を非表示' : '日本語で意味を確認'}
            </button>
            <button
              onClick={handleToggleTatoeba}
              disabled={loadingTatoeba}
              className="text-sm text-amber-300 hover:text-amber-100 underline disabled:opacity-50 transition-colors"
            >
              {loadingTatoeba ? '取得中…' : tatoebaExamples !== null ? '例文を非表示' : '例文を確認 (Tatoeba)'}
            </button>
            {tatoebaExamples !== null && tatoebaExamples.length > 0 && (
              <button
                onClick={handleToggleTatoebaJa}
                disabled={loadingTatoebaJa}
                className="text-sm text-amber-200 hover:text-white underline disabled:opacity-50 transition-colors"
              >
                {loadingTatoebaJa ? '翻訳中…' : tatoebaJaTexts !== null ? '例文の日本語訳を非表示' : '例文の日本語訳'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 w-full max-w-md">
            <button
              onClick={() => handleResult('again')}
              className="flex flex-col items-center py-3 px-1 rounded-xl bg-red-100 text-red-700 font-semibold text-sm hover:bg-red-200 transition-colors"
            >
              <span>Again</span>
              <span className="text-xs font-normal opacity-70">もう一度</span>
            </button>
            <button
              onClick={() => handleResult('hard')}
              className="flex flex-col items-center py-3 px-1 rounded-xl bg-orange-100 text-orange-700 font-semibold text-sm hover:bg-orange-200 transition-colors"
            >
              <span>Hard</span>
              <span className="text-xs font-normal opacity-70">難しい</span>
            </button>
            <button
              onClick={() => handleResult('good')}
              className="flex flex-col items-center py-3 px-1 rounded-xl bg-blue-100 text-blue-700 font-semibold text-sm hover:bg-blue-200 transition-colors"
            >
              <span>Good</span>
              <span className="text-xs font-normal opacity-70">正解</span>
            </button>
            <button
              onClick={() => handleResult('easy')}
              className="flex flex-col items-center py-3 px-1 rounded-xl bg-emerald-100 text-emerald-700 font-semibold text-sm hover:bg-emerald-200 transition-colors"
            >
              <span>Easy</span>
              <span className="text-xs font-normal opacity-70">簡単</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
