import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { buildTrendData } from '../utils/trends-data';

const METRICS = {
  volume: { label: 'Volume', unit: 'kg', color: '#E63946' },
  e1rm: { label: 'Est. 1RM', unit: 'kg', color: '#7C5CFC' },
  frequency: { label: 'Frequency', unit: 'days', color: '#39D98A' },
};

function compact(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function LineChart({ points, color, unit }) {
  const [size, setSize] = useState({ width: 0, height: 156 });
  const max = Math.max(1, ...points.map(point => point.value));
  const padX = 12;
  const padY = 20;
  const usableW = Math.max(1, size.width - padX * 2);
  const usableH = size.height - padY * 2;
  const plotted = points.map((point, index) => ({
    ...point,
    x: padX + (points.length <= 1 ? usableW / 2 : index * usableW / (points.length - 1)),
    y: padY + usableH - (point.value / max) * usableH,
  }));

  return (
    <View style={styles.chart} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: 156 })} accessibilityLabel={`${METRICS[unit]?.label || unit} line graph`}>
      {[0, 1, 2, 3].map(line => <View key={line} style={[styles.gridLine, { top: padY + line * usableH / 3 }]} />)}
      {plotted.slice(0, -1).map((point, index) => {
        const next = plotted[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        return <View key={`line-${index}`} style={[styles.graphSegment, { backgroundColor: color, width: length, left: point.x, top: point.y, transform: [{ rotateZ: `${Math.atan2(dy, dx)}rad` }] }]} />;
      })}
      {plotted.map((point, index) => (
        <View key={`${point.label}-${index}`} style={[styles.pointWrap, { left: point.x - 5, top: point.y - 5 }]}>
          <View style={[styles.point, { borderColor: color }]} />
          {point.value > 0 && <Text style={[styles.pointValue, { color }]}>{compact(point.value)}</Text>}
        </View>
      ))}
      <View style={styles.chartLabels}>
        {points.map((point, index) => <Text key={`${point.label}-${index}`} style={styles.chartLabel}>{point.label}</Text>)}
      </View>
    </View>
  );
}

