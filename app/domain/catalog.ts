import skinData from "./skin-catalog.json";
import caseData from "./case-catalog.json";
import dropData from "./case-content.json";
import type { Skin, Case, Settings, CaseContent, PlayerOdds } from "./types";
import { personalWeight } from "./rules";
import { balancedCaseWeights } from "./case-odds";
export { rarityColors, chanceForUpgrade } from "./rules";

export const skins = (skinData as Skin[]).filter((s) => !s.supplemental);
export const cases = caseData as Case[];
const skinLookup = new Map(skins.map((s) => [s.id, s]));
const originalDrops = dropData as Record<
  string,
  { skinId: string; price: number }[]
>;
export const defaults: Settings = {
  startingBalance: 5000,
  dailyBonus: 500,
  farmReward: 50,
  farmCooldown: 60,
  upgradeFee: 0,
  contractMin: 1 / 3,
  contractMax: 4.5,
  maintenance: false,
  announcement: "",
  caseOverrides: {},
  odds: {},
  skinPrices: {},
  promos: [{ code: "WELCOME", amount: 1000, enabled: true }],
};
const configuredCache = new WeakMap<Settings, Skin[]>();
export function configuredSkins(settings: Settings): Skin[] {
  const cached = configuredCache.get(settings);
  if (cached) return cached;
  const result = skins.map(
    ({
      id,
      name,
      weapon,
      skin,
      price,
      rarity,
      image,
      rarityColor,
      nameRu,
    }) => ({
      id,
      name,
      weapon,
      skin,
      price: settings.skinPrices[id] ?? price,
      rarity,
      image,
      rarityColor,
      nameRu,
    }),
  );
  configuredCache.set(settings, result);
  return result;
}
export function configuredCases(settings: Settings): Case[] {
  return [
    ...cases.map(
      ({ id, slug, name, price, category, image, imageBack, color }) => ({
        ...{ id, slug, name, price, category, image, imageBack, color },
        ...settings.caseOverrides[id],
      }),
    ),
    ...(Object.values(settings.caseOverrides).filter(
      (c) => c.id && !cases.some((x) => x.id === c.id),
    ) as Case[]),
  ];
}
export function contents(box: Case, settings: Settings, odds?: PlayerOdds): CaseContent[] {
  const entries = originalDrops[box.id] ?? originalDrops[cases[0].id] ?? [];
  const combined = new Map<string, { skin: Skin; copies: number }>();
  for (const entry of entries) {
    const source = skinLookup.get(entry.skinId);
    if (!source) continue;
    const skin = {
      ...source,
      price: settings.skinPrices[source.id] ?? entry.price,
    };
    const existing = combined.get(skin.id);
    if (existing) existing.copies++;
    else combined.set(skin.id, { skin, copies: 1 });
  }
  const unique = Array.from(combined.values());
  const baseWeights = balancedCaseWeights(unique.map(entry => ({ price: entry.skin.price, copies: entry.copies })), box.price);
  const weighted = unique.map((entry, index) => ({ skin: entry.skin,
    weight: personalWeight(settings.odds[box.id]?.[entry.skin.id] ?? baseWeights[index], entry.skin.price, entry.skin.rarity, box.price, odds),
  }));
  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  return weighted.map((x) => ({ ...x, chance: (100 * x.weight) / total }));
}
export function publicContents(settings: Settings) {
  return Object.fromEntries(
    configuredCases(settings).map((box) => [
      box.id,
      contents(box, settings).map(({ skin, weight, chance }) => ({
        skinId: skin.id,
        price: skin.price,
        weight,
        chance,
      })),
    ]),
  );
}
