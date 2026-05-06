// @ts-nocheck
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, Path } from 'react-native-svg';
import { useWords } from '../../context/WordContext';

const SCREEN_W = Dimensions.get('window').width - 32;
const PAD = { l: 44, r: 20, t: 16, b: 38 };
const CW = SCREEN_W - PAD.l - PAD.r;
const CH = 160;
const VH = PAD.t + CH + PAD.b;

function fmtMD(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Pt { ms: number; count: number }

export default function ProgressScreen() {
  const words = useWords();

  const masteredCount = words.filter((w) => w.status === 'mastered').length;
  const studyTotal = words.reduce((s, w) => s + w.studyCount, 0);
  const correctTotal = words.reduce((s, w) => s + w.correctCount, 0);
  const correctRate = studyTotal > 0 ? Math.round((correctTotal / studyTotal) * 100) : 0;

  const { pts, xMin, xMax } = useMemo(() => {
    const dates = words
      .filter((w) => w.status === 'mastered')
      .map((w) => w.masteredAt ?? w.lastStudiedAt ?? w.addedAt)
      .sort((a, b) => a - b);

    if (!dates.length) return { pts: [] as Pt[], xMin: Date.now(), xMax: Date.now() };

    const raw: Pt[] = dates.map((ms, i) => ({ ms, count: i + 1 }));
    raw.unshift({ ms: dates[0] - 86_400_000, count: 0 });
    const now = Date.now();
    if (raw[raw.length - 1].ms < now) raw.push({ ms: now, count: raw[raw.length - 1].count });

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

  const polylinePoints = pts.map((p) => `${xPx(p.ms)},${yPx(p.count)}`).join(' ');

  const fillPath =
    pts.length >= 2
      ? `M ${xPx(pts[0].ms)},${PAD.t + CH} ` +
        pts.map((p) => `L ${xPx(p.ms)},${yPx(p.count)}`).join(' ') +
        ` L ${xPx(pts[pts.length - 1].ms)},${PAD.t + CH} Z`
      : '';

  const yTickValues = [0, 0.25, 0.5, 0.75, 1]
    .map((r) => Math.round(r * masteredCount))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const labelCount = Math.min(5, pts.length);
  const xLabels =
    pts.length >= 2
      ? Array.from({ length: labelCount }, (_, i) => {
          const idx = Math.round((i / Math.max(labelCount - 1, 1)) * (pts.length - 1));
          return pts[idx];
        })
      : pts;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>学習進捗</Text>

      {/* Stats cards */}
      <View style={styles.statsGrid}>
        {[
          { label: '習得済み', value: `${masteredCount}語`, color: '#4ade80' },
          { label: '合計登録', value: `${words.length}語`, color: '#93c5fd' },
          { label: '正解率', value: `${correctRate}%`, color: '#fde68a' },
        ].map(({ label, value, color }) => (
          <View key={label} style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Line chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>習得単語数の推移</Text>

        {masteredCount === 0 ? (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>まだ習得した単語がありません。</Text>
            <Text style={styles.chartEmptySubText}>学習を続けるとグラフが表示されます。</Text>
          </View>
        ) : (
          <Svg width={SCREEN_W} height={VH}>
            {yTickValues.map((v) => (
              <React.Fragment key={v}>
                <Line
                  x1={PAD.l} y1={yPx(v)}
                  x2={PAD.l + CW} y2={yPx(v)}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                  strokeDasharray={v === 0 ? undefined : '3 3'}
                />
                <SvgText
                  x={PAD.l - 6} y={yPx(v) + 4}
                  textAnchor="end"
                  fill="#cbd5e1"
                  fontSize="10"
                >
                  {v}
                </SvgText>
              </React.Fragment>
            ))}

            {fillPath ? <Path d={fillPath} fill="rgba(96,165,250,0.12)" /> : null}

            {pts.length >= 2 && (
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {pts.length >= 1 && (
              <Circle
                cx={xPx(pts[pts.length - 1].ms)}
                cy={yPx(pts[pts.length - 1].count)}
                r="4"
                fill="#4ade80"
              />
            )}

            <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            <Line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

            {xLabels.map((p, i) => (
              <SvgText key={i} x={xPx(p.ms)} y={PAD.t + CH + 20} textAnchor="middle" fill="#cbd5e1" fontSize="10">
                {fmtMD(p.ms)}
              </SvgText>
            ))}

            <SvgText
              x={8} y={PAD.t + CH / 2}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize="9"
              rotation={-90}
              originX={8}
              originY={PAD.t + CH / 2}
            >
              単語数
            </SvgText>
          </Svg>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, gap: 16 },
  heading: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16 },
  chartTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  chartEmpty: { paddingVertical: 32, alignItems: 'center', gap: 6 },
  chartEmptyText: { color: '#94a3b8', fontSize: 14 },
  chartEmptySubText: { color: '#64748b', fontSize: 12 },
});

