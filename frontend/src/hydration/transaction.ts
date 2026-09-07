export async function persistWithRollback<T>(
  previous: T,
  next: T,
  persist: (value: T) => Promise<void>,
  restore: (value: T) => Promise<void>
): Promise<T> {
  try {
    await persist(next);
    return next;
  } catch (error) {
    await restore(previous);
    throw error;
  }
}
