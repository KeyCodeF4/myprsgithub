import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalWeekRange, getWorkoutDateKey } from './dateUtils';

const FRIENDS_KEY = '@myprs_friends';
const PROFILE_KEY = '@myprs_profile';
const REFERRALS_KEY = '@myprs_referrals';

let usernameCounter = 1;

const MOCK_NAMES = [
  'SwolePatrol', 'GainsGoblin', 'Reps4Jesus', 'LiftLarry',
  'SquatQueen', 'DeadliftDiva', 'CurlBoi', 'BenchBro',
  'RowMachine', 'PullUpPaul', 'CardioCarl', 'FlexFelix',
  'TitanTom', 'MuscleMike', 'PressPete', 'StronkSteve',
];

const MOCK_EXERCISES = [
  'Barbell Bench Press', 'Barbell Squat', 'Deadlift',
  'Pull Up', 'Overhead Press', 'Leg Press', 'Barbell Row',
];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateMockStats(baseActivity = 0.5) {
  const activity = baseActivity + (Math.random() - 0.5) * 0.4;
  const weeklyWorkouts = Math.round(activity * 7);
  const weeklyVolume = randomInt(Math.round(activity * 5000), Math.round(activity * 30000));
  const weeklyXp = weeklyWorkouts * 50 + randomInt(Math.round(activity * 200), Math.round(activity * 800));
  const lifetimeWorkouts = randomInt(Math.round(activity * 20), Math.round(activity * 200));
  const lifetimeVolume = lifetimeWorkouts * randomInt(3000, 8000);
  const lifetimeXp = lifetimeWorkouts * 80 + randomInt(500, 3000);
  const level = Math.max(1, Math.floor(lifetimeXp / 2000) + 1);
  return {
    weekly: { workouts: weeklyWorkouts, volume: weeklyVolume, xp: weeklyXp, streak: randomInt(0, Math.round(activity * 14)) },
    lifetime: { workouts: lifetimeWorkouts, volume: lifetimeVolume, xp: lifetimeXp, level, streak: randomInt(0, Math.round(activity * 30)) },
    topExercise: MOCK_EXERCISES[randomInt(0, MOCK_EXERCISES.length - 1)],
  };
}

export function generateMockFriends(count = 3) {
  const friends = [];
  const shuffled = [...MOCK_NAMES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    friends.push({
      id: `mock_${i}`,
      username: shuffled[i].toLowerCase(),
      displayName: shuffled[i],
      addedAt: new Date(Date.now() - randomInt(0, 30) * 86400000).toISOString(),
      isMock: true,
      stats: generateMockStats(0.3 + Math.random() * 0.6),
      referredBy: null,
    });
  }
  return friends;
}

// ── Storage ──

export async function getFriends() {
  const data = await AsyncStorage.getItem(FRIENDS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveFriends(friends) {
  await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  return friends;
}

export async function addFriend(friendData) {
  const friends = await getFriends();
  if (friends.find(f => f.username === friendData.username)) return null;
  const newFriend = {
    id: `friend_${Date.now()}`,
    username: friendData.username,
    displayName: friendData.displayName || friendData.username,
    addedAt: new Date().toISOString(),
    isMock: false,
    stats: generateMockStats(0.4),
    referredBy: friendData.referredBy || null,
  };
  friends.push(newFriend);
  await saveFriends(friends);
  return newFriend;
}

export async function removeFriend(friendId) {
  const friends = await getFriends();
  const filtered = friends.filter(f => f.id !== friendId);
  await saveFriends(filtered);
  return filtered;
}

// ── Profile ──

export async function getProfile() {
  const data = await AsyncStorage.getItem(PROFILE_KEY);
  if (data) return JSON.parse(data);
  const newProfile = {
    username: `user${String(usernameCounter++).padStart(4, '0')}`,
    referralCode: `GW-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    referralsCompleted: 0,
    referralBonusClaimed: false,
    unlockedThemes: ['default'],
  };
  await saveProfile(newProfile);
  return newProfile;
}

export async function saveProfile(profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

// ── Referrals ──

export async function getReferrals() {
  const data = await AsyncStorage.getItem(REFERRALS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveReferrals(referrals) {
  await AsyncStorage.setItem(REFERRALS_KEY, JSON.stringify(referrals));
  return referrals;
}

export async function claimReferral(code) {
  const profile = await getProfile();
  if (profile.referralCode === code) return { error: "Can't use your own code" };
  const referrals = await getReferrals();
  if (referrals.find(r => r.code === code && r.completedAt)) return { error: 'Code already used' };
  referrals.push({ code, completedAt: new Date().toISOString() });
  await saveReferrals(referrals);
  profile.referralsCompleted = (profile.referralsCompleted || 0) + 1;
  profile.referralBonusClaimed = true;
  if (!profile.unlockedThemes.includes('referral')) {
    profile.unlockedThemes.push('referral');
  }
  await saveProfile(profile);
  return { success: true, bonusXp: 200, theme: 'referral' };
}

// ── Leaderboard ──

export function buildLeaderboard(userStats, friends) {
  const entries = [{ id: 'me', username: 'You', displayName: 'You', stats: userStats, isUser: true }];
  for (const f of friends) {
    entries.push({ id: f.id, username: f.username, displayName: f.displayName, stats: f.stats, isUser: false });
  }
  return entries.sort((a, b) => b.stats.weekly.xp - a.stats.weekly.xp);
}

// ── Mock user stats from workouts (for leaderboard) ──

export function computeUserWeeklyStats(workouts) {
  const { start: weekStart, end: weekEnd } = getLocalWeekRange();

  let xp = 0;
  let volume = 0;
  let wCount = 0;
  const uniqueDays = new Set();

  for (const w of workouts) {
    const d = new Date(w.date);
    if (d >= weekStart && d < weekEnd) {
      wCount++;
      uniqueDays.add(getWorkoutDateKey(w));
      for (const e of w.exercises) {
        xp += (e.sets || 0) * 5;
        volume += (e.weight || 0) * (e.reps || 0) * (e.sets || 0);
      }
      xp += 50;
    }
  }

  return {
    weekly: { workouts: wCount, volume, xp, streak: uniqueDays.size },
    lifetime: { workouts: workouts.length },
    topExercise: '—',
  };
}
