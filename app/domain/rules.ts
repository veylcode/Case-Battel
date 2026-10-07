import type { Bootstrap, CaseContent, Case } from "./types";
export const rarityColors = {
  blue: "#5685e7",
  purple: "#9b54e8",
  pink: "#d443b8",
  red: "#e75159",
  gold: "#e8b331",
};
export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export function chanceForUpgrade(value: number, target: number, fee: number) {
  return Math.min(75, Math.max(1, (value / target) * (100 - fee)));
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
  return (data.caseContents[box.id] ?? []).flatMap((entry) => {
    const skin = lookup!.get(entry.skinId);
    return skin
      ? [
          {
            skin: { ...skin, price: entry.price },
            weight: entry.weight,
            chance: entry.chance,
          },
        ]
      : [];
  });
}
