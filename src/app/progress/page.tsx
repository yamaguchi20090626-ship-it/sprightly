'use client';

import { useMemo } from 'react';
import { useWords } from '@/context/WordContext';

// SVG layout constants
const PAD = { l: 44, r: 20, t: 16, b: 38 };
const CW = 476;
const CH = 180;
const VW = PAD.l + CW + PAD.r; // 540
const VH = PAD.t + CH + PAD.b; // 234

function fmtMD(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Pt { ms: number; count: number }

export default function ProgressPage() {
  const words = useWords();

  const masteredCount = words.filter((w) => w.status === 'mastered').length;
  const studyTotal = words.reduce((s, w) => s + w.studyCount, 0);
  const correctTotal = words.reduce((s, w) => s + w.correctCount, 0);
  const correctRate = studyTotal > 0 ? Math.round((correctTotal / studyTotal) * 100) : 0;

  const { pts, xMin, xMax } = useMemo(() => {
    // Collect mastered timestamps in chronological order
    const dates = words
      .filter((w) => w.status === 'mastered')
      .map((w) => w.masteredAt ?? w.lastStudiedAt ?? w.addedAt)
      .sort((a, b) => a - b);

    if (!dates.length) {
      return { pts: [] as Pt[], xMin: Date.now(), xMax: Date.now() };
    }

    // Build cumulative points: one point per mastered word
    const raw: Pt[] = dates.map((ms, i) => ({ ms, count: i + 1 }));

    // Add origin: one day before first mastering at count=0
    raw.unshift({ ms: dates[0] - 86_400_000, count: 0 });

    // Extend to today so the graph reaches the present
    const now = Date.now();
    if (raw[raw.length - 1].ms < now) {
      raw.push({ ms: now, count: raw[raw.length - 1].count });
    }

    return { pts: raw, xMin: raw[0].ms, xMax: raw[raw.length - 1].ms };
  }, [words]);

  function xPx(ms: number): number {
    const range = xMax - xMin || 86_400_000;
    return PAD.l + ((ms - xMin) / range) * CW;
  }

  function yPx(count: number): number {
    const max = masteredCount || 1;
    return PAD.t + CH - (count / max) * CH;
  }

  const linePoints = pts.map((p) => `${xPx(p.ms)},${yPx(p.count)}`).join(' ');

  const fillPath =
    pts.length >= 2
      ? `M ${xPx(pts[0].ms)},${PAD.t + CH} ` +
        pts.map((p) => `L ${xPx(p.ms)},${yPx(p.count)}`).join(' ') +
        ` L ${xPx(pts[pts.length - 1].ms)},${PAD.t + CH} Z`
      : '';

  // Y-axis ticks at 0%, 25%, 50%, 75%, 100% of maxCount
  const yTickValues = [0, 0.25, 0.5, 0.75, 1]
    .map((r) => Math.round(r * masteredCount))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // X-axis: up to 5 evenly-spaced labels
  const labelCount = Math.min(5, pts.length);
  const xLabels =
    pts.length >= 2
      ? Array.from({ length: labelCount }, (_, i) => {
          const idx = Math.round((i / Math.max(labelCount - 1, 1)) * (pts.length - 1));
          return pts[idx];
        })
      : pts;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">学習進捗</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '習得済み', value: `${masteredCount}語`, color: 'text-green-400' },
          { label: '合計登録', value: `${words.length}語`, color: 'text-blue-300' },
          { label: '正解率', value: `${correctRate}%`, color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/10 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-300 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Line chart */}
      <div className="bg-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">習得単語数の推移</h2>

        {masteredCount === 0 ? (
          <div className="text-center py-10 space-y-1">
            <p className="text-slate-300 text-sm">まだ習得した単語がありません。</p>
            <p className="text-slate-400 text-xs">学習を続けるとグラフが表示されます。</p>
          </div>
        ) : (
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" aria-label="習得単語数グラフ">
            {/* Horizontal grid lines + Y labels */}
            {yTickValues.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.l} y1={yPx(v)}
                  x2={PAD.l + CW} y2={yPx(v)}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                  strokeDasharray={v === 0 ? undefined : '3 3'}
                />
                <text
                  x={PAD.l - 6} y={yPx(v) + 4}
                  textAnchor="end"
                  fill="#cbd5e1"
                  fontSize="10"
                >
                  {v}
                </text>
              </g>
            ))}

            {/* Fill area under line */}
            {fillPath && <path d={fillPath} fill="rgba(96,165,250,0.12)" />}

            {/* Main line */}
            {pts.length >= 2 && (
              <polyline
                points={linePoints}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Endpoint dot (today) */}
            {pts.length >= 1 && (
              <circle
                cx={xPx(pts[pts.length - 1].ms)}
                cy={yPx(pts[pts.length - 1].count)}
                r="4"
                fill="#4ade80"
              />
            )}

            {/* Axes */}
            <line
              x1={PAD.l} y1={PAD.t}
              x2={PAD.l} y2={PAD.t + CH}
              stroke="rgba(255,255,255,0.25)" strokeWidth="1"
            />
            <line
              x1={PAD.l} y1={PAD.t + CH}
              x2={PAD.l + CW} y2={PAD.t + CH}
              stroke="rgba(255,255,255,0.25)" strokeWidth="1"
            />

            {/* X-axis date labels */}
            {xLabels.map((p, i) => (
              <text
                key={i}
                x={xPx(p.ms)} y={PAD.t + CH + 20}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="10"
              >
                {fmtMD(p.ms)}
              </text>
            ))}

            {/* Y-axis label */}
            <text
              x={8} y={PAD.t + CH / 2}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="9"
              transform={`rotate(-90, 8, ${PAD.t + CH / 2})`}
            >
              単語数
            </text>
          </svg>
        )}
      </div>
    </div>
  );
}
