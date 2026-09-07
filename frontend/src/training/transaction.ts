export async function persistTrainingWithRollback<T>(
  previous: T,
  next: T,
  persist: (value: T) => Promise<void>,
  rollback: (value: T) => Promise<void>,
) {
  try {
    await persist(next);
    return next;
  } catch (error) {
    await rollback(previous);
    throw error;
  }
}
