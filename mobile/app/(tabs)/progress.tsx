// @ts-nocheck
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, Path, G } from 'react-native-svg';
import { useWords } from '../../context/WordContext';
import { useSettings } from '../../context/SettingsContext';

const SCREEN_W = Dimensions.get('window').width - 32;
const PAD = { l: 44, r: 20, t: 16, b: 38 };
const CW = SCREEN_W - PAD.l - PAD.r;
const CH = 160;
const VH = PAD.t + CH + PAD.b;

const R = 44;
const CX = 60;
const CY = 60;
const CIRC = 2 * Math.PI * R;

function fmtMD(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Pt { ms: number; count: number }

function DonutChart({ mastered, learning, newCount, total }: { mastered: number; learning: number; newCount: number; total: number }) {
  const segments = [
    { count: mastered, color: '#4ade80', label: '習得済み', textColor: '#4ade80' },
    { count: learning, color: '#facc15', label: '学習中',   textColor: '#facc15' },
    { count: newCount, color: '#94a3b8', label: '未学習',   textColor: '#94a3b8' },
  ];

  let offset = 0;
  const slices = segments.map((s) => {
    const pct = total > 0 ? s.count / total : 0;
    const dash = pct * CIRC;
    const slice = { ...s, dash, offset };
    offset += dash;
    return slice;
  });

  return (
    <View style={donut.row}>
      <Svg width={120} height={120} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={20} />
        {slices.map((s) => s.count > 0 ? (
          <Circle
            key={s.label}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={20}
            strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
            strokeDashoffset={-s.offset}
          />
        ) : null)}
      </Svg>
      <View style={donut.legend}>
        {segments.map((s) => (
          <View key={s.label} style={donut.legendRow}>
            <View style={[donut.dot, { backgroundColor: s.color }]} />
            <Text style={donut.legendLabel}>{s.label}</Text>
            <Text style={donut.legendCount}>
              {s.count}語 <Text style={donut.legendPct}>({total > 0 ? Math.round((s.count / total) * 100) : 0}%)</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const donut = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: '#e2e8f0', fontSize: 12, flex: 1 },
  legendCount: { color: '#94a3b8', fontSize: 12 },
  legendPct: { color: '#64748b', fontSize: 11 },
});

export default function ProgressScreen() {
  const words = useWords();
  const { goalCount } = useSettings();

  const masteredCount = words.filter((w) => w.status === 'mastered').length;
  const learningCount = words.filter((w) => w.status === 'learning').length;
  const newCount      = words.filter((w) => w.status === 'new').length;
  const studyTotal    = words.reduce((s, w) => s + w.studyCount, 0);
  const correctTotal  = words.reduce((s, w) => s + w.correctCount, 0);
  const correctRate   = studyTotal > 0 ? Math.round((correctTotal / studyTotal) * 100) : 0;
  const achievePct    = Math.min(100, Math.round((masteredCount / goalCount) * 100));

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
          { label: '正解率',   value: `${correctRate}%`,   color: '#fde68a' },
        ].map(({ label, value, color }) => (
          <View key={label} style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Donut chart */}
      {words.length > 0 && (
        <View style={styles.chartCard}>
          <DonutChart mastered={masteredCount} learning={learningCount} newCount={newCount} total={words.length} />
        </View>
      )}

      {/* Goal achievement */}
      <View style={styles.chartCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>目標達成率</Text>
          <Text style={styles.goalPct}>{achievePct}%</Text>
        </View>
        <View style={styles.goalBarBg}>
          <View style={[styles.goalBarFill, { width: `${achievePct}%` }]} />
        </View>
        <Text style={styles.goalCount}>{masteredCount} / {goalCount} 語（目標）</Text>
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
              <G key={v}>
                <Line x1={PAD.l} y1={yPx(v)} x2={PAD.l + CW} y2={yPx(v)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray={v === 0 ? undefined : '3 3'} />
                <SvgText x={PAD.l - 6} y={yPx(v) + 4} textAnchor="end" fill="#cbd5e1" fontSize="10">{v}</SvgText>
              </G>
            ))}
            {fillPath ? <Path d={fillPath} fill="rgba(96,165,250,0.12)" /> : null}
            {pts.length >= 2 && <Polyline points={polylinePoints} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
            {pts.length >= 1 && <Circle cx={xPx(pts[pts.length - 1].ms)} cy={yPx(pts[pts.length - 1].count)} r="4" fill="#4ade80" />}
            <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            <Line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            {xLabels.map((p, i) => (
              <SvgText key={i} x={xPx(p.ms)} y={PAD.t + CH + 20} textAnchor="middle" fill="#cbd5e1" fontSize="10">{fmtMD(p.ms)}</SvgText>
            ))}
            <SvgText x={8} y={PAD.t + CH / 2} textAnchor="middle" fill="#cbd5e1" fontSize="9" rotation={-90} originX={8} originY={PAD.t + CH / 2}>単語数</SvgText>
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
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  goalPct: { color: '#4ade80', fontSize: 14, fontWeight: '700' },
  goalBarBg: { height: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' },
  goalBarFill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 999 },
  goalCount: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 6 },
  chartTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  chartEmpty: { paddingVertical: 32, alignItems: 'center', gap: 6 },
  chartEmptyText: { color: '#94a3b8', fontSize: 14 },
  chartEmptySubText: { color: '#64748b', fontSize: 12 },
});
