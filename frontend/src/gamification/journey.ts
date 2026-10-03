export const JOURNEY_VERSION = 1;

export const XP_CURVE = {
  baseXp: 180,
  growthPerLevel: 45,
  maxNarrativeLevel: 100,
  legacyMaxLevel: 999,
} as const;

export interface ChapterDefinition {
  id: string;
  number: number;
  title: string;
  firstLevel: number;
  lastLevel: number;
  assetKey: string;
}

export interface LevelDefinition {
  id: string;
  number: number;
  chapterNumber: number;
  order: number;
  title: string;
  description: string;
  minXp: number;
  xpForNextLevel: number;
  assetKey: string;
  assetDescription: string;
  rewardId?: string;
  special: boolean;
  active: boolean;
  version: number;
  contentStatus: "official" | "awaiting_master_document";
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  { id: "chapter-01", number: 1, title: "O Despertar", firstLevel: 1, lastLevel: 10, assetKey: "chapter-01-o-despertar" },
  { id: "chapter-02", number: 2, title: "Criando Raízes", firstLevel: 11, lastLevel: 20, assetKey: "chapter-02-criando-raizes" },
  { id: "chapter-03", number: 3, title: "Explorando o Caminho", firstLevel: 21, lastLevel: 30, assetKey: "chapter-03-explorando-o-caminho" },
  { id: "chapter-04", number: 4, title: "Força em Construção", firstLevel: 31, lastLevel: 40, assetKey: "chapter-04-forca-em-construcao" },
  { id: "chapter-05", number: 5, title: "A Jornada Fica Séria", firstLevel: 41, lastLevel: 50, assetKey: "chapter-05-a-jornada-fica-seria" },
  { id: "chapter-06", number: 6, title: "Subindo a Montanha", firstLevel: 51, lastLevel: 60, assetKey: "chapter-06-subindo-a-montanha" },
  { id: "chapter-07", number: 7, title: "Provação", firstLevel: 61, lastLevel: 70, assetKey: "chapter-07-provacao" },
  { id: "chapter-08", number: 8, title: "Maestria", firstLevel: 71, lastLevel: 80, assetKey: "chapter-08-maestria" },
  { id: "chapter-09", number: 9, title: "O Raro e o Lendário", firstLevel: 81, lastLevel: 90, assetKey: "chapter-09-raro-e-lendario" },
  { id: "chapter-10", number: 10, title: "A Lenda UrsoFit", firstLevel: 91, lastLevel: 100, assetKey: "chapter-10-lenda-ursofit" },
] as const;

// Somente nomes já confirmados nas fontes disponíveis entram como conteúdo oficial.
// O documento-mestre não acompanha o repositório; os demais nós continuam
// identificados como pendentes para evitar inventar ou parafrasear a narrativa.
const CONFIRMED_LEVEL_TITLES: Readonly<Record<number, string>> = {
  1: "Ursinho Desperto",
  2: "Saindo da Toca",
  10: "Primeira Insígnia",
  100: "Lenda UrsoFit",
};

export const SPECIAL_LEVELS = new Set([1, 5, 10, 20, 25, 30, 42, 50, 60, 69, 70, 80, 88, 89, 95, 99, 100]);

export function xpForLevel(level: number) {
  const normalized = Math.max(1, Math.floor(level));
  return XP_CURVE.baseXp + (normalized - 1) * XP_CURVE.growthPerLevel;
}

export function totalXpForLevel(level: number) {
  const target = Math.max(1, Math.min(XP_CURVE.maxNarrativeLevel, Math.floor(level)));
  let total = 0;
  for (let current = 1; current < target; current += 1) total += xpForLevel(current);
  return total;
}

export function chapterForLevel(level: number) {
  const normalized = Math.max(1, Math.min(XP_CURVE.maxNarrativeLevel, Math.floor(level)));
  return CHAPTERS[Math.floor((normalized - 1) / 10)];
}

function levelDefinition(number: number): LevelDefinition {
  const confirmedTitle = CONFIRMED_LEVEL_TITLES[number];
  const chapter = chapterForLevel(number);
  return {
    id: `level-${String(number).padStart(3, "0")}`,
    number,
    chapterNumber: chapter.number,
    order: number,
    title: confirmedTitle ?? `Nível ${number}`,
    description: confirmedTitle
      ? "Descrição oficial aguardando importação do documento-mestre."
      : "Conteúdo narrativo oficial aguardando o documento-mestre.",
    minXp: totalXpForLevel(number),
    xpForNextLevel: number === XP_CURVE.maxNarrativeLevel ? 0 : xpForLevel(number),
    assetKey: `level-${String(number).padStart(3, "0")}-collectible`,
    assetDescription: `Asset oficial do nível ${number} aguardando produção ou importação.`,
    rewardId: number % 10 === 0 ? `medallion-chapter-${String(chapter.number).padStart(2, "0")}` : undefined,
    special: SPECIAL_LEVELS.has(number),
    active: true,
    version: JOURNEY_VERSION,
    contentStatus: confirmedTitle ? "official" : "awaiting_master_document",
  };
}

export const LEVEL_DEFINITIONS: readonly LevelDefinition[] = Array.from(
  { length: XP_CURVE.maxNarrativeLevel },
  (_, index) => levelDefinition(index + 1)
);

export function getLevelDefinition(level: number) {
  const normalized = Math.max(1, Math.min(XP_CURVE.maxNarrativeLevel, Math.floor(level)));
  return LEVEL_DEFINITIONS[normalized - 1];
}

function rawLevelFromXp(totalXp: number, maxLevel: number) {
  let level = 1;
  let remaining = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0);
  while (level < maxLevel) {
    const required = xpForLevel(level);
    if (remaining < required) break;
    remaining -= required;
    level += 1;
  }
  return { level, remaining };
}

export function levelFromXp(totalXp: number, legacyFloor = 1) {
  const safeXp = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0);
  const legacy = rawLevelFromXp(safeXp, XP_CURVE.legacyMaxLevel);
  const protectedLegacyLevel = Math.max(1, Math.floor(legacyFloor), legacy.level);
  const legacyFloorApplied = protectedLegacyLevel > legacy.level;
  const calculatedNarrative = Math.min(protectedLegacyLevel, XP_CURVE.maxNarrativeLevel);
  const definition = getLevelDefinition(calculatedNarrative);
  const maxed = calculatedNarrative === XP_CURVE.maxNarrativeLevel;
  const xpIntoLevel = maxed
    ? Math.max(0, safeXp - definition.minXp)
    : legacyFloorApplied
      ? Math.max(0, safeXp - definition.minXp)
      : legacy.remaining;
  const xpForNextLevel = maxed ? 0 : xpForLevel(calculatedNarrative);
  const progress = maxed ? 1 : Math.max(0, Math.min(1, xpIntoLevel / xpForNextLevel));
  const chapter = chapterForLevel(calculatedNarrative);

  return {
    level: calculatedNarrative,
    narrativeLevel: calculatedNarrative,
    legacyLevel: protectedLegacyLevel,
    legacyFloorApplied,
    title: definition.title,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    xpIntoLevel,
    xpForNextLevel,
    progress,
    isMaxLevel: maxed,
    overflowXp: maxed ? xpIntoLevel : 0,
  };
}

export function completedChapterNumbers(level: number) {
  return CHAPTERS.filter((chapter) => level >= chapter.lastLevel).map((chapter) => chapter.number);
}
