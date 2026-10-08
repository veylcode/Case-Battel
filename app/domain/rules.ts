import type { Bootstrap, CaseContent, Case, PlayerOdds, Rarity } from "./types";
export const rarityColors = {
  blue: "#5685e7",
  purple: "#9b54e8",
  pink: "#d443b8",
  red: "#e75159",
  gold: "#e8b331",
};
export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export const defaultPlayerOdds: PlayerOdds = {
  caseLuck: 1, upgradeBonus: 0,
  rarityWeights: { blue: 1, purple: 1, pink: 1, red: 1, gold: 1 },
};
export function personalWeight(weight: number, price: number, rarity: Rarity, casePrice: number, odds?: PlayerOdds) {
  if (!odds) return weight;
  return weight * odds.rarityWeights[rarity] * Math.pow(Math.max(price, .01) / Math.max(casePrice, 10), Math.log2(odds.caseLuck));
}
export function chanceForUpgrade(value: number, target: number, fee: number, bonus = 0) {
  const base = Math.min(75, Math.max(1, (value / target) * (100 - fee)));
  return Math.min(100, Math.max(0, base + bonus));
}
const lookupCache = new WeakMap<
  Bootstrap,
  Map<string, Bootstrap["skins"][number]>
>();
export function clientContents(box: Case, data: Bootstrap): CaseContent[] {
  let lookup = lookupCache.get(data);
  if (!lookup) {
    lookup = new Map(data.skins.map((s) => [s.id, s]));
    lookupCache.set(data, lookup);
  }
  const entries = (data.caseContents[box.id] ?? []).flatMap((entry) => {
    const skin = lookup!.get(entry.skinId);
    return skin
      ? [
          {
            skin: { ...skin, price: entry.price },
            weight: personalWeight(entry.weight, entry.price, skin.rarity, box.price, data.player?.state.odds),
            chance: entry.chance,
          },
        ]
      : [];
  });
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.map(entry => ({ ...entry, chance: 100 * entry.weight / total }));
}