function Segmented({ values, selected, onSelect }) {
  return (
    <View style={styles.segmented}>
      {values.map(value => (
        <TouchableOpacity
          key={value.id}
          accessibilityRole="button"
          accessibilityState={{ selected: value.id === selected }}
          onPress={() => { Haptics.selectionAsync(); onSelect(value.id); }}
          activeOpacity={0.75}
          style={[styles.segment, value.id === selected && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value.id === selected && styles.segmentTextActive]}>{value.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function TrendsScreen({ workouts, onReturn, topInset = 0 }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [range, setRange] = useState('month');
  const [metric, setMetric] = useState('volume');
  const data = useMemo(() => buildTrendData(workouts, range), [workouts, range]);
  const metricInfo = METRICS[metric];
  const points = data.buckets.map(bucket => ({ label: bucket.label, value: bucket[metric] }));

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>YOUR TRAINING</Text>
          <Text style={styles.title}>Trends</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to Wrapped cards" onPress={onReturn} activeOpacity={0.75} style={styles.returnButton}>
          <Text style={styles.returnArrow}>↓</Text>
          <Text style={styles.returnLabel}>Cards</Text>
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Segmented values={[{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }]} selected={range} onSelect={setRange} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(200)} style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{data.summary.activeDays}</Text><Text style={styles.summaryLabel}>ACTIVE DAYS</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{compact(data.summary.totalVolume)}</Text><Text style={styles.summaryLabel}>KG MOVED</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{data.summary.bestE1RM || '—'}</Text><Text style={styles.summaryLabel}>BEST E1RM</Text></View>
        </Animated.View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View><Text style={styles.panelTitle}>{metricInfo.label}</Text><Text style={styles.panelSub}>Workout-to-workout progression · {metricInfo.unit}</Text></View>
          </View>
          <Segmented values={Object.entries(METRICS).map(([id, item]) => ({ id, label: item.label }))} selected={metric} onSelect={setMetric} />
          <LineChart points={points} color={metricInfo.color} unit={metric} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Muscle balance</Text>
          <Text style={styles.panelSub}>Training volume by muscle group</Text>
          {data.muscleGroups.length ? data.muscleGroups.slice(0, 6).map(group => (
            <View key={group.name} style={styles.muscleRow}>
              <Text style={styles.muscleName}>{group.name}</Text>
              <View style={styles.muscleTrack}><View style={[styles.muscleFill, { width: `${Math.max(5, group.proportion * 100)}%`, backgroundColor: theme.primary }]} /></View>
            </View>
          )) : <Text style={styles.empty}>Log more workouts to reveal your training balance.</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>PR history</Text>
          <Text style={styles.panelSub}>Estimated one-rep max milestones</Text>
          {data.prs.length ? data.prs.map((pr, index) => (
            <View key={pr.id} style={[styles.prRow, index < data.prs.length - 1 && styles.prBorder]}>
              <View style={styles.prBadge}><Text style={styles.prBadgeText}>PR</Text></View>
              <View style={styles.prCopy}><Text numberOfLines={1} style={styles.prExercise}>{pr.exercise}</Text><Text style={styles.prDate}>{pr.date}</Text></View>
              <Text style={styles.prValue}>{pr.value} kg</Text>
            </View>
          )) : <Text style={styles.empty}>Your estimated strength milestones will appear here.</Text>}
        </View>
        <Text style={styles.disclaimer}>Estimated 1RM uses the Epley formula. Treat it as a trend, not a maximal-lift prescription.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090A0D' },
  header: { height: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#25272D' },
  eyebrow: { fontSize: 9, letterSpacing: 2.2, fontFamily: 'Inter_700Bold' },
  title: { color: '#FFF', fontSize: 30, lineHeight: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  returnButton: { minWidth: 58, minHeight: 48, borderRadius: 16, backgroundColor: '#17191E', alignItems: 'center', justifyContent: 'center' },
  returnArrow: { color: '#FFF', fontSize: 17, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  returnLabel: { color: '#9B9DA5', fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, paddingBottom: 72, gap: 14 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: '#15171B', gap: 2 },
  segment: { flex: 1, minHeight: 34, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#2B2E35' },
  segmentText: { color: '#7F828B', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  segmentTextActive: { color: '#FFF' },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, minHeight: 78, borderRadius: 16, backgroundColor: '#15171B', borderWidth: 1, borderColor: '#23262C', padding: 12, justifyContent: 'space-between' },
  summaryValue: { color: '#FFF', fontSize: 22, fontFamily: 'Inter_700Bold' },
  summaryLabel: { color: '#747780', fontSize: 8, letterSpacing: 1.1, fontFamily: 'Inter_700Bold' },
  panel: { borderRadius: 20, backgroundColor: '#121419', borderWidth: 1, borderColor: '#22252B', padding: 16, gap: 12, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  panelTitle: { color: '#FFF', fontSize: 17, fontFamily: 'Inter_700Bold' },
  panelSub: { color: '#777A83', fontSize: 10, marginTop: 3, fontFamily: 'Inter_400Regular' },
  chart: { height: 176, marginTop: 4, position: 'relative' },
  gridLine: { position: 'absolute', height: StyleSheet.hairlineWidth, left: 0, right: 0, backgroundColor: '#292C33' },
  graphSegment: { position: 'absolute', height: 2, borderRadius: 2, transformOrigin: 'left center' },
  pointWrap: { position: 'absolute', width: 10, height: 10 },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#121419', borderWidth: 2 },
  pointValue: { position: 'absolute', bottom: 11, width: 42, left: -16, textAlign: 'center', fontSize: 8, fontFamily: 'Inter_700Bold' },
  chartLabels: { position: 'absolute', left: 2, right: 2, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  chartLabel: { color: '#656871', fontSize: 8, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muscleName: { color: '#C5C7CE', width: 72, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  muscleTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: '#252830' },
  muscleFill: { height: '100%', borderRadius: 4 },
  empty: { color: '#777A83', fontSize: 12, lineHeight: 18, paddingVertical: 10, fontFamily: 'Inter_400Regular' },
  prRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  prBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292C32' },
  prBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#2C1720', alignItems: 'center', justifyContent: 'center' },
  prBadgeText: { color: '#FF5264', fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  prCopy: { flex: 1 },
  prExercise: { color: '#E9E9EC', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  prDate: { color: '#666972', marginTop: 2, fontSize: 9, fontFamily: 'Inter_400Regular' },
  prValue: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  disclaimer: { color: '#555860', fontSize: 9, lineHeight: 14, paddingHorizontal: 6, fontFamily: 'Inter_400Regular' },
});

