import { getSignedInUser } from "../cloud/cloudSync";
import { supabase } from "../cloud/supabase";
import { validateProfilePhoto } from "./photoRules";

export const PROFILE_PHOTO_BUCKET = "profile-photos";
export { ALLOWED_PROFILE_PHOTO_TYPES, MAX_PROFILE_PHOTO_BYTES, validateProfilePhoto } from "./photoRules";

function extensionFor(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

export async function uploadProfilePhoto(file: File, previousPath?: string | null) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  validateProfilePhoto(file);
  const user = await getSignedInUser();
  if (!user) throw new Error("Entre na sua conta para enviar uma foto.");
  const path = `${user.id}/profile.${extensionFor(file.type)}`;
  const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (error) throw error;
  if (previousPath && previousPath !== path && previousPath.startsWith(`${user.id}/`)) {
    const { error: cleanupError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([previousPath]);
    if (cleanupError) {
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
      throw cleanupError;
    }
  }
  const { data, error: signedError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError) throw signedError;
  return { path, signedUrl: data.signedUrl };
}

export async function resolveProfilePhotoUrl(path: string | null) {
  if (!path || !supabase) return null;
  const user = await getSignedInUser();
  if (!user || !path.startsWith(`${user.id}/`)) return null;
  const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeProfilePhoto(path: string | null) {
  if (!path) return;
  if (!supabase) throw new Error("Sincronização não configurada.");
  const user = await getSignedInUser();
  if (!user || !path.startsWith(`${user.id}/`)) throw new Error("Foto inválida para esta conta.");
  const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
  if (error) throw error;
}
