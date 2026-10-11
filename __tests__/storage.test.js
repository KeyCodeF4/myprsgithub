import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteWorkout,
  getWorkouts,
  getWrappedCards,
  lockDailyWrappedCards,
  getThemeData,
  saveThemeData,
  saveWrappedCard,
  saveWorkout,
  updateWorkout,
} from '../src/utils/storage';
import { toLocalDateKey } from '../src/utils/dateUtils';

describe('workout editing and deletion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('updates the intended workout without changing its id', async () => {
    await saveWorkout({ id: 'one', date: '2026-07-30T08:00:00.000Z', duration: 30, exercises: [] });
    await saveWorkout({ id: 'two', date: '2026-07-30T18:00:00.000Z', duration: 40, exercises: [] });
    const updated = await updateWorkout('one', { duration: 55, id: 'wrong' });
    expect(updated).toHaveLength(2);
    expect(updated.find(item => item.id === 'one').duration).toBe(55);
  });

  test('deletes only the selected workout', async () => {
    await saveWorkout({ id: 'one', date: '2026-07-30T08:00:00.000Z', exercises: [] });
    await saveWorkout({ id: 'two', date: '2026-07-30T18:00:00.000Z', exercises: [] });
    await deleteWorkout('one');
    expect(await getWorkouts()).toEqual([
      { id: 'two', date: '2026-07-30T18:00:00.000Z', exercises: [] },
    ]);
  });

  test('upserts a daily card update instead of creating a duplicate', async () => {
    await saveWrappedCard({ id: 'daily_2026-07-30', type: 'daily', periodKey: '2026-07-30', createdAt: '2026-07-30T10:00:00Z', totalVolume: 1000 });
    await saveWrappedCard({ id: 'daily_2026-07-30', type: 'daily', periodKey: '2026-07-30', createdAt: '2026-07-30T18:00:00Z', totalVolume: 2000 });
    const cards = await getWrappedCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].totalVolume).toBe(2000);
  });

  test('locks previous daily cards but leaves today editable', async () => {
    const today = toLocalDateKey();
    await saveWrappedCard({ id: 'old', type: 'daily', periodKey: '2020-01-01', createdAt: '2020-01-01T12:00:00Z' });
    await saveWrappedCard({ id: 'today', type: 'daily', periodKey: today, createdAt: new Date().toISOString() });
    const cards = await lockDailyWrappedCards();
    expect(cards.find(card => card.id === 'old').locked).toBe(true);
    expect(cards.find(card => card.id === 'today').locked).not.toBe(true);
  });

  test('persists the equipped theme and unlocked theme inventory', async () => {
    await saveThemeData({ selectedThemeId: 'electric', unlockedThemeIds: ['iron', 'electric'] });
    await expect(getThemeData()).resolves.toEqual({ selectedThemeId: 'electric', unlockedThemeIds: ['iron', 'electric'] });
  });
});
