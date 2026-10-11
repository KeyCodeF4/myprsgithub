import { saveWorkoutAndCreateWrapped } from '../src/utils/save-workout-flow';

describe('workout save orchestration', () => {
  test('creates the daily Wrapped after the workout is safely stored', async () => {
    const addWorkout = jest.fn().mockResolvedValue({});
    const generateWrapped = jest.fn().mockResolvedValue({ id: 'daily' });

    await expect(saveWorkoutAndCreateWrapped({
      data: { exercises: [] },
      addWorkout,
      generateWrapped,
    })).resolves.toEqual({ workoutSaved: true, wrappedCreated: true, wrappedError: null });

    expect(addWorkout).toHaveBeenCalledWith({ exercises: [], mood: 3 });
    expect(generateWrapped).toHaveBeenCalledWith('daily');
    expect(addWorkout.mock.invocationCallOrder[0]).toBeLessThan(generateWrapped.mock.invocationCallOrder[0]);
  });

  test('reports that the workout is safe when only Wrapped creation fails', async () => {
    const wrappedError = new Error('generator failed');
    const addWorkout = jest.fn().mockResolvedValue({});
    const generateWrapped = jest.fn().mockRejectedValue(wrappedError);

    await expect(saveWorkoutAndCreateWrapped({
      data: { exercises: [{ name: 'Bench Press' }] },
      addWorkout,
      generateWrapped,
    })).resolves.toEqual({ workoutSaved: true, wrappedCreated: false, wrappedError });
  });

  test('does not attempt Wrapped creation when workout storage fails', async () => {
    const addWorkout = jest.fn().mockRejectedValue(new Error('storage failed'));
    const generateWrapped = jest.fn();

    await expect(saveWorkoutAndCreateWrapped({
      data: { exercises: [] },
      addWorkout,
      generateWrapped,
    })).rejects.toThrow('storage failed');
    expect(generateWrapped).not.toHaveBeenCalled();
  });
});
