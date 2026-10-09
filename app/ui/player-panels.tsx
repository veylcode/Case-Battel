"use client";
import { useLanguage } from "./language";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Coins, Lock, Gift, Clock, Trophy, Send, Check, User, TrendingUp, Box, FileSignature, Crosshair, Zap, } from "lucide-react";
import type { Bootstrap, Player, Skin } from "../domain/types";
import type { GameAction } from "./game";
import { farmProgress, farmRate, maxFarmLevel, maxFarmInvestment } from "../domain/farm";
import { api, coins, saleCoins, SkinCard, Empty, Modal, sound } from "./shared";
export function Inventory({ data, act, pending, notify, }: {
    data: Bootstrap;
    act: GameAction;
    pending: boolean;
    notify: (message: string) => void;
}) {
    const { t, language } = useLanguage();
    const [query, setQuery] = useState(""), [rarity, setRarity] = useState("all"), [sort, setSort] = useState("new"), [selected, setSelected] = useState<string[]>([]), [page, setPage] = useState(1), [confirm, setConfirm] = useState(false), [editing, setEditing] = useState(false);
    const lookup = useMemo(() => new Map(data.skins.map((s) => [s.id, s])), [data.skins]);
    const filtered = data.player.state.inventory
        .filter((item) => {
        const skin = lookup.get(item.skinId);
        return (skin &&
            (rarity === "all" || skin.rarity === rarity) &&
            skin.name.toLowerCase().includes(query.toLowerCase()));
    })
        .sort((a, b) => sort === "new"
        ? b.acquired - a.acquired
        : sort === "expensive"
            ? b.price - a.price
            : a.price - b.price);
    const total = data.player.state.inventory.reduce((sum, i) => sum + i.price, 0), saleItems = data.player.state.inventory.filter((i) => selected.includes(i.uid) && !i.locked), saleTotal = saleItems.reduce((sum, i) => sum + i.price, 0);
    useEffect(() => {
        setPage(1);
    }, [query, rarity, sort]);
    function toggle(uid: string) {
        setSelected((current) => current.includes(uid)
            ? current.filter((x) => x !== uid)
            : [...current, uid]);
    }
    async function sell() {
        try {
            const result = await act("sell", { ids: saleItems.map((x) => x.uid) });
            setSelected([]);
            setConfirm(false);
            sound("coins", localStorage.getItem("cb_audio") !== "off");
            notify(t(`Продано за ${coins(result.result.total)} монет`));
        }
        catch { }
    }
    const best = lookup.get(data.player.state.bestDrop ?? "");
    async function uploadAvatar(file: File | undefined) {
        if (!file)
            return;
        if (file.size > 10 * 1024 * 1024) {
            notify(t("Выберите изображение до 10 МБ"));
            return;
        }
        try {
            const image = await createImageBitmap(file);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 192;
            const context = canvas.getContext("2d");
            if (!context)
                throw new Error(t("Не удалось обработать изображение"));
            const side = Math.min(image.width, image.height);
            context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 192, 192);
            image.close();
            await act("profile/avatar", { image: canvas.toDataURL("image/webp", .86) });
            notify(t("Аватарка сохранена"));
        }
        catch (error) {
            notify(error instanceof Error ? error.message : t("Не удалось загрузить аватарку"));
        }
    }
    return (<section className="inventory-page">
      <h1>{t("ПРОФИЛЬ")}</h1>
      <div className="profile-cards">
        <div className="profile-stats">
          <h3><img src="/reference/ui/statistic-227.png" alt=""/><span>{t("СТАТИСТИКА")}<small>{t("Аккаунта")}</small></span></h3>
          <div><span><img src="/reference/ui/box-gradient-143.png" alt=""/>{data.player.state.opened}</span>
          <span><img src="/reference/ui/updrageColor-101.png" alt=""/>{data.player.state.upgrades}</span></div>
          <p>{t("ПРОДАНО")}<small><img src="/reference/ui/coins-64.png" alt=""/>{coins(data.player.state.earned)} ©</small></p>
        </div>
        <div className="profile-summary">
          <button className="text-button" onClick={() => setEditing(true)}>{data.player.name}</button>
          <label className="avatar large avatar-upload" title={t("Поставить аватарку")} style={data.player.avatar ? { backgroundImage: `url(${data.player.avatar})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={t("Загрузить аватарку")} disabled={pending} onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ""; }}/>
          </label>
          <small className="profile-bonus"><img src="/reference/ui/coin-2-188.png" alt=""/> × 0</small>
          <div className="profile-wallet"><img src="/reference/ui/wallet-153.png" alt=""/><strong>{coins(data.player.state.balance)} ©</strong>
          <button className="outlined" onClick={() => { location.hash = "farm"; }}>{t("ЗАРАБОТАТЬ")}</button></div>
        </div>
        <div className="best-drop"><h3>{t("ЛУЧШИЙ ДРОП")}</h3>
          {best ? <><img src={best.image} alt={best.name}/><strong>{best.weapon}<small>{best.skin}</small><b>{coins(best.price)} ©</b></strong></> : null}
        </div>
      </div>
      <div className="panel-title">
        <h2>{t("ВАШИ ПРЕДМЕТЫ")}{" "}
          <small>
            {data.player.state.inventory.length} · {coins(total)} ©
          </small>
        </h2>
        <button className="outlined" disabled={!data.player.state.inventory.some((i) => !i.locked) || pending} onClick={() => {
            setSelected(data.player.state.inventory
                .filter((i) => !i.locked)
                .map((i) => i.uid));
            setConfirm(true);
        }}>
          <Coins size={15}/>{t("ПРОДАТЬ ВСЁ")}</button>
      </div>
      <div className="filter-row">
        <div className="search-field">
          <Search size={16}/>
          <input value={query} aria-label={t("Поиск в инвентаре")} placeholder={t("Поиск предмета")} onChange={(e) => setQuery(e.target.value)}/>
        </div>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label={t("Редкость")}>
          <option value="all">{t("Все редкости")}</option>
          <option value="blue">{t("Армейское")}</option>
          <option value="purple">{t("Запрещённое")}</option>
          <option value="pink">{t("Засекреченное")}</option>
          <option value="red">{t("Тайное")}</option>
          <option value="gold">{t("Ножи и перчатки")}</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("Порядок предметов")}>
          <option value="new">{t("Сначала новые")}</option>
          <option value="expensive">{t("Сначала дорогие")}</option>
          <option value="cheap">{t("Сначала дешёвые")}</option>
        </select>
        <button className="secondary" onClick={() => setSelected(filtered.filter((i) => !i.locked).map((i) => i.uid))}>{t("Выбрать всё")}</button>
        <button className="text-button" onClick={() => setSelected([])}>{t("Снять выбор")}</button>
      </div>
      {saleItems.length > 0 && (<div className="selection-bar">
          <span>{t("Выбрано")}{saleItems.length} · {coins(saleTotal)} ©
          </span>
          <button className="primary" onClick={() => setConfirm(true)} disabled={pending}>{t("ПРОДАТЬ ВЫБРАННЫЕ")}</button>
        </div>)}
      {filtered.length ? (<>
          <div className="skin-grid inventory-grid">
            {filtered.slice(0, page * 60).map((item) => (<SkinCard key={item.uid} skin={lookup.get(item.skinId)!} item={item} selected={selected.includes(item.uid)} onClick={() => !item.locked && toggle(item.uid)} actions={<>
                  <button disabled={pending || item.locked} aria-label={t("В контракт")} title={t("В контракт")} onClick={() => { location.hash = `contract?item=${encodeURIComponent(item.uid)}`; }}><img src="/reference/ui/contract-145.png" alt=""/></button>
                  <button disabled={pending || item.locked} aria-label={t("В апгрейд")} title={t("В апгрейд")} onClick={() => { location.hash = `upgrade?item=${encodeURIComponent(item.uid)}`; }}><img src="/reference/ui/upgradeWhite-260.png" alt=""/></button>
                  <button disabled={pending || item.locked} aria-label={t(`Продать за ${saleCoins(item.price)}`)} title={t("Продать")} onClick={() => { setSelected([item.uid]); setConfirm(true); }}><img src="/reference/ui/coins-64.png" alt=""/></button>
                  <button disabled={pending || item.locked} aria-label={t("Продать быстро")} title={t("Продать быстро")} onClick={async () => { try {
                    await act("sell", { ids: [item.uid] });
                    sound("coins", localStorage.getItem("cb_audio") !== "off");
                }
                catch { } }}><Zap size={10}/></button>
                </>}/>))}
          </div>
          {filtered.length > page * 60 && (<button className="secondary load-more" onClick={() => setPage((p) => p + 1)}>{t("Показать ещё 60")}</button>)}
        </>) : (<Empty title={t("Инвентарь пока пуст")} description={t("Откройте кейс. Выпавшие предметы появятся здесь.")}/>)}
      <div className="achievements">
        <h2>{t("ДОСТИЖЕНИЯ")}</h2>
        <div>
          {[
            {
                id: "open10",
                label: t("Первые шаги"),
                description: t("Открыть 10 кейсов"),
            },
            {
                id: "open100",
                label: t("Коллекционер"),
                description: t("Открыть 100 кейсов"),
            },
            {
                id: "upgrade5",
                label: t("Выше и выше"),
                description: t("Сделать 5 апгрейдов"),
            },
            {
                id: "contract5",
                label: t("Алхимик"),
                description: t("Создать 5 контрактов"),
            },
            {
                id: "profit10k",
                label: t("Предприниматель"),
                description: t("Продать на 10 000 монет"),
            },
        ].map((a) => (<article key={a.id} className={data.player.state.achievements.includes(a.id) ? "unlocked" : ""}>
              <Trophy size={23}/>
              <strong>{a.label}</strong>
              <small>{a.description}</small>
              {data.player.state.achievements.includes(a.id) && (<Check size={14}/>)}
            </article>))}
        </div>
      </div>
      {confirm && (<Modal title={t("Продать предметы")} onClose={() => setConfirm(false)}>
          <p>{t("Продать")}{saleItems.length}{t("предметов за")}{" "}
            <strong className="orange">{coins(saleTotal)} ©</strong>?
          </p>
          <p className="muted">{t("Заблокированные предметы сохранятся в инвентаре.")}</p>
          <button className="primary wide" onClick={sell} disabled={pending || !saleItems.length}>{t("ПРОДАТЬ")}</button>
        </Modal>)}
      {editing && (<Modal title={t("Никнейм")} onClose={() => setEditing(false)}>
          <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                    await act("profile", {
                        name: new FormData(e.currentTarget).get("name"),
                    });
                    setEditing(false);
                }
                catch { }
            }}>
            <label className="form-field">{t("Ваше имя")}<input name="name" defaultValue={data.player.name} minLength={2} maxLength={32} required/>
            </label>
            <button className="primary wide" disabled={pending}>{t("СОХРАНИТЬ")}</button>
          </form>
        </Modal>)}
    </section>);
}
export function Rewards({ data, act, notify, pending, onBalancePreview }: {
    data: Bootstrap;
    act: GameAction;
    notify: (message: string) => void;
    pending: boolean;
    onBalancePreview: (balance: number | null) => void;
}) {
    const { t, language } = useLanguage();
    const [holding, setHolding] = useState(false);
    const [selected, setSelected] = useState<string[]>([]), [confirmUpgrade, setConfirmUpgrade] = useState(false), [itemLimit, setItemLimit] = useState(60);
    const investment = data.player.state.farmInvestment ?? 0;
    const progress = farmProgress(investment), rate = farmRate(data.settings.farmReward, investment);
    const lookup = useMemo(() => new Map(data.skins.map(skin => [skin.id, skin])), [data.skins]);
    const upgradeItems = data.player.state.inventory.filter(item => !item.locked && item.price > 0).sort((a, b) => a.price - b.price);
    const selectedItems = upgradeItems.filter(item => selected.includes(item.uid));
    const selectedValue = selectedItems.reduce((sum, item) => sum + item.price, 0);
    const preview = farmProgress(Math.min(maxFarmInvestment, investment + selectedValue));
    const [particles, setParticles] = useState<{
        id: number;
        amount: number;
        x: number;
    }[]>([]);
    const held = useRef(false);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const action = useRef(act);
    action.current = act;
    const clock = useRef<{
        balance: number;
        at: number;
    } | null>(null);
    function settle(stop = false) {
        queue.current = queue.current.then(async () => {
            const response = await action.current("farm/tick", { stop });
            clock.current = stop ? null : { balance: response.player.state.balance, at: Date.now() };
            if (stop)
                onBalancePreview(null);
        }).catch(() => {
            held.current = false;
            setHolding(false);
            clock.current = null;
            onBalancePreview(null);
        });
    }
    function start() {
        if (held.current)
            return;
        held.current = true;
        setHolding(true);
        queue.current = queue.current.then(async () => {
            const response = await action.current("farm/start", {});
            clock.current = { balance: response.player.state.balance, at: Date.now() };
        }).catch(() => {
            held.current = false;
            setHolding(false);
            onBalancePreview(null);
        });
    }
    function stop() {
        if (!held.current)
            return;
        held.current = false;
        setHolding(false);
        settle(true);
    }
    useEffect(() => {
        if (!holding)
            return;
        const credit = setInterval(() => settle(), 750);
        const animation = setInterval(() => {
            const now = Date.now();
            if (clock.current)
                onBalancePreview(clock.current.balance + Math.min(1500, now - clock.current.at) * rate / 1000);
            setParticles(current => [...current.filter(p => p.id > now - 1100), {
                    id: now, amount: rate / 20, x: Math.random() * 50 - 25,
                }]);
        }, 50);
        return () => { clearInterval(credit); clearInterval(animation); };
    }, [holding, rate]);
    useEffect(() => {
        const release = () => { if (document.hidden)
            stop(); };
        document.addEventListener("visibilitychange", release);
        return () => {
            document.removeEventListener("visibilitychange", release);
            onBalancePreview(null);
            if (held.current)
                void action.current("farm/tick", { stop: true }).catch(() => { });
        };
    }, []);
    return <section className="farm-page">
    <h1>{t("ФАРМИЛКА ДЕНЕГ")}</h1>
    <div className="farm-status"><span>{t("Уровень")} {progress.level}/{maxFarmLevel}</span><strong>{coins(rate)} ©/{t("сек")}</strong><span>+{Math.round((progress.multiplier - 1) * 100)}%</span></div>
    <button className={`farm-hold ${holding ? "holding" : ""}`} aria-label={t("Удерживай, чтобы зарабатывать")} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); start(); }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={event => { if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        start();
    } }} onKeyUp={stop} onBlur={stop}>
      <span>{t("Удерживай, чтобы зарабатывать")}</span>
      {particles.map(p => <i key={p.id} style={{ left: `calc(50% + ${p.x}px)` }}>+{coins(p.amount)} ©</i>)}
    </button>
    <button className="outlined farm-bonus" disabled={pending || Date.now() - data.player.state.bonusAt < 86400000} onClick={async () => { try {
        const response = await act("bonus", {});
        notify(t(`+${coins(response.result.amount)} монет`));
    }
    catch { } }}>
      <img src="/reference/ui/coins-64.png" alt=""/>
      <span>+{coins(data.settings.dailyBonus)} ©<small>{t("Получить бонус")}</small></span>
    </button>
    <div className="farm-upgrade-panel collection-panel">
      <h2>{t("Прокачка фармилки скинами")}</h2>
      <p>{t("Каждый уровень даёт +5% к заработку. Максимум — +50%. Стоимость следующего уровня удваивается.")}</p>
      {progress.level < maxFarmLevel ? <>
        <div className="farm-progress"><span>{t("До следующего уровня")}: {coins(progress.nextCost - progress.progress)} ©</span><small>{coins(progress.progress)} / {coins(progress.nextCost)} ©</small></div>
        <progress aria-label={t("Прогресс фармилки")} value={progress.progress} max={progress.nextCost}/>
        <p className="muted">{t("Переданные скины расходуются навсегда. Их стоимость накапливается для прокачки; излишек сверх максимума вернётся на баланс. Дневной бонус не увеличивается.")}</p>
        {upgradeItems.length ? <div className="skin-grid small-grid">{upgradeItems.slice(0, itemLimit).map(item => <SkinCard key={item.uid} skin={lookup.get(item.skinId)!} item={item} selected={selected.includes(item.uid)} onClick={() => { if (!holding && !pending) setSelected(current => current.includes(item.uid) ? current.filter(id => id !== item.uid) : current.length < 100 ? [...current, item.uid] : current); }}/>)}</div> : <Empty title={t("Нет предметов")} description={t("Откройте кейс, чтобы начать прокачку.")}/>}
        {upgradeItems.length > itemLimit && <button className="secondary load-more" onClick={() => setItemLimit(current => current + 60)}>{t("Ещё предметы")}</button>}
        <div className="farm-upgrade-actions"><span>{t("Выбрано")}: {selectedItems.length} · {coins(selectedValue)} ©</span><button className="primary" disabled={holding || pending || !selectedItems.length} onClick={() => setConfirmUpgrade(true)}>{t("ПРОКАЧАТЬ ФАРМИЛКУ")}</button></div>
      </> : <p className="positive">{t("Максимальный уровень достигнут")}</p>}
    </div>
    {confirmUpgrade && <Modal title={t("Прокачка фармилки скинами")} onClose={() => { if (!pending) setConfirmUpgrade(false); }}>
      <p>{t("Предметы будут израсходованы")}: {selectedItems.length} · {coins(selectedValue)} ©.</p>
      <p>{t("Уровень")}: {progress.level} → {preview.level}. {t("Бонус")}: +{Math.round((preview.multiplier - 1) * 100)}%.</p>
      <p>{t("Вклад сохраняется, даже если до следующего уровня пока не хватает.")}</p>
      <button className="primary wide" disabled={pending || !selectedItems.length} onClick={async () => {
        try {
          const response = await act("farm/upgrade", { ids: selectedItems.map(item => item.uid) });
          setSelected([]); setConfirmUpgrade(false);
          notify(`${t("Фармилка прокачана")}: ${t("Уровень")} ${response.result.level}`);
        } catch { }
      }}>{t("Подтвердить прокачку")}</button>
    </Modal>}
  </section>;
}
export function HistoryPanel({ player, skins, }: {
    player: Player;
    skins: Skin[];
}) {
    const { t, language } = useLanguage();
    const [filter, setFilter] = useState("all"), [page, setPage] = useState(1);
    const entries = player.state.history.filter((h) => filter === "all" || h.type === filter);
    return (<section>
      <h1>{t("ИСТОРИЯ АККАУНТА")}</h1>
      <div className="filter-row">
        <select aria-label={t("Тип операции")} value={filter} onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
        }}>
          <option value="all">{t("Все операции")}</option>
          <option value="case">{t("Открытия кейсов")}</option>
          <option value="sell">{t("Продажи")}</option>
          <option value="upgrade">{t("Апгрейды")}</option>
          <option value="contract">{t("Контракты")}</option>
          <option value="battle">{t("Баттлы")}</option>
          <option value="admin">{t("Изменения администратора")}</option>
        </select>
        <span className="muted">{t("Последние 200 операций")}</span>
      </div>
      {entries.length ? (<div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Время")}</th>
                <th>{t("Операция")}</th>
                <th>{t("Предметы")}</th>
                <th>{t("Баланс")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, page * 30).map((h) => (<tr key={h.id}>
                  <td>{new Date(h.time).toLocaleString("ru-RU")}</td>
                  <td>{t(h.label)}</td>
                  <td>
                    {h.items
                    ?.slice(0, 3)
                    .map((id) => skins.find((s) => s.id === id)?.name ?? t("Предмет"))
                    .join(", ")}
                    {(h.items?.length ?? 0) > 3
                    ? ` +${h.items!.length - 3}`
                    : ""}
                  </td>
                  <td className={h.change >= 0 ? "positive" : "negative"}>
                    {h.change > 0 ? "+" : ""}
                    {coins(h.change)} ©
                  </td>
                </tr>))}
            </tbody>
          </table>
          {entries.length > page * 30 && (<button className="secondary load-more" onClick={() => setPage((p) => p + 1)}>{t("Показать ещё")}</button>)}
        </div>) : (<Empty title={t("Операций пока нет")} description={t("Здесь сохраняются кейсы, продажи, апгрейды и изменения баланса.")}/>)}
    </section>);
}
export function Leaderboard({ skins }: {
    skins: Skin[];
}) {
    const { t, language } = useLanguage();
    const [rows, setRows] = useState<any[] | null>(null), [error, setError] = useState("");
    useEffect(() => {
        api<any[]>("leaderboard")
            .then(setRows)
            .catch((e) => setError(e.message));
    }, []);
    return (<section>
      <h1>{t("ТОП ИГРОКОВ")}</h1>
      <p className="page-description">{t("Рейтинг по сумме проданных предметов. Только реальные аккаунты этого сайта.")}</p>
      {error && <div className="warning">{error}</div>}
      {rows ? (<div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Место")}</th>
                <th>{t("Игрок")}</th>
                <th>{t("Открыто кейсов")}</th>
                <th>{t("Лучший дроп")}</th>
                <th>{t("Продано на")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (<tr key={row.id}>
                  <td className={index < 3 ? "orange" : ""}>
                    {index < 3 ? "♛ " : ""}
                    {index + 1}
                  </td>
                  <td>{row.name}</td>
                  <td>{coins(row.opened)}</td>
                  <td>
                    {skins.find((s) => s.id === row.bestDrop)?.name ?? "—"}
                  </td>
                  <td className="orange">{coins(row.earned)} ©</td>
                </tr>))}
            </tbody>
          </table>
        </div>) : (<div className="loader"/>)}
    </section>);
}
export function Support({ act, notify, }: {
    act: GameAction;
    notify: (message: string) => void;
}) {
    const { t, language } = useLanguage();
    const [tickets, setTickets] = useState<any[]>([]), [busy, setBusy] = useState(false);
    const load = () => api<any[]>("tickets")
        .then(setTickets)
        .catch((e) => notify(e.message));
    useEffect(() => {
        void load();
    }, []);
    return (<section>
      <h1>{t("ПОДДЕРЖКА")}</h1>
      <div className="support-layout">
        <form className="panel support-form" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            try {
                await act("tickets", Object.fromEntries(new FormData(form)));
                form.reset();
                notify(t("Обращение отправлено"));
                await load();
            }
            catch {
            }
            finally {
                setBusy(false);
            }
        }}>
          <h2>{t("Создать обращение")}</h2>
          <label className="form-field">{t("Тема")}<input name="subject" minLength={3} maxLength={100} required/>
          </label>
          <label className="form-field">{t("Сообщение")}<textarea name="message" minLength={10} maxLength={2000} rows={6} required/>
          </label>
          <button className="primary" disabled={busy}>
            <Send size={16}/>{t("ОТПРАВИТЬ")}</button>
        </form>
        <div>
          <h2>{t("МОИ ОБРАЩЕНИЯ")}</h2>
          {tickets.length ? (tickets.map((t) => (<article className="ticket panel" key={t.id}>
                <div>
                  <strong>{t.subject}</strong>
                  <span className={`badge ${t.status === "closed" ? "green" : ""}`}>
                    {t.status === "closed" ? t("Закрыто") : t("Открыто")}
                  </span>
                </div>
                <small>{new Date(t.created).toLocaleString("ru-RU")}</small>
                <p>{t.message}</p>
                {t.reply && (<blockquote>
                    <strong>{t("Ответ администратора")}</strong>
                    <p>{t.reply}</p>
                  </blockquote>)}
              </article>))) : (<Empty title={t("Обращений пока нет")} description={t("Ответ администратора появится здесь.")}/>)}
        </div>
      </div>
    </section>);
}
