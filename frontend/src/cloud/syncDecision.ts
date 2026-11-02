export type SyncAction = "push_local" | "pull_cloud" | "conflict";

export function decideSyncAction(input: {
  hasRemote: boolean;
  baseRevision: string | null;
  remoteRevision: string | null;
  dirty: boolean;
}): SyncAction {
  if (!input.hasRemote) return "push_local";
  if (!input.baseRevision) return input.dirty ? "conflict" : "pull_cloud";
  if (!input.dirty) return "pull_cloud";
  return input.baseRevision === input.remoteRevision ? "push_local" : "conflict";
}
