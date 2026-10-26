export type TimelineFocusCandidate = {
  id: string;
  completed: boolean;
  active?: boolean;
  focusTime?: string;
};

const DEFAULT_MEAL_FOCUS_TIMES: Record<string, string> = {
  pre_treino: "06:30",
  cafe: "08:00",
  pos_treino: "10:00",
  almoco: "12:30",
  lanche: "16:00",
  jantar: "19:30",
  ceia: "21:30",
};

/**
 * Horário usado somente para posicionar refeições sem agenda na Home.
 * Não altera nem persiste o horário do plano alimentar.
 */
export function inferredMealFocusTime(mealType: string) {
  return DEFAULT_MEAL_FOCUS_TIMES[mealType];
}

export function resolveCurrentTimelineId(
  items: TimelineFocusCandidate[],
  isToday: boolean,
  now = new Date(),
) {
  const active = items.find((item) => item.active);
  if (active) return active.id;
  if (!isToday) return undefined;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const timed = items
    .filter((item) => !item.completed)
    .map((item) => ({ item, minutes: parseTime(item.focusTime) }))
    .filter((candidate): candidate is { item: TimelineFocusCandidate; minutes: number } => candidate.minutes != null)
    .sort((a, b) => {
      const distance = Math.abs(a.minutes - nowMinutes) - Math.abs(b.minutes - nowMinutes);
      if (distance) return distance;
      // Em um empate, a próxima atividade é mais útil que uma já atrasada.
      return Number(a.minutes < nowMinutes) - Number(b.minutes < nowMinutes);
    });

  return timed[0]?.item.id ?? items.find((item) => !item.completed)?.id;
}

/**
 * Mantém a ordem cronológica relativa, mas traz o item atual para o início.
 * Assim a Home acompanha o momento do dia sem esconder o que veio antes.
 */
export function prioritizeCurrentTimelineItem<T extends { id: string }>(items: T[], currentId?: string) {
  if (!currentId) return items;
  const currentIndex = items.findIndex((item) => item.id === currentId);
  if (currentIndex <= 0) return items;
  return [items[currentIndex], ...items.slice(currentIndex + 1), ...items.slice(0, currentIndex)];
}

function parseTime(value?: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}
