import type { EvolutionMetric, PhysicalAssessment, PhysicalGoalType, TrendSummary } from "./types";

export function metricValue(assessment: PhysicalAssessment, metric: EvolutionMetric) {
  if (metric === "weight_kg") return assessment.weightKg;
  return assessment.measurements[metric as keyof PhysicalAssessment["measurements"]]
    ?? assessment.composition[metric as keyof PhysicalAssessment["composition"]];
}

export function trendSummary(assessments: PhysicalAssessment[], metric: EvolutionMetric): TrendSummary {
  const points = assessments
    .map((assessment) => ({ date: Date.parse(assessment.takenAt), value: metricValue(assessment, metric) }))
    .filter((point): point is { date: number; value: number } => Number.isFinite(point.date) && typeof point.value === "number" && Number.isFinite(point.value))
    .sort((a, b) => a.date - b.date);
  if (!points.length) return { metric, count: 0, enoughData: false };
  const first = points[0].value;
  const current = points.at(-1)!.value;
  const average = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  const origin = points[0].date;
  const xs = points.map((point) => (point.date - origin) / 86400000);
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const denominator = xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  const numerator = points.reduce((sum, point, index) => sum + (xs[index] - xMean) * (point.value - average), 0);
  return {
    metric,
    count: points.length,
    first,
    current,
    absoluteChange: current - first,
    percentChange: first === 0 ? undefined : ((current - first) / Math.abs(first)) * 100,
    average,
    trendPerDay: denominator > 0 ? numerator / denominator : undefined,
    enoughData: points.length >= 3 && xs.at(-1)! - xs[0] >= 7,
  };
}

export function goalAwareDirection(goal: PhysicalGoalType, metric: EvolutionMetric, change?: number) {
  if (change === undefined || change === 0) return "neutral" as const;
  if (goal === "fat_loss" && (metric === "weight_kg" || metric === "waist" || metric === "body_fat_percent")) return change < 0 ? "toward_goal" : "away_from_goal";
  if (goal === "muscle_gain" && metric === "muscle_mass_kg") return change > 0 ? "toward_goal" : "away_from_goal";
  if (goal === "maintenance") return Math.abs(change) < 0.5 ? "toward_goal" : "neutral";
  return "neutral" as const;
}

export function compareAssessments(left: PhysicalAssessment, right: PhysicalAssessment) {
  const metrics = new Set<EvolutionMetric>([
    ...(left.weightKg !== undefined || right.weightKg !== undefined ? ["weight_kg" as const] : []),
    ...Object.keys(left.measurements) as EvolutionMetric[], ...Object.keys(right.measurements) as EvolutionMetric[],
    ...Object.keys(left.composition) as EvolutionMetric[], ...Object.keys(right.composition) as EvolutionMetric[],
  ]);
  return [...metrics].map((metric) => {
    const before = metricValue(left, metric);
    const after = metricValue(right, metric);
    return { metric, before, after, change: before !== undefined && after !== undefined ? after - before : undefined };
  });
}

export function kgToLb(value: number) { return value * 2.2046226218; }
export function lbToKg(value: number) { return value / 2.2046226218; }
export function cmToIn(value: number) { return value / 2.54; }
export function inToCm(value: number) { return value * 2.54; }
