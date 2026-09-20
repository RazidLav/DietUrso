export type DataLoadState = "idle" | "loading" | "success" | "empty" | "error";

export function resolvePlanView(cloudReady: boolean, loadState: DataLoadState, hasPlan: boolean, cloudError = false) {
  if (!cloudReady || loadState === "idle" || loadState === "loading") return "loading";
  if (cloudError && !hasPlan) return "error";
  if (loadState === "error" && !hasPlan) return "error";
  if (hasPlan) return "data";
  return loadState === "empty" ? "empty" : "loading";
}
