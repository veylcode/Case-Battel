// Keep a meaningful chance of profit while limiting the long-run average payout.
export function balancedCaseWeights(entries: { price: number; copies: number }[], casePrice: number) {
  if (casePrice <= 0) return entries.map(entry => entry.copies);
  const ratios = entries.map(entry => Math.max(.000001, entry.price / casePrice));
  const winning = ratios.map(ratio => ratio >= 1);
  const losses = ratios.filter((_, i) => !winning[i]), wins = ratios.filter((_, i) => winning[i]);
  if (!losses.length || !wins.length) return entries.map(entry => entry.copies);
  const minLoss = Math.min(...losses), minWin = Math.min(...wins);
  const target = Math.max(.9, minLoss + .75 * (1 - minLoss));
  const profitChance = Math.max(.001, Math.min(.35, .9 * (target - minLoss) / (minWin - minLoss)));
  function distribution(bias: number) {
    const logs = ratios.map((ratio, i) => Math.log(entries[i].copies) + bias * Math.log(ratio));
    const lossPeak = Math.max(...logs.filter((_, i) => !winning[i]));
    const winPeak = Math.max(...logs.filter((_, i) => winning[i]));
    const weights = logs.map((value, i) => Math.exp(Math.max(-700, value - (winning[i] ? winPeak : lossPeak))));
    let lossTotal = 0, winTotal = 0;
    weights.forEach((weight, i) => { if (winning[i]) winTotal += weight; else lossTotal += weight; });
    return weights.map((weight, i) => weight * (winning[i] ? profitChance / winTotal : (1 - profitChance) / lossTotal));
  }
  let low = -1024, high = 32;
  for (let i = 0; i < 40; i++) {
    const bias = (low + high) / 2;
    const average = distribution(bias).reduce((sum, weight, index) => sum + weight * ratios[index], 0);
    if (average < target) low = bias; else high = bias;
  }
  return distribution((low + high) / 2);
}
