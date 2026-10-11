import { pluralize } from './pluralize';

const TIER_RARITY = { bronze: 25, silver: 50, gold: 100, platinum: 200 };
const MILESTONE_POINTS = [
  { threshold: 1000000, pts: 500 },
  { threshold: 500000, pts: 450 },
  { threshold: 250000, pts: 400 },
  { threshold: 100000, pts: 350 },
  { threshold: 50000, pts: 300 },
  { threshold: 25000, pts: 250 },
  { threshold: 10000, pts: 200 },
  { threshold: 5000, pts: 100 },
  { threshold: 1000, pts: 50 },
  { threshold: 500, pts: 25 },
  { threshold: 100, pts: 15 },
  { threshold: 10, pts: 10 },
];

const CANDIDATES = [
  {
    id: 'volume',
    label: 'Total Volume',
    icon: '🏋️',
    formatValue: (c, a) => `${(c.totalVolume || a?.totalVolume || 0).toLocaleString()} kg`,
    extractCurrent: (s) => s.totalVolume || 0,
    extractPrevious: (s) => s.totalVolume || 0,
    extractAllTime: (s) => s.allTimeVolume || s.totalVolume || 0,
    milestoneField: 'allTimeVolume',
    isPR: true,
  },
  {
    id: 'workouts',
    label: 'Workouts Completed',
    icon: '💪',
    formatValue: (c, a) => `${c.totalWorkouts || a?.totalWorkouts || 0}`,
    extractCurrent: (s) => s.totalWorkouts || 0,
    extractPrevious: (s) => s.totalWorkouts || 0,
    extractAllTime: (s) => s.allTimeWorkouts || s.totalWorkouts || 0,
    milestoneField: 'allTimeWorkouts',
    isPR: true,
  },
  {
    id: 'streak',
    label: 'Best Streak',
    icon: '🔥',
    formatValue: (c, a) => `${c.streak || a?.streak || 0} ${pluralize(c.streak || a?.streak || 0, 'day')}`,
    extractCurrent: (s) => s.streak || 0,
    extractPrevious: (s) => s.streak || 0,
    extractAllTime: (s) => s.streak || 0,
    milestoneField: 'streak',
    isPR: true,
  },
  {
    id: 'sets',
    label: 'Sets Completed',
    icon: '🔁',
    formatValue: (c, a) => `${(c.totalSets || a?.totalSets || 0).toLocaleString()}`,
    extractCurrent: (s) => s.totalSets || 0,
    extractPrevious: (s) => s.totalSets || 0,
    extractAllTime: (s) => s.allTimeSets || s.totalSets || 0,
    milestoneField: 'allTimeSets',
    isPR: false,
  },
  {
    id: 'reps',
    label: 'Total Reps',
    icon: '🔄',
    formatValue: (c, a) => `${(c.totalReps || a?.totalReps || 0).toLocaleString()}`,
    extractCurrent: (s) => s.totalReps || 0,
    extractPrevious: (s) => s.totalReps || 0,
    extractAllTime: (s) => s.allTimeReps || s.totalReps || 0,
    milestoneField: 'allTimeReps',
    isPR: false,
  },
  {
    id: 'prs',
    label: 'Personal Records',
    icon: '📈',
    formatValue: (c, a) => `${c.prs || a?.prs || 0} new`,
    extractCurrent: (s) => s.prs || 0,
    extractPrevious: (s) => s.prs || 0,
    extractAllTime: (s) => s.allTimePrs || s.prs || 0,
    milestoneField: null,
    isPR: false,
  },
  {
    id: 'duration',
    label: 'Time Spent',
    icon: '⏱️',
    formatValue: (c, a) => {
      const mins = c.duration || a?.duration || 0;
      if (mins >= 60) return `${Math.round(mins / 60)}h ${mins % 60}m`;
      return `${mins} min`;
    },
    extractCurrent: (s) => s.duration || 0,
    extractPrevious: (s) => s.duration || 0,
    extractAllTime: (s) => s.allTimeDuration || s.duration || 0,
    milestoneField: 'allTimeDuration',
    isPR: false,
  },
  {
    id: 'muscleGroups',
    label: 'Muscle Groups Hit',
    icon: '🎯',
    formatValue: (c, a) => `${c.uniqueMuscleGroups || a?.uniqueMuscleGroups || c.muscleGroups || a?.muscleGroups || c.muscleGroupsHit || a?.muscleGroupsHit || 0}`,
    extractCurrent: (s) => s.uniqueMuscleGroups || s.muscleGroupsHit || s.muscleGroups?.length || 0,
    extractPrevious: (s) => s.uniqueMuscleGroups || s.muscleGroupsHit || s.muscleGroups?.length || 0,
    extractAllTime: (s) => s.muscleGroups?.length || 0,
    milestoneField: null,
    isPR: false,
  },
  {
    id: 'heaviest',
    label: 'Heaviest Lift',
    icon: '🏆',
    formatValue: (c, a) => {
      const w = c.bestWeight || a?.bestWeight || 0;
      return w > 0 ? `${w} kg` : '—';
    },
    extractCurrent: (s) => s.bestWeight || 0,
    extractPrevious: (s) => s.bestWeight || 0,
    extractAllTime: (s) => s.bestWeight || 0,
    milestoneField: null,
    isPR: true,
  },
  {
    id: 'xp',
    label: 'XP Earned',
    icon: '⚡',
    formatValue: (c, a) => `${(c.totalXp || a?.totalXp || 0).toLocaleString()} XP`,
    extractCurrent: (s) => s.totalXp || 0,
    extractPrevious: (s) => s.totalXp || 0,
    extractAllTime: (s) => s.allTimeXp || s.totalXp || 0,
    milestoneField: 'allTimeXp',
    isPR: false,
  },
  {
    id: 'calories',
    label: 'Calories Burned',
    icon: '🔥',
    formatValue: (c, a) => `${((c.totalVolume || a?.totalVolume || 0) > 0 ? Math.round(((c.totalVolume || a?.totalVolume || 0) / 20) + ((c.totalReps || a?.totalReps || 0) * 0.5)) : 0).toLocaleString()} cal`,
    extractCurrent: (s) => (s.totalVolume > 0 ? Math.round(s.totalVolume / 20 + (s.totalReps || 0) * 0.5) : 0),
    extractPrevious: (s) => (s.totalVolume > 0 ? Math.round(s.totalVolume / 20 + (s.totalReps || 0) * 0.5) : 0),
    extractAllTime: (s) => 0,
    milestoneField: null,
    isPR: false,
  },
  {
    id: 'medals',
    label: 'Medals Unlocked',
    icon: '🎖️',
    formatValue: (c, a) => `${(c.newMedals || a?.newMedals || 0)}`,
    extractCurrent: (s) => s.newMedals || 0,
    extractPrevious: (s) => 0,
    extractAllTime: (s) => s.totalMedals || 0,
    milestoneField: null,
    isPR: false,
  },
];

