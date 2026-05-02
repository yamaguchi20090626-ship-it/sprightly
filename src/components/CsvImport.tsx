'use client';

import { useState, useRef } from 'react';
import { fetchWord } from '@/lib/api';
import { useWords, useWordDispatch } from '@/context/WordContext';

interface ImportResult {
  added: string[];
  skipped: string[];
  notFound: string[];
}

function parseCsv(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(',')[0].trim().replace(/^["']|["']$/g, ''))
    .filter((word) => {
      if (!word) return false;
      if (/^(word|英単語|english|単語)$/i.test(word)) return false;
      return /^[a-zA-Z]/.test(word);
    });
}

export default function CsvImport() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const words = useWords();
  const dispatch = useWordDispatch();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setResult(null);

    const text = await file.text();
    const candidates = parseCsv(text);

    if (!candidates.length) {
      setError('有効な英単語が見つかりませんでした。1列目に英単語を1行1語で記載してください。');
      return;
    }

    setStatus('loading');
    setProgress({ current: 0, total: candidates.length });

    const added: string[] = [];
    const skipped: string[] = [];
    const notFound: string[] = [];
    const existing = new Set(words.map((w) => w.word.toLowerCase()));

    for (const word of candidates) {
      if (existing.has(word.toLowerCase())) {
        skipped.push(word);
        setProgress((p) => ({ ...p, current: p.current + 1 }));
        continue;
      }

      const dict = await fetchWord(word);
      if (!dict) {
        notFound.push(word);
      } else {
        dispatch({
          type: 'ADD_WORD',
          word: {
            id: crypto.randomUUID(),
            word: dict.word,
            phonetic: dict.phonetic,
            meanings: dict.meanings,
            status: 'new',
            addedAt: Date.now(),
            studyCount: 0,
            correctCount: 0,
          },
        });
        existing.add(dict.word.toLowerCase());
        added.push(dict.word);
      }

      setProgress((p) => ({ ...p, current: p.current + 1 }));
      await new Promise((r) => setTimeout(r, 300));
    }

    setResult({ added, skipped, notFound });
    setStatus('done');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-5 space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">CSVから一括追加</p>
        <p className="text-xs text-gray-400">
          1列目に英単語を1行1語で記載したCSVを選択。ヘッダー行は自動スキップされます。
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,.txt"
        onChange={handleFile}
        disabled={status === 'loading'}
        className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 disabled:opacity-50"
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {status === 'loading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>辞書から取得中…</span>
            <span>
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((progress.current / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="text-xs space-y-1 pt-1">
          <p className="text-green-600 font-medium">追加: {result.added.length}語</p>
          {result.skipped.length > 0 && (
            <p className="text-yellow-600">
              スキップ（重複）: {result.skipped.length}語
            </p>
          )}
          {result.notFound.length > 0 && (
            <p className="text-red-500">
              見つからず ({result.notFound.length}語): {result.notFound.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
