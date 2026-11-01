export function shouldStartFreshForAccount(
  localOwnerId: string | null,
  sessionUserId: string,
  remoteStateExists: boolean,
) {
  return Boolean(localOwnerId && localOwnerId !== sessionUserId && !remoteStateExists);
}
