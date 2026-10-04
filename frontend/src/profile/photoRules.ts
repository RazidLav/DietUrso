export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateProfilePhoto(file: { size: number; type: string }) {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (file.size <= 0 || file.size > MAX_PROFILE_PHOTO_BYTES) throw new Error("A foto deve ter no máximo 5 MB.");
}
