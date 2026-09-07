export function applyIdempotentReward(rewardedEvents: Iterable<string>, totalXp: number, eventId: string, amount: number) {
  const rewarded = new Set(rewardedEvents);
  if (rewarded.has(eventId)) return { rewardedEvents: Array.from(rewarded), totalXp, rewarded: false };
  rewarded.add(eventId);
  return { rewardedEvents: Array.from(rewarded), totalXp: totalXp + amount, rewarded: true };
}
