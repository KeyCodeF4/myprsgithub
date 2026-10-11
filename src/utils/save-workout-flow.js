export async function saveWorkoutAndCreateWrapped({ data, addWorkout, generateWrapped }) {
  await addWorkout({ ...data, mood: 3 });

  try {
    await generateWrapped('daily');
    return { workoutSaved: true, wrappedCreated: true, wrappedError: null };
  } catch (wrappedError) {
    return { workoutSaved: true, wrappedCreated: false, wrappedError };
  }
}
