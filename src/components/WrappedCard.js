import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const MUSCLE_GROUP_LABELS = {
  Chest: 'Chest',
  Legs: 'Legs',
  Back: 'Back',
  Shoulders: 'Shoulders',
  Arms: 'Arms',
  Core: 'Core',
  Cardio: 'Cardio',
};

function friendlyBest(muscleGroup, exerciseName) {
  if (exerciseName) return exerciseName;
  const label = MUSCLE_GROUP_LABELS[muscleGroup] || muscleGroup;
  return `no ${label.toLowerCase()} logged`;
}

function BestExercisesSection({ byGroup, muscleGroups, theme }) {
  const ordered = ['Chest', 'Legs', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio'];
  const present = ordered.filter(g => muscleGroups?.includes(g));
  if (present.length === 0) return null;
  return (
    <>
      {present.map(g => (
        <StatRow
          key={g}
          label={MUSCLE_GROUP_LABELS[g] || g}
          value={friendlyBest(g, byGroup?.[g])}
          theme={theme}
        />
      ))}
    </>
  );
}

export default function WrappedCard({ title, stats, type = 'daily', onLayout }) {
  const theme = useTheme();
  const isDaily = type === 'daily';

  return (
    <View style={[styles.card, {
      backgroundColor: theme.surface,
      borderColor: theme.primary,
      shadowColor: '#000',
    }]} onLayout={onLayout}>
      <Text style={[styles.badge, { color: theme.primary, fontFamily: theme.font.bold }]}>MyPRS</Text>
      <Text style={[styles.title, { color: theme.textPrimary, fontFamily: theme.font.bold }]}>{title}</Text>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {isDaily ? (
        <>
          <StatRow label="Total Volume" value={`${(stats.totalVolume ?? 0).toLocaleString()} kg`} theme={theme} />
          <StatRow label="Exercises" value={stats.totalExercises ?? 0} theme={theme} />
          <StatRow label="Sets" value={stats.totalSets ?? 0} theme={theme} />
          <StatRow label="Reps" value={stats.totalReps ?? 0} theme={theme} />
          <StatRow label="Duration" value={`${stats.duration ?? 0} min`} theme={theme} />
          <StatRow label="Muscle Groups" value={stats.muscleGroups?.join(', ')} theme={theme} />
          <BestExercisesSection byGroup={stats.bestExercisesByGroup} muscleGroups={stats.muscleGroups} theme={theme} />
        </>
      ) : (
        <>
          <StatRow label="Workouts" value={stats.totalWorkouts ?? 0} theme={theme} />
          <StatRow label="Total Volume" value={`${(stats.totalVolume ?? 0).toLocaleString()} kg`} theme={theme} />
          <StatRow label="Active Days" value={stats.uniqueDays ?? 0} theme={theme} />
          <StatRow label="Total Duration" value={`${stats.totalDuration ?? 0} min`} theme={theme} />
          <StatRow label="Calories" value={`${stats.totalCalories ?? 0}`} theme={theme} />
          <StatRow label="Top Exercise" value={stats.topExercise ?? ''} theme={theme} />
          <StatRow label="Avg Volume/Day" value={`${(stats.avgVolumePerDay ?? 0).toLocaleString()} kg`} theme={theme} />
          <StatRow label="Muscle Groups" value={stats.muscleGroups?.join(', ')} theme={theme} />
          <BestExercisesSection byGroup={stats.bestExercisesByGroup} muscleGroups={stats.muscleGroups} theme={theme} />
        </>
      )}

      <View style={[styles.footer, { marginTop: 16 }]}>
        <Text style={[styles.footerText, { color: theme.primary, fontFamily: theme.font.regular }]}>
          {isDaily ? "Today's grind never quits" : 'Weekly warrior status: UNREAL'}
        </Text>
      </View>
    </View>
  );
}

function StatRow({ label, value, theme }) {
  return (
      <View style={[styles.statRow, { borderBottomColor: theme.separator }]}>
      <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: theme.font.regular }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.textPrimary, fontFamily: theme.font.semiBold }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  badge: {
    fontSize: 12,
    letterSpacing: 3,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 14,
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
