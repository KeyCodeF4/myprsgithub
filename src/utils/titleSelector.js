import { TITLES, CATEGORIES } from '../config/titles';

const CHEST_ARMS_GROUPS = ['Chest', 'Arms', 'Biceps', 'Triceps', 'Shoulders'];
const LEG_GROUPS = ['Legs', 'Glutes', 'Quads', 'Hamstrings', 'Calves'];
const BACK_GROUPS = ['Back', 'Lats', 'Traps', 'Rear Delts'];

export function getCategoryForStats(stats, workouts) {
  const todayWorkouts = workouts || [];
  const lastWorkout = todayWorkouts[todayWorkouts.length - 1];
  const hour = lastWorkout ? new Date(lastWorkout.date).getHours() : new Date().getHours();

  if (stats.allTimeWorkouts <= 1) return 'first_timer';

  if (stats.prs > 0) return 'pr';

  if (hour >= 4 && hour <= 6) return 'early_morning';

  if (hour >= 22 || hour <= 2) return 'late_night';

  const muscleCounts = {};
  if (lastWorkout) {
    for (const e of lastWorkout.exercises) {
      const mg = e.muscleGroup || 'other';
      muscleCounts[mg] = (muscleCounts[mg] || 0) + 1;
    }
  }
  const totalExercises = Object.values(muscleCounts).reduce((a, b) => a + b, 0);

  if (totalExercises > 0) {
    const legCount = LEG_GROUPS.reduce((sum, g) => sum + (muscleCounts[g] || 0), 0);
    if (legCount / totalExercises >= 0.5) return 'leg_day';

    const chestArmsCount = CHEST_ARMS_GROUPS.reduce((sum, g) => sum + (muscleCounts[g] || 0), 0);
    if (chestArmsCount / totalExercises >= 0.5) return 'chest_arms';

    const backCount = BACK_GROUPS.reduce((sum, g) => sum + (muscleCounts[g] || 0), 0);
    if (backCount / totalExercises >= 0.5) return 'back_pull';
  }

  if (stats.totalVolume >= 5000) return 'high_volume';

  if (stats.totalVolume > 0 && stats.totalVolume < 500 && stats.totalSets < 6) return 'struggle';

  if (stats.streak && stats.streak >= 3) return 'consistency';

  if (stats.totalWorkouts > 0) return 'struggle';

  return 'first_timer';
}

export function selectTitle(category, lastTitleId) {
  const pool = TITLES.filter(t => t.category === category && t.id !== lastTitleId);
  if (pool.length === 0) {
    const fallback = TITLES.filter(t => t.category === category);
    return fallback.length > 0 ? fallback[Math.floor(Math.random() * fallback.length)] : TITLES[0];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getCategoryInfo(category) {
  return CATEGORIES[category] || { label: 'General', emoji: '💪' };
}
