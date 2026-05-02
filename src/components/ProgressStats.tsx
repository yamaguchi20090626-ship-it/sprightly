'use client';

import { useWords } from '@/context/WordContext';
import { useSettings } from '@/context/SettingsContext';

export default function ProgressStats() {
  const words = useWords();
  const { goalCount } = useSettings();

  const total = words.length;
  if (!total) return null;

  const counts = {
    mastered: words.filter((w) => w.status === 'mastered').length,
    learning: words.filter((w) => w.status === 'learning').length,
    new: words.filter((w) => w.status === 'new').length,
  };

  const achievePct = Math.min(100, Math.round((counts.mastered / goalCount) * 100));

  const bars: Array<{ label: string; count: number; bg: string; text: string }> = [
    { label: '習得済み', count: counts.mastered, bg: 'bg-green-400', text: 'text-green-600' },
    { label: '学習中', count: counts.learning, bg: 'bg-yellow-400', text: 'text-yellow-600' },
    { label: '未学習', count: counts.new, bg: 'bg-slate-400', text: 'text-slate-500' },
  ];

  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">学習進捗</h2>
        <span className="text-xs text-gray-500">合計 {total} 語</span>
      </div>

      {/* Goal achievement */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">目標達成度（習得済み / {goalCount}語）</span>
          <span className="font-semibold text-green-600">{achievePct}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-400 rounded-full transition-all duration-500"
            style={{ width: `${achievePct}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 text-right">
          {counts.mastered} / {goalCount} 語
        </p>
      </div>

      {/* Status breakdown bar chart */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className={`text-xs w-16 shrink-0 ${b.text} font-medium`}>{b.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
              <div
                className={`${b.bg} h-full rounded-full transition-all duration-500`}
                style={{ width: b.count > 0 ? `${(b.count / maxCount) * 100}%` : '0%' }}
              />
              {b.count > 0 && (
                <span className="absolute inset-0 flex items-center pl-2 text-xs font-semibold text-white drop-shadow-sm">
                  {b.count}語
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600 w-10 text-right shrink-0">
              {Math.round((b.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