function findMilestoneCrossed(before, after, field) {
  if (!field || before == null || after == null) return null;
  for (const m of MILESTONE_POINTS) {
    if (before < m.threshold && after >= m.threshold) return m;
  }
  return null;
}

function findMilestoneReached(value) {
  if (value == null || value <= 0) return null;
  for (const m of MILESTONE_POINTS) {
    if (value >= m.threshold) return m;
  }
  return null;
}

function formatPct(pct) {
  if (pct >= 200) return `+${Math.round(pct)}%`;
  if (pct >= 50) return `+${Math.round(pct)}%`;
  if (pct >= 10) return `+${Math.round(pct)}%`;
  return `+${pct.toFixed(1)}%`;
}

function generatePersonalWindowSubtext(cand, cur, prevVal) {
  const periods = ['session', 'week', 'month'];
  const pctDiff = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 100) : 0;
  if (pctDiff > 0) {
    const periodLabel = cand.id === 'volume' ? 'lifting day' : cand.id === 'workouts' ? 'training week' : cand.id === 'streak' ? 'consistency run' : 'session';
    return `Your biggest ${periodLabel} in recent memory`;
  }
  if (cur > 0) {
    return `Your personal best this period`;
  }
  return `Steady progress over time`;
}

export function scoreCandidateStats(input) {
  const {
    currentStats = {},
    previousStats = null,
    currentAllTime = null,
    previousAllTime = null,
    medals = [],
  } = input || {};

  const current = currentStats;
  const prev = previousStats || {};
  const allTime = currentAllTime || current;
  const prevAll = previousAllTime || {};

  const medalMaxRarity = medals.length > 0
    ? Math.max(...medals.map(m => TIER_RARITY[m.tier] || 0))
    : 0;

  const scored = CANDIDATES.map(cand => {
    let totalScore = 0;
    const reasons = [];

    const cur = cand.extractCurrent(current);
    const prevVal = cand.extractPrevious(prev);
    const curAll = cand.extractAllTime(allTime);
    const prevAllVal = cand.extractAllTime(prevAll);

    // 1. PR detected — highest priority
    if (cand.isPR && curAll > 0 && prevAllVal > 0 && curAll > prevAllVal) {
      totalScore += 1000;
      reasons.push('personal_record');
    }

    // 2. % increase vs your own previous period
    if (prevVal > 0 && cur > prevVal) {
      const pctInc = ((cur - prevVal) / prevVal) * 100;
      const incScore = Math.min(pctInc * 5, 500);
      totalScore += incScore;
      if (incScore >= 50) reasons.push('improvement');
    }

    // 3. Milestone crossed (all-time)
    const milestone = findMilestoneCrossed(prevAllVal, curAll, cand.milestoneField);
    if (milestone) {
      totalScore += milestone.pts;
      reasons.push('milestone');
    }

    // 4. Milestone reached (current value)
    const msReached = findMilestoneReached(cur);
    if (msReached && !milestone) {
      const bump = Math.round(msReached.pts * 0.3);
      totalScore += bump;
      if (bump >= 30) reasons.push('milestone');
    }

    // 5. Personal best window — current period value stands out against your own history
    if (cand.isPR && cur > 0 && prevAllVal > 0 && cur > prevAllVal * 1.5) {
      totalScore += 200;
      if (!reasons.includes('personal_record')) reasons.push('personal_window');
    }

    // 6. Medal rarity
    if (cand.id === 'medals' && medalMaxRarity > 0) {
      totalScore += medalMaxRarity;
      reasons.push('medal_rarity');
    }

    // 7. Non-zero bonus — having any data is better than nothing
    if (cur > 0 && totalScore === 0) {
      totalScore += 10;
      reasons.push('active');
    }

    // Build subtext — no comparison language, solo progress only
    let subtext = '';
    if (reasons.includes('personal_record')) {
      if (cand.id === 'volume') subtext = `New personal best! Previous best was ${(prevAllVal ?? 0).toLocaleString()} kg`;
      else if (cand.id === 'heaviest') subtext = `New personal record!`;
      else if (cand.id === 'workouts') subtext = `Most workouts you have ever logged in a period!`;
      else if (cand.id === 'streak') subtext = `Longest streak yet! Keep it going!`;
      else subtext = `New personal best!`;
    } else if (reasons.includes('personal_window')) {
      subtext = generatePersonalWindowSubtext(cand, cur, prevVal);
    } else if (reasons.includes('milestone')) {
      const ms = findMilestoneCrossed(prevAllVal, curAll, cand.milestoneField);
      if (ms) {
        const label = ms.threshold >= 1000000 ? `${(ms.threshold / 1000000).toFixed(0)}M`
          : ms.threshold >= 1000 ? `${(ms.threshold / 1000).toFixed(0)}K`
          : `${ms.threshold}`;
        subtext = `You crossed ${label} ${cand.id} — keep pushing!`;
      } else {
        subtext = `A milestone reached on your journey!`;
      }
    } else if (reasons.includes('improvement')) {
      const pctInc = prevVal > 0 ? ((cur - prevVal) / prevVal) * 100 : 0;
      subtext = `Up ${formatPct(pctInc).replace('+', '')} from your last ${cand.id === 'volume' ? 'session' : 'period'}`;
    } else if (reasons.includes('active')) {
      subtext = `Every session adds up`;
    } else {
      subtext = `Consistency is key`;
    }

    let priority = 'filler';
    if (totalScore >= 1000) priority = 'headline';
    else if (totalScore >= 150) priority = 'secondary';

    return {
      id: cand.id,
      label: cand.label,
      icon: cand.icon,
      value: cand.formatValue(current, allTime),
      subtext,
      score: Math.round(totalScore),
      priority,
      reasons,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored;
}

export function getHeadlineStats(scored, count = 2) {
  const headlines = scored.filter(s => s.priority === 'headline');
  if (headlines.length >= count) return headlines.slice(0, count);
  const secondary = scored.filter(s => s.priority === 'secondary' && !headlines.includes(s));
  const need = count - headlines.length;
  return [...headlines, ...secondary.slice(0, need)];
}

export function getFallbackStats(currentStats) {
  const wc = currentStats.totalWorkouts || currentStats.allTimeWorkouts || 0;
  if (wc === 0) {
    return [{
      id: 'first_workout',
      label: 'Ready to Start',
      icon: '🚀',
      value: '0 workouts',
      subtext: 'Log your first workout to see your stats here!',
      score: 1,
      priority: 'headline',
      reasons: ['fallback'],
    }];
  }
  return [{
    id: 'workouts',
    label: 'Workouts Completed',
    icon: '💪',
    value: `${wc}`,
    subtext: wc === 1 ? 'First workout logged! The journey begins.' : `${wc} workouts logged. Building consistency!`,
    score: 5,
    priority: 'headline',
    reasons: ['fallback'],
  }];
}
