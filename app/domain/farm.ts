import { money } from "./rules";

export const maxFarmLevel = 10;
export const farmLevelCost = (level: number) => 1000 * 2 ** level;
export const maxFarmInvestment = farmLevelCost(maxFarmLevel) - 1000;
export function farmProgress(investment = 0) {
  let progress = Math.max(0, Math.min(investment, maxFarmInvestment)), level = 0;
  while (level < maxFarmLevel && progress >= farmLevelCost(level)) {
    progress = money(progress - farmLevelCost(level));
    level++;
  }
  return { level, progress, nextCost: level < maxFarmLevel ? farmLevelCost(level) : 0, multiplier: 1 + level * .05 };
}
export const farmRate = (reward: number, investment = 0) => reward * .8 * farmProgress(investment).multiplier;
