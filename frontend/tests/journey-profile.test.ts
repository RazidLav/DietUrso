import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JOURNEY_ASSET_MANIFEST, journeyAssetForLevel } from "../src/gamification/assets";
import { AVATAR_DEFINITIONS, COSMETIC_DEFINITIONS } from "../src/gamification/cosmetics";
import {
  CHAPTERS,
  LEVEL_DEFINITIONS,
  XP_CURVE,
  chapterForLevel,
  completedChapterNumbers,
  levelFromXp,
  totalXpForLevel,
  xpForLevel,
} from "../src/gamification/journey";
import {
  createInitialProfileState,
  equipCosmetic,
  safeFeaturedItems,
  setFeaturedItems,
  validateUsername,
} from "../src/profile/rules";
import { validateProfilePhoto } from "../src/profile/photoRules";

test("jornada possui exatamente 100 níveis em 10 capítulos contínuos", () => {
  assert.equal(LEVEL_DEFINITIONS.length, 100);
  assert.equal(CHAPTERS.length, 10);
  assert.deepEqual(LEVEL_DEFINITIONS.map((level) => level.number), Array.from({ length: 100 }, (_, index) => index + 1));
  for (const chapter of CHAPTERS) {
    assert.equal(LEVEL_DEFINITIONS.filter((level) => level.chapterNumber === chapter.number).length, 10);
    assert.equal(chapter.lastLevel - chapter.firstLevel + 1, 10);
  }
  assert.equal(chapterForLevel(1).title, "O Despertar");
  assert.equal(chapterForLevel(100).title, "A Lenda UrsoFit");
});

test("curva de XP é crescente, estável nos limites e termina no nível narrativo 100", () => {
  assert.equal(xpForLevel(1), 180);
  assert.equal(xpForLevel(2), 225);
  for (let level = 2; level <= 100; level += 1) {
    assert.ok(totalXpForLevel(level) > totalXpForLevel(level - 1));
    assert.equal(levelFromXp(totalXpForLevel(level)).narrativeLevel, level);
  }
  const maxed = levelFromXp(totalXpForLevel(100) + 1234);
  assert.equal(maxed.narrativeLevel, XP_CURVE.maxNarrativeLevel);
  assert.equal(maxed.progress, 1);
  assert.equal(maxed.overflowXp, 1234);
  assert.deepEqual(completedChapterNumbers(100), [1,2,3,4,5,6,7,8,9,10]);
});

test("maior nível legado é preservado sem desbloquear regressão", () => {
  const protectedProgress = levelFromXp(0, 137);
  assert.equal(protectedProgress.narrativeLevel, 100);
  assert.equal(protectedProgress.legacyLevel, 137);
  assert.equal(protectedProgress.legacyFloorApplied, true);
});

test("conteúdo não confirmado fica explicitamente pendente em vez de ser inventado", () => {
  const official = new Map(LEVEL_DEFINITIONS.filter((level) => level.contentStatus === "official").map((level) => [level.number, level.title]));
  assert.deepEqual([...official], [[1, "Ursinho Desperto"], [2, "Saindo da Toca"], [10, "Primeira Insígnia"], [100, "Lenda UrsoFit"]]);
  assert.equal(LEVEL_DEFINITIONS[41].title, "Nível 42");
  assert.equal(LEVEL_DEFINITIONS[41].contentStatus, "awaiting_master_document");
});

test("assets de nível possuem chaves únicas e fallback rastreável", () => {
  const levelAssets = JOURNEY_ASSET_MANIFEST.filter((asset) => asset.ownerType === "level");
  assert.equal(levelAssets.length, 100);
  assert.equal(new Set(JOURNEY_ASSET_MANIFEST.map((asset) => asset.key)).size, JOURNEY_ASSET_MANIFEST.length);
  assert.equal(journeyAssetForLevel(42)?.ownerId, "level-042");
  assert.equal(journeyAssetForLevel(42)?.status, "awaiting_official_art");
});

test("catálogo de Meu Urso preserva 15 avatares e IDs globais únicos", () => {
  assert.equal(AVATAR_DEFINITIONS.length, 15);
  assert.equal(new Set(COSMETIC_DEFINITIONS.map((item) => item.id)).size, COSMETIC_DEFINITIONS.length);
  assert.equal(new Set(COSMETIC_DEFINITIONS.map((item) => item.assetKey)).size, COSMETIC_DEFINITIONS.length);
  assert.equal(AVATAR_DEFINITIONS.at(-1)?.secret, true);
});

test("perfil nasce privado, valida username e não equipa item bloqueado", () => {
  const profile = createInitialProfileState("2026-10-03T12:00:00.000Z");
  assert.equal(profile.profile.privacy, "private");
  assert.equal(profile.featured.length, 0);
  assert.equal(validateUsername("  Meu_Urso  ").normalized, "meu_urso");
  assert.equal(validateUsername("urso com espaço").valid, false);
  assert.equal(validateUsername("admin").valid, false);
  assert.equal(equipCosmetic(profile, "avatar", "avatar-01").equipped.avatar, "avatar-01");
  assert.throws(() => equipCosmetic(profile, "avatar", "avatar-15"), /desbloqueado/);
});

test("vitrine aceita no máximo três destaques desbloqueados e remove referências inválidas", () => {
  const profile = createInitialProfileState();
  const one = { id: "first-meal", type: "achievement" as const };
  const featured = setFeaturedItems(profile, [one, one], ["first-meal"]);
  assert.equal(featured.featured.length, 1);
  assert.throws(() => setFeaturedItems(profile, [{ id: "locked", type: "achievement" }], []), /desbloqueadas/);
  assert.throws(() => setFeaturedItems(profile, [one, { id: "a", type: "trophy" }, { id: "b", type: "relic" }, { id: "c", type: "relic" }], ["first-meal"]), /três/);
  assert.equal(safeFeaturedItems(featured, []).length, 0);
});

test("foto de perfil impõe tipo e limite antes do upload", () => {
  assert.doesNotThrow(() => validateProfilePhoto({ size: 1024, type: "image/png" } as File));
  assert.throws(() => validateProfilePhoto({ size: 1024, type: "image/gif" } as File), /JPG/);
  assert.throws(() => validateProfilePhoto({ size: 6 * 1024 * 1024, type: "image/jpeg" } as File), /5 MB/);
});

test("migration é idempotente, privada e protege equipamento/fotos por usuário", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261003200000_create_journey_profiles.sql", import.meta.url), "utf8");
  assert.match(sql, /generate_series\(1, 100\)/);
  assert.match(sql, /on conflict \(id\) do update/);
  assert.match(sql, /profiles_username_lower_unique/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /auth\.uid\(\).*user_id/);
  assert.match(sql, /equip_my_cosmetic/);
  assert.match(sql, /Cosmético ainda não desbloqueado/);
  assert.match(sql, /storage\.foldername\(name\)/);
  assert.match(sql, /public = false/);
});

test("Home mantém texto e arte em colunas reais, sem mascote absoluto", () => {
  const home = readFileSync(new URL("../app/(tabs)/index.tsx", import.meta.url), "utf8");
  assert.match(home, /stackHero/);
  assert.match(home, /heroArtwork/);
  assert.match(home, /home-progress-v2\.png/);
  assert.doesNotMatch(home, /heroMascot:\s*\{[^}]*position:\s*["']absolute["']/s);
});
