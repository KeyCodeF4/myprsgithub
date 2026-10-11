import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getCardTier } from '../config/cardTiers';
import { buildWrappedDetail, getDetailComment, summarizeSetLines } from '../utils/wrapped-detail';
import AnimatedMedalRing from './animated-medal-ring';

const TYPE_LABEL = { daily: 'Daily Wrapped', weekly: 'Weekly Wrapped', monthly: 'Monthly Wrapped' };
const LONG_WEEKDAY = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/;

function compactDateTitle(title) {
  return title.replace(LONG_WEEKDAY, weekday => weekday.slice(0, 3));
}

function StatCell({ label, value, color, muted, compact }) {
  return (
    <View style={[styles.statCell, compact && styles.statCellCompact]}>
      <Text style={[styles.statValue, compact && styles.statValueCompact, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{value}</Text>
      <Text style={[styles.statLabel, compact && styles.statLabelCompact, { color: muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>{label}</Text>
    </View>
  );
}

/**
 * Back face of a Wrapped card. Every figure comes from the workouts inside this
 * card's period (see buildWrappedDetail) — rows are omitted rather than showing
 * a zero when the underlying data does not exist.
 */
export default function WrappedCardBack({ card, workouts, width, height, equippedMedals = [], accent }) {
  const tier = getCardTier(card?.level || 1);
  const palette = tier.palette;
  const primary = accent || palette.primary;
  const compact = width < 300 || height < 500;
  const ultraCompact = width < 230;
  const medalSize = ultraCompact ? 18 : compact ? 20 : 24;
  const medalIconSize = ultraCompact ? 9 : compact ? 10 : 12;

  const detail = useMemo(() => buildWrappedDetail(card, workouts), [card, workouts]);
  const comment = useMemo(() => getDetailComment(detail), [detail]);

  // Cards written before titles were normalised may hold the whole title record
  // rather than a string; rendering that object directly would crash React.
  const titleText = useMemo(() => {
    const raw = card?.userTitle;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    return typeof raw.text === 'string' ? raw.text : null;
  }, [card]);

  const dateLabel = useMemo(() => {
    if (card?.title) return compact ? compactDateTitle(card.title) : card.title;
    if (!card?.periodStart) return '';
    return new Date(card.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [card, compact]);

  const compactVolume = detail.totalVolume >= 1000
    ? `${(detail.totalVolume / 1000).toFixed(detail.totalVolume >= 10000 ? 1 : 2).replace(/\.0$/, '')}k`
    : `${detail.totalVolume}`;
  const cells = [
    detail.totalVolume > 0 && { label: 'Volume', value: ultraCompact ? compactVolume : `${detail.totalVolume.toLocaleString()} kg` },
    detail.duration > 0 && { label: 'Time', value: ultraCompact ? `${detail.duration}m` : `${detail.duration} min` },
    detail.totalSets > 0 && { label: 'Sets', value: `${detail.totalSets}` },
    detail.totalReps > 0 && { label: 'Reps', value: `${detail.totalReps.toLocaleString()}` },
    detail.exerciseCount > 0 && { label: 'Exercises', value: `${detail.exerciseCount}` },
    detail.bestWeight > 0 && { label: 'Best set', value: ultraCompact ? `${detail.bestWeight}kg` : `${detail.bestWeight} kg` },
  ].filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        {
          width,
          height,
          backgroundColor: palette.background,
          borderColor: primary + '55',
          borderRadius: tier.frame.borderRadius,
          borderWidth: tier.frame.borderWidth,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text
            style={[styles.type, compact && styles.typeCompact, { color: primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            maxFontSizeMultiplier={1.1}
          >
            {TYPE_LABEL[card?.type] || 'Wrapped'}
          </Text>
          <Text
            style={[styles.date, compact && styles.dateCompact, { color: palette.textBright }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.58}
            maxFontSizeMultiplier={1.1}
          >
            {dateLabel}
          </Text>
          {titleText ? (
            <Text
              style={[styles.userTitle, compact && styles.userTitleCompact, { color: palette.secondary }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.58}
              maxFontSizeMultiplier={1.1}
            >
              {titleText}
            </Text>
          ) : null}
        </View>
        <View style={styles.medalRow}>
          {equippedMedals.slice(0, 3).map((medal, index) => (
            <AnimatedMedalRing
              key={medal.id}
              medal={medal}
              size={medalSize}
              iconSize={medalIconSize}
              phase={index * 120}
            />
          ))}
        </View>
      </View>

      {equippedMedals.find(medal => medal.tier === 'founder' && medal.serialNumber) && (
        <Text style={styles.founderSerial}>
          GENESIS #{String(equippedMedals.find(medal => medal.tier === 'founder').serialNumber).padStart(3, '0')} / 100
        </Text>
      )}

      <View style={[styles.divider, { backgroundColor: primary + '33' }]} />

      {!detail.hasData ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: palette.secondary }]}>
            The workout details for this Wrapped are no longer available.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statGrid}>
            {cells.map(cell => (
              <StatCell
                key={cell.label}
                label={cell.label}
                value={cell.value}
                color={palette.textBright}
                muted={palette.secondary}
                compact={compact}
              />
            ))}
          </View>

          {(detail.prs > 0 || detail.bestLift) && (
            <View style={styles.highlightRow}>
              {detail.prs > 0 && (
                <View style={[styles.chip, { borderColor: primary }]}>
                  <Text style={[styles.chipText, compact && styles.chipTextCompact, { color: primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}> 
                    🏆 {detail.prs} new PR{detail.prs === 1 ? '' : 's'}
                  </Text>
                </View>
              )}
              {detail.bestLift && detail.bestWeight > 0 && (
                <View style={[styles.chip, { borderColor: primary + '66' }]}>
                  <Text style={[styles.chipText, compact && styles.chipTextCompact, { color: palette.secondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    Top: {detail.bestLift}
                  </Text>
                </View>
              )}
            </View>
          )}

          <Text style={[styles.sectionLabel, compact && styles.sectionLabelCompact, { color: palette.secondary }]}>EXERCISES</Text>
          <ScrollView
            style={styles.exerciseScroll}
            contentContainerStyle={styles.exerciseScrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {detail.exercises.map(exercise => (
              <View key={exercise.name} style={[styles.exerciseRow, compact && styles.exerciseRowCompact, { borderBottomColor: primary + '18' }]}>
                <View style={styles.exerciseCopy}>
                  <Text style={[styles.exerciseName, compact && styles.exerciseNameCompact, { color: palette.textBright }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {exercise.name}
                  </Text>
                  {exercise.setLines.length > 0 && (
                    <Text style={[styles.exerciseSets, compact && styles.exerciseSetsCompact, { color: palette.secondary }]} numberOfLines={compact ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.74}>
                      {summarizeSetLines(exercise.setLines)}
                    </Text>
                  )}
                </View>
                {exercise.volume > 0 && !ultraCompact && (
                  <Text style={[styles.exerciseVolume, compact && styles.exerciseVolumeCompact, { color: palette.secondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {exercise.volume.toLocaleString()} kg
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>

          {comment && !ultraCompact ? (
            <Text style={[styles.comment, compact && styles.commentCompact, { color: palette.secondary }]} numberOfLines={compact ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.76}>{comment}</Text>
          ) : null}
        </>
      )}

      <Text style={[styles.flipHint, { color: palette.secondary }]}>Tap to flip back</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', padding: 18 },
  cardCompact: { padding: 13 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  type: { fontSize: 10, letterSpacing: 2, fontFamily: 'Inter_700Bold' },
  typeCompact: { fontSize: 8, letterSpacing: 1.4 },
  date: { fontSize: 17, lineHeight: 20, fontFamily: 'Inter_700Bold', marginTop: 3, flexShrink: 1 },
  dateCompact: { fontSize: 14, lineHeight: 16 },
  userTitle: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', marginTop: 3, letterSpacing: 0.5, flexShrink: 1 },
  userTitleCompact: { fontSize: 9, lineHeight: 11 },
  medalRow: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  founderSerial: { color: '#BDFBFF', fontSize: 7, letterSpacing: 1.5, fontFamily: 'Inter_700Bold', textAlign: 'right', marginTop: 5 },
  divider: { height: 1, marginVertical: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '33.33%', paddingVertical: 6 },
  statCellCompact: { paddingVertical: 3 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statValueCompact: { fontSize: 12 },
  statLabel: { fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_600SemiBold', marginTop: 2, textTransform: 'uppercase' },
  statLabelCompact: { fontSize: 7, letterSpacing: 0.7 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  chipText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  chipTextCompact: { fontSize: 8 },
  sectionLabel: { fontSize: 9, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginTop: 14, marginBottom: 4 },
  sectionLabelCompact: { fontSize: 7, marginTop: 8, letterSpacing: 1.4 },
  exerciseScroll: { flex: 1 },
  exerciseScrollContent: { paddingBottom: 16 },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1,
  },
  exerciseRowCompact: { gap: 6, paddingVertical: 5 },
  exerciseCopy: { flex: 1 },
  exerciseName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  exerciseNameCompact: { fontSize: 10 },
  exerciseSets: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  exerciseSetsCompact: { fontSize: 8 },
  exerciseVolume: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  exerciseVolumeCompact: { fontSize: 9 },
  comment: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 10, lineHeight: 16 },
  commentCompact: { fontSize: 9, marginTop: 5, lineHeight: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, fontFamily: 'Inter_400Regular' },
  flipHint: { fontSize: 9, textAlign: 'center', marginTop: 8, letterSpacing: 1, fontFamily: 'Inter_600SemiBold', opacity: 0.7 },
});
