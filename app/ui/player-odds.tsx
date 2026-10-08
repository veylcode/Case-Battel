"use client";
import { useEffect, useState } from "react";
import type { Player, PlayerOdds } from "../domain/types";
import { defaultPlayerOdds, rarityColors } from "../domain/rules";
import { useLanguage } from "./language";

export function PlayerOddsForm({ player, busy, save }: {
  player: Player;
  busy: boolean;
  save: (body: unknown) => Promise<unknown>;
}) {
  const { t } = useLanguage();
  const [odds, setOdds] = useState<PlayerOdds>(() => structuredClone(player.state.odds ?? defaultPlayerOdds));
  useEffect(() => setOdds(structuredClone(player.state.odds ?? defaultPlayerOdds)), [player.id, player.state.odds]);
  const apply = (next: PlayerOdds) => save({ id: player.id, action: "odds", odds: next });
  return <form onSubmit={event => { event.preventDefault(); void apply(odds).catch(() => {}); }}>
    <h3>{t("Персональные шансы")}</h3>
    <label className="form-field">{t("Удача во всех кейсах")}
      <input aria-label={t("Удача во всех кейсах")} type="number" min={.1} max={10} step={.01} required value={odds.caseLuck} onChange={event => setOdds({ ...odds, caseLuck: Number(event.target.value) })}/>
    </label>
    <p className="muted">{t("1 — обычные шансы. Больше 1 повышает вероятность дорогих предметов, меньше 1 — дешёвых.")}</p>
    <div className="personal-rarity-weights">
      {(["blue", "purple", "pink", "red", "gold"] as const).map((rarity, i) => <label className="form-field" key={rarity} style={{ color: rarityColors[rarity] }}>
        {t(["Синие", "Фиолетовые", "Розовые", "Красные", "Золотые"][i])}
        <input aria-label={t(["Вес синих", "Вес фиолетовых", "Вес розовых", "Вес красных", "Вес золотых"][i])} type="number" min={.01} max={100} step={.01} required value={odds.rarityWeights[rarity]} onChange={event => setOdds({ ...odds, rarityWeights: { ...odds.rarityWeights, [rarity]: Number(event.target.value) } })}/>
      </label>)}
    </div>
    <label className="form-field">{t("Поправка шанса апгрейда, п.п.")}
      <input aria-label={t("Поправка шанса апгрейда, п.п.")} type="number" min={-100} max={100} step={.01} required value={odds.upgradeBonus} onChange={event => setOdds({ ...odds, upgradeBonus: Number(event.target.value) })}/>
    </label>
    <p className="muted">{t("Добавляется к обычному проценту. Итог ограничен 0–100% и показан в апгрейдере. Настройки применяются только к этому игроку.")}</p>
    <div className="personal-odds-actions">
      <button className="primary" disabled={busy}>{t("Сохранить шансы")}</button>
      <button className="secondary" type="button" disabled={busy} onClick={() => { const next = structuredClone(defaultPlayerOdds); setOdds(next); void apply(next).catch(() => {}); }}>{t("Сбросить шансы")}</button>
    </div>
  </form>;
}
