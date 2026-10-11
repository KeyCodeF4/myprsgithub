import { MEDALS } from '../data/medalsConfig';
import { RED, getAccentForLevel } from '../config/accentConfig';
import { XP_REWARDS, WRAPPED_TYPES } from '../config/xpConfig';

// Cumulative XP required to REACH a level.
//
// The previous curve — 200*(L-1)*(L+3) — needed 540,000 XP for Legendary (L51).
// At a committed pace (~13.5k XP/month: 26 dailies, 4 weeklies, 1 monthly) that
// is roughly 40 months, so almost every real user would only ever see the two
// lowest card tiers and the best artwork in the app was effectively dead content.
//
// This curve keeps the same quadratic shape (so progression still slows down and
// higher levels stay meaningful) with a much flatter coefficient:
//
//   tier        level   XP        ≈ time at a committed pace
//   Grinder       6      4,500      ~1.5 weeks
//   Veteran      16     22,500      ~2 months
//   Elite        31     72,000      ~5 months
//   Legendary    51    180,000      ~13 months
//
// Legendary stays a genuine year-long flex rather than a multi-year one.
export function getXpForLevel(level) {
  if (level <= 1) return 0;
  return 60 * (level - 1) * (level + 9);
}

export function getLevel(totalXp) {
  let level = 1;
  while (getXpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export function getXpProgress(totalXp) {
  const level = getLevel(totalXp);
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const xpInLevel = totalXp - currentLevelXp;
  const xpToNext = nextLevelXp - currentLevelXp;
  return {
    level,
    xpInLevel,
    xpToNext,
    progress: xpToNext > 0 ? xpInLevel / xpToNext : 1,
  };
}

export function computeXpForWrappedCard(card) {
  return XP_REWARDS.wrapped[card.type] || 0;
}

function xpForMedalTier(tier) {
  return XP_REWARDS.medal[tier] || 0;
}

export function computeTotalXp(wrappedCards, medals) {
  let xp = 0;

  // Only the first daily wrapped per periodKey earns XP
  const dailySeen = new Set();
  for (const c of wrappedCards) {
    if (c.type === 'daily') {
      if (dailySeen.has(c.periodKey)) continue;
      dailySeen.add(c.periodKey);
    }
    xp += computeXpForWrappedCard(c);
  }

  for (const m of medals) {
    if (m.unlockedAt) {
      const config = MEDALS[m.id];
      xp += config ? xpForMedalTier(config.tier) : 0;
    }
  }
  return xp;
}

export function computeXpBreakdown(wrappedCards, medals) {
  let fromWrapped = 0;
  const dailySeen = new Set();
  for (const c of wrappedCards) {
    if (c.type === 'daily') {
      if (dailySeen.has(c.periodKey)) continue;
      dailySeen.add(c.periodKey);
    }
    fromWrapped += computeXpForWrappedCard(c);
  }
  let fromMedals = 0;
  for (const m of medals) {
    if (m.unlockedAt) {
      const config = MEDALS[m.id];
      fromMedals += config ? xpForMedalTier(config.tier) : 0;
    }
  }
  return { fromWrapped, fromMedals };
}

const LEVEL_ACCENT = [
  { maxLevel: 9, stop: 300, label: 'NOVICE' },
  { maxLevel: 24, stop: 400, label: 'REGULAR' },
  { maxLevel: 49, stop: 500, label: 'VETERAN' },
  { maxLevel: Infinity, stop: 600, label: 'ELITE' },
];

export function getAccentColorFromLevel(level) {
  return getAccentForLevel(level);
}

export function getAccentLabelFromLevel(level) {
  for (const tier of LEVEL_ACCENT) {
    if (level <= tier.maxLevel) return tier.label;
  }
  return 'NOVICE';
}

export const LEVEL_NAMES = [
  { maxLevel: 9, name: 'Iron' },
  { maxLevel: 24, name: 'Steel' },
  { maxLevel: 49, name: 'Titanium' },
  { maxLevel: Infinity, name: 'Adamant' },
];

export function getLevelName(level) {
  for (const tier of LEVEL_NAMES) {
    if (level <= tier.maxLevel) return tier.name;
  }
  return 'Iron';
}
