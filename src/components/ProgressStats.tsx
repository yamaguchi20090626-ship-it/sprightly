'use client';

import { useWords } from '@/context/WordContext';
import { useSettings } from '@/context/SettingsContext';

const R = 36;
const CX = 50;
const CY = 50;
const CIRC = 2 * Math.PI * R;

interface Segment {
  label: string;
  count: number;
  color: string;
  textColor: string;
}

function DonutChart({ segments, total }: { segments: Segment[]; total: number }) {
  let offset = 0;
  const slices = segments.map((s) => {
    const pct = total > 0 ? s.count / total : 0;
    const dash = pct * CIRC;
    const slice = { ...s, dash, offset };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {slices.map((s) =>
          s.count > 0 ? (
            <circle
              key={s.label}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ) : null
        )}
      </svg>

      <div className="space-y-2 flex-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className={`text-xs font-medium ${s.textColor}`}>{s.label}</span>
            </div>
            <span className="text-xs text-gray-500">
              {s.count}語 <span className="text-gray-400">({total > 0 ? Math.round((s.count / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const segments: Segment[] = [
    { label: '習得済み', count: counts.mastered, color: '#4ade80', textColor: 'text-green-600' },
    { label: '学習中',   count: counts.learning, color: '#facc15', textColor: 'text-yellow-600' },
    { label: '未学習',   count: counts.new,       color: '#94a3b8', textColor: 'text-slate-500' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">学習進捗</h2>
        <span className="text-xs text-gray-500">合計 {total} 語</span>
      </div>

      <DonutChart segments={segments} total={total} />

      <div className="space-y-1.5 pt-1 border-t border-gray-100">
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
    </div>
  );
}
