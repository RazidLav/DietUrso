import { getSignedInUser } from "../cloud/cloudSync";
import { supabase } from "../cloud/supabase";
import { addProgressPhoto, removeProgressPhoto } from "./store";
import type { ProgressPhotoView } from "./types";

export const MAX_PROGRESS_PHOTO_BYTES = 10 * 1024 * 1024;
export const PROGRESS_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function validateProgressPhoto(file: { size: number; type: string }) { if (!PROGRESS_PHOTO_TYPES.has(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP."); if (file.size <= 0 || file.size > MAX_PROGRESS_PHOTO_BYTES) throw new Error("A foto deve ter no máximo 10 MB."); }

async function normalizedBlob(file: File, maxEdge: number, quality: number) {
  validateProgressPhoto(file);
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio)); const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Não foi possível comprimir a foto.");
  return { blob, width, height }; // canvas reencodes pixels and strips EXIF, including GPS.
}

export async function uploadProgressPhoto(file: File, input: { assessmentId?: string; view: ProgressPhotoView; notes?: string }) {
  if (!supabase) throw new Error("Sincronização não configurada."); const user = await getSignedInUser(); if (!user) throw new Error("Entre na conta para guardar fotos privadas.");
  const [image, thumb] = await Promise.all([normalizedBlob(file, 1800, .84), normalizedBlob(file, 420, .76)]);
  const id = crypto.randomUUID(); const base = `${user.id}/${id}`; const storagePath = `${base}.webp`; const thumbnailPath = `${base}-thumb.webp`;
  const uploaded: string[] = [];
  try {
    const main = await supabase.storage.from("progress-photos").upload(storagePath, image.blob, { contentType: "image/webp", cacheControl: "3600" }); if (main.error) throw main.error; uploaded.push(storagePath);
    const thumbnail = await supabase.storage.from("progress-photos").upload(thumbnailPath, thumb.blob, { contentType: "image/webp", cacheControl: "3600" }); if (thumbnail.error) throw thumbnail.error; uploaded.push(thumbnailPath);
    const capturedAt = new Date().toISOString(); const { error } = await supabase.from("progress_photos").insert({ id, user_id: user.id, assessment_id: input.assessmentId ?? null, view_type: input.view, storage_path: storagePath, thumbnail_path: thumbnailPath, mime_type: "image/webp", size_bytes: image.blob.size, width: image.width, height: image.height, captured_at: capturedAt, notes: input.notes?.trim() || null }); if (error) throw error;
    const photo = { id, assessmentId: input.assessmentId, view: input.view, capturedAt, storagePath, thumbnailPath, notes: input.notes?.trim() || undefined, createdAt: capturedAt }; await addProgressPhoto(photo); return photo;
  } catch (error) { if (uploaded.length) await supabase.storage.from("progress-photos").remove(uploaded); throw error; }
}

export async function signedProgressPhotoUrl(path: string) { if (!supabase) return null; const user = await getSignedInUser(); if (!user || !path.startsWith(`${user.id}/`)) return null; const { data, error } = await supabase.storage.from("progress-photos").createSignedUrl(path, 900); if (error) throw error; return data.signedUrl; }

export async function deleteProgressPhoto(id: string, paths: string[]) { if (!supabase) throw new Error("Sincronização não configurada."); const user = await getSignedInUser(); if (!user || paths.some((path) => !path.startsWith(`${user.id}/`))) throw new Error("Foto inválida para esta conta."); const { error: storageError } = await supabase.storage.from("progress-photos").remove(paths); if (storageError) throw storageError; const { error } = await supabase.from("progress_photos").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id); if (error) throw error; await removeProgressPhoto(id); }
