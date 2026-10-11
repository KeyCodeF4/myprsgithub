import { Share } from 'react-native';

async function cloud() {
  const { supabase } = await import('../lib/supabase');
  return supabase;
}

export const CHALLENGE_CARD_TYPES = ['daily', 'weekly', 'monthly'];

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function getLatestCard(cards = [], type) {
  return cards
    .filter(card => card.type === type)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

export function buildChallengeSnapshot(card, displayName = 'A friend') {
  if (!card) return null;
  const stats = card.stats || card.headlineStat || {};
  const totalVolume = number(stats.totalVolume || stats.volume);
  const totalReps = number(stats.totalReps || stats.reps);
  const totalSets = number(stats.totalSets || stats.sets);
  const duration = number(stats.totalDuration || stats.duration || stats.totalMinutes);
  const calories = number(stats.calories || stats.estimatedCalories || Math.round(totalVolume / 20 + totalReps * 0.5));
  const bestWeight = number(stats.bestWeight || stats.heaviestWeight || stats.maxWeight);
  const prCount = number(stats.prCount || stats.personalRecords || stats.prs);
  return {
    cardId: String(card.id),
    cardType: card.type,
    periodLabel: card.title || card.periodLabel || card.periodKey || 'Latest card',
    displayName: String(displayName || 'A friend').slice(0, 40),
    title: String(card.userTitle?.text || card.userTitle || 'The Challenger').slice(0, 40),
    metrics: {
      volume: Math.round(totalVolume),
      duration: Math.round(duration),
      calories: Math.round(calories),
      bestWeight: Math.round(bestWeight),
      reps: Math.round(totalReps),
      prs: Math.round(prCount),
    },
  };
}

export function scoreChallenge(left, right) {
  const keys = ['volume', 'duration', 'calories', 'bestWeight', 'reps', 'prs'];
  let leftScore = 0;
  let rightScore = 0;
  const rounds = keys.map(key => {
    const leftValue = number(left?.metrics?.[key]);
    const rightValue = number(right?.metrics?.[key]);
    let winner = 'tie';
    if (leftValue > rightValue) { winner = 'left'; leftScore += 1; }
    if (rightValue > leftValue) { winner = 'right'; rightScore += 1; }
    return { key, leftValue, rightValue, winner };
  });
  return {
    leftScore,
    rightScore,
    winner: leftScore === rightScore ? 'tie' : leftScore > rightScore ? 'left' : 'right',
    rounds,
  };
}

export function parseChallengeToken(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'myprs:' && parsed.hostname !== 'challenge' && !parsed.pathname.includes('challenge')) return null;
    if (parsed.protocol.startsWith('http') && !parsed.pathname.includes('/challenge')) return null;
    return parsed.searchParams.get('token');
  } catch (_error) {
    const match = url.match(/[?&]token=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export async function createFriendChallenge({ userId, cardType, snapshot }) {
  if (!userId) throw new Error('Sign in to challenge a friend.');
  const supabase = await cloud();
  const { data, error } = await supabase
    .from('friend_challenges')
    .insert({ challenger_id: userId, card_type: cardType, challenger_snapshot: snapshot })
    .select('id, invite_token')
    .single();
  if (error) throw error;
  return data;
}

export async function shareFriendChallenge(challenge, snapshot) {
  const baseUrl = (process.env.EXPO_PUBLIC_CHALLENGE_URL || 'https://myprs.app/challenge/').replace(/\/$/, '');
  const url = `${baseUrl}/?token=${encodeURIComponent(challenge.invite_token)}`;
  const volume = snapshot?.metrics?.volume?.toLocaleString?.() || '0';
  await Share.share({
    title: 'MyPRS friend challenge',
    message: `Beat my ${volume} kg ${snapshot.cardType} Wrapped. Accept my private MyPRS challenge: ${url}`,
    url,
  });
  return url;
}

export async function previewFriendChallenge(token) {
  const supabase = await cloud();
  const { data, error } = await supabase.rpc('preview_friend_challenge', { challenge_token: token });
  if (error) throw error;
  if (!data) throw new Error('This challenge link is invalid or has expired.');
  return data;
}

export async function acceptFriendChallenge(token, recipientSnapshot) {
  const supabase = await cloud();
  const { data, error } = await supabase.rpc('accept_friend_challenge', {
    challenge_token: token,
    response_snapshot: recipientSnapshot,
  });
  if (error) throw error;
  return data;
}

export async function getUnseenAcceptedChallenge(userId) {
  if (!userId) return null;
  const supabase = await cloud();
  const { data, error } = await supabase
    .from('friend_challenges')
    .select('*')
    .eq('status', 'accepted')
    .or(`challenger_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('accepted_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []).find(row =>
    (row.challenger_id === userId && !row.challenger_viewed) ||
    (row.recipient_id === userId && !row.recipient_viewed)
  ) || null;
}

export async function markChallengeViewed(challengeId, userId, challengerId) {
  const supabase = await cloud();
  const field = userId === challengerId ? 'challenger_viewed' : 'recipient_viewed';
  const { error } = await supabase.from('friend_challenges').update({ [field]: true }).eq('id', challengeId);
  if (error) throw error;
}
