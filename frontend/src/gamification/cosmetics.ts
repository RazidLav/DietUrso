export type CosmeticKind = "avatar" | "frame" | "title" | "banner" | "medallion" | "trophy" | "relic";
export type CosmeticRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface UnlockCondition {
  type: "default" | "level" | "streak" | "achievement" | "chapter" | "future";
  value?: number | string;
}

export interface CosmeticDefinition {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  assetKey: string;
  unlock: UnlockCondition;
  rarity: CosmeticRarity;
  secret?: boolean;
  order: number;
  active: boolean;
}

const avatarCatalog = [
  { name: "Urso Clássico", description: "Mascote padrão, esportivo e simpático.", unlock: { type: "default" } },
  { name: "Urso Maromba", description: "Regata, físico atlético e shaker.", unlock: { type: "achievement", value: "strength-milestone" } },
  { name: "Urso das Neves", description: "Pelagem branca, detalhes azul-claro.", unlock: { type: "future", value: "journey-or-event-milestone" } },
  { name: "Urso Emo", description: "Preto/roxo, franja e expressão dramática.", unlock: { type: "future", value: "emo-theme-cosmetic" } },
  { name: "Urso Gratiluz", description: "Claro, solar, flor/estrela discreta.", unlock: { type: "future", value: "gratiluz-theme-cosmetic" } },
  { name: "Urso Caipira", description: "Chapéu de palha e xadrez discreto.", unlock: { type: "future", value: "seasonal-collection" } },
  { name: "Urso Corredor", description: "Faixa, smartwatch e visual runner.", unlock: { type: "achievement", value: "running-milestone" } },
  { name: "Urso Ciclista", description: "Capacete e óculos esportivos.", unlock: { type: "achievement", value: "cycling-milestone" } },
  { name: "Urso Lutador", description: "Bandagens/luvas; visual genérico de luta.", unlock: { type: "achievement", value: "combat-milestone" } },
  { name: "Urso Zen", description: "Roupa leve e pose tranquila.", unlock: { type: "achievement", value: "mobility-milestone" } },
  { name: "Urso HIIT", description: "Faixa, suor fofo e energia.", unlock: { type: "achievement", value: "hiit-cardio-milestone" } },
  { name: "Chef da Caverna", description: "Avental e chapéu de chef.", unlock: { type: "achievement", value: "food-creation-milestone" } },
  { name: "Urso Noturno", description: "Azul-marinho, lua e olheiras fofas.", unlock: { type: "achievement", value: "night-owl" }, secret: true },
  { name: "Urso Explorador", description: "Mochila e bússola.", unlock: { type: "chapter", value: 3 } },
  { name: "Urso Brilho Raro", description: "Variante shiny/iridescente.", unlock: { type: "level", value: 95 } },
] satisfies readonly { name: string; description: string; unlock: UnlockCondition; secret?: boolean }[];

export const AVATAR_DEFINITIONS: readonly CosmeticDefinition[] = avatarCatalog.map((avatar, index) => ({
  id: `avatar-${String(index + 1).padStart(2, "0")}`,
  kind: "avatar",
  name: avatar.name,
  description: avatar.description,
  assetKey: `bear-${avatar.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
  unlock: avatar.unlock,
  rarity: index === 14 ? "mythic" : index >= 11 ? "epic" : index >= 5 ? "rare" : "common",
  secret: avatar.secret,
  order: index + 1,
  active: true,
}));

const legacyTitles = [
  [1, "Ursinho Recém-Acordado"], [3, "Urso do Lanchinho"], [5, "Urso Proteinado"], [10, "Urso Maromba"],
  [15, "Urso Parrudo"], [20, "Urso Brabo"], [30, "Urso Absolutamente Enorme"], [40, "Rei da Floresta Proteica"],
  [50, "Urso Anabolizado Naturalmente™"], [75, "Urso Cósmico"],
] as const;

const streakTitles = [
  [3, "Pegando o Ritmo"], [7, "Urso Consistente"], [14, "Firme igual pata de urso"],
  [30, "Modo Maromba Ativado"], [60, "Isso já virou personalidade"], [100, "Lendário da Floresta"],
] as const;

export const TITLE_DEFINITIONS: readonly CosmeticDefinition[] = [
  ...legacyTitles.map(([level, name], index) => ({ id: `title-legacy-${level}`, kind: "title" as const, name, description: "Título preservado da progressão original do UrsoFit.", assetKey: `title-legacy-${level}`, unlock: { type: "level" as const, value: level }, rarity: level >= 75 ? "legendary" as const : level >= 30 ? "epic" as const : "rare" as const, order: index + 1, active: true })),
  ...streakTitles.map(([days, name], index) => ({ id: `title-streak-${days}`, kind: "title" as const, name, description: `Título de constância por ${days} dias.`, assetKey: `title-streak-${days}`, unlock: { type: "streak" as const, value: days }, rarity: days >= 100 ? "mythic" as const : days >= 30 ? "epic" as const : "rare" as const, order: legacyTitles.length + index + 1, active: true })),
];

export const BASE_COSMETICS: readonly CosmeticDefinition[] = [
  { id: "frame-classic", kind: "frame", name: "Moldura da Toca", description: "Moldura inicial do perfil.", assetKey: "frame-classic", unlock: { type: "default" }, rarity: "common", order: 1, active: true },
  { id: "banner-cave", kind: "banner", name: "Luz da Caverna", description: "Banner inicial da jornada.", assetKey: "banner-cave", unlock: { type: "default" }, rarity: "common", order: 1, active: true },
  ...Array.from({ length: 10 }, (_, index): CosmeticDefinition => ({ id: `medallion-chapter-${String(index + 1).padStart(2, "0")}`, kind: "medallion", name: `Medalhão do Capítulo ${index + 1}`, description: "Concedido ao concluir todos os níveis do capítulo.", assetKey: `medallion-chapter-${String(index + 1).padStart(2, "0")}`, unlock: { type: "chapter", value: index + 1 }, rarity: index >= 8 ? "legendary" : index >= 5 ? "epic" : "rare", order: index + 1, active: true })),
];

export const COSMETIC_DEFINITIONS: readonly CosmeticDefinition[] = [...AVATAR_DEFINITIONS, ...TITLE_DEFINITIONS, ...BASE_COSMETICS];

export function findCosmetic(id?: string | null) {
  return id ? COSMETIC_DEFINITIONS.find((item) => item.id === id) ?? null : null;
}
