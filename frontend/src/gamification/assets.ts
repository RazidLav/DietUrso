import { LEVEL_DEFINITIONS } from "./journey";

export type JourneyAssetStatus = "ready" | "approved_fallback" | "awaiting_official_art";

export interface JourneyAssetEntry {
  key: string;
  ownerType: "brand" | "journey" | "level" | "avatar";
  ownerId: string;
  status: JourneyAssetStatus;
  source: string;
  description: string;
}

// Inventário estável. Os 100 slots nunca reutilizam uma chave, mesmo enquanto
// uma ilustração oficial ainda usa o fallback aprovado do mascote canônico.
export const JOURNEY_ASSET_MANIFEST: readonly JourneyAssetEntry[] = [
  { key: "brand-ursofit-mark", ownerType: "brand", ownerId: "ursofit", status: "ready", source: "assets/images/ursofit-logo.png", description: "Logo oficial usado na interface, splash e ícones do aplicativo." },
  { key: "journey-horizontal-mascot", ownerType: "journey", ownerId: "journey-home", status: "ready", source: "assets/images/home-progress-v2.png", description: "Mascote horizontal compacto da jornada, com espaço negativo para texto." },
  ...LEVEL_DEFINITIONS.map((level): JourneyAssetEntry => ({
    key: level.assetKey,
    ownerType: "level",
    ownerId: level.id,
    status: "awaiting_official_art",
    source: "assets/images/home-progress-v2.png",
    description: level.assetDescription,
  })),
];

export function journeyAssetForLevel(level: number) {
  return JOURNEY_ASSET_MANIFEST.find((item) => item.ownerId === `level-${String(level).padStart(3, "0")}`) ?? null;
}
