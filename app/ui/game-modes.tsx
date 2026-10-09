"use client";
import { useLanguage, localizeSkin } from "./language";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Crosshair, ArrowUp, FileSignature, Coins, Swords, Plus, X, Check, RotateCcw, } from "lucide-react";
import type { Bootstrap, Item, Skin } from "../domain/types";
import { chanceForUpgrade, rarityColors } from "../domain/rules";
import type { GameAction } from "./game";
import { SkinCard, Empty, coins, CaseArt, sound } from "./shared";
import { NeonRing, Roulette } from "./roulette";
interface ModeProps {
    data: Bootstrap;
    act: GameAction;
    audio: boolean;
    fast: boolean;
    onAnimating: (busy: boolean) => void;
}
function useInventory(data: Bootstrap) {
    const lookup = useMemo(() => new Map(data.skins.map((s) => [s.id, s])), [data.skins]);
    return {
        lookup,
        items: data.player.state.inventory.filter((i) => !i.locked),
    };
}
function initialSelection(items: Item[]) {
    if (typeof window === "undefined")
        return [];
    const uid = new URLSearchParams(location.hash.split("?")[1]).get("item");
    return items.filter((item) => item.uid === uid).map((item) => item.uid);
}
export function Upgrade({ data, act, audio, fast, onAnimating }: ModeProps) {
    const { t, language } = useLanguage();
    const { lookup, items } = useInventory(data);
    const [selected, setSelected] = useState<string[]>(() => initialSelection(items)), [target, setTarget] = useState<Skin | null>(null), [extra, setExtra] = useState(0), [query, setQuery] = useState(""), [rarity, setRarity] = useState("all"), [minPrice, setMinPrice] = useState(0), [maxPrice, setMaxPrice] = useState(0), [searchOpen, setSearchOpen] = useState(false), [page, setPage] = useState(1), [inventoryPage, setInventoryPage] = useState(1);
    const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState<any>(null), [finished, setFinished] = useState(false), [snapshot, setSnapshot] = useState<Item[]>([]), [inventorySnapshot, setInventorySnapshot] = useState<Item[]>([]);
    const visibleItems = [...(busy ? inventorySnapshot : items)].sort((a, b) => a.price - b.price || a.acquired - b.acquired);
    const pointer = useRef<HTMLDivElement>(null);
    const used = busy || finished ? snapshot : items.filter((i) => selected.includes(i.uid));
    const value = used.reduce((sum, i) => sum + i.price, 0) + extra, chance = outcome?.chance ??
        (target
            ? chanceForUpgrade(value, target.price, data.settings.upgradeFee, data.player.state.odds?.upgradeBonus)
            : 0);
    const [displayedChance, setDisplayedChance] = useState(0);
    const chanceRef = useRef(0);
    useEffect(() => {
        const from = chanceRef.current;
        const started = performance.now();
        let frame = 0;
        const update = (now: number) => {
            const progress = Math.min(1, (now - started) / 280);
            const eased = 1 - (1 - progress) ** 3;
            chanceRef.current = from + (chance - from) * eased;
            setDisplayedChance(chanceRef.current);
            if (progress < 1)
                frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [chance]);
    const targets = data.skins
        .filter((s) => (query !== "" || minPrice > 0 || maxPrice > 0 || rarity !== "all") && s.price > value &&
        s.price >= minPrice &&
        (maxPrice === 0 || s.price <= maxPrice) &&
        (rarity === "all" || s.rarity === rarity) &&
        s.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    function toggle(uid: string) {
        if (busy || !items.some(item => item.uid === uid))
            return;
        if (finished) {
            reset();
            setSelected([uid]);
            return;
        }
        setSelected((current) => current.includes(uid)
            ? current.filter((x) => x !== uid)
            : current.length < 6
                ? [...current, uid]
                : current);
    }
    function multiplier(number: number) {
        const candidate = data.skins
            .filter((s) => s.price >= Math.max(1, value * number))
            .sort((a, b) => a.price - b.price)[0];
        if (candidate)
            setTarget(candidate);
        setMinPrice(Math.ceil(value * number));
        setPage(1);
    }
    async function upgrade() {
        if (!target || !selected.length || busy)
            return;
        setBusy(true);
        setSnapshot([...used]);
        setInventorySnapshot([...items]);
        onAnimating(true);
        sound("start", audio);
        try {
            const response = await act("upgrade", {
                ids: selected,
                target: target.id,
                extra,
            });
            const result = response.result;
            setOutcome(result);
            const animation = pointer.current?.animate([
                { transform: "rotate(0deg)" },
                {
                    transform: `rotate(${1980 - result.chance * 1.8 + result.roll * 3.6}deg)`,
                },
            ], {
                duration: fast ? 350 : 4800,
                easing: "cubic-bezier(.12,.5,.08,1)",
                fill: "forwards",
            });
            if (animation)
                await animation.finished;
            setFinished(true);
            sound(result.won ? "success" : "loss", audio);
        }
        catch {
        }
        finally {
            setBusy(false);
            onAnimating(false);
        }
    }
    function reset() {
        setSelected([]);
        setTarget(null);
        setOutcome(null);
        setSnapshot([]);
        setFinished(false);
        setExtra(0);
        pointer.current?.getAnimations().forEach((a) => a.cancel());
    }
    return (<section className="upgrade-page">
      <h1>{t("МОДЕРНИЗАЦИЯ ОРУЖИЯ 2.0")}</h1>
      <div className="upgrade-arena">
        <div className="upgrade-source">
          <div className="arena-label">{t("Выберите до 6 предметов на апгрейд")}</div>
          {used.length ? (<>
              <div className="upgrade-selected-grid">
                {used.map((item) => (<SkinCard key={item.uid} skin={lookup.get(item.skinId)!} item={item} onClick={() => toggle(item.uid)}/>))}
              </div>
            </>) : (<div className="arena-placeholder">
            </div>)}
        </div>
        <div className="upgrade-dial">
          <div className="dial-ticks"/>
          <div className="dial-ring" style={{
            background: displayedChance
                ? `conic-gradient(from ${180 - displayedChance * 1.8}deg,#71ee12 0deg,#eced00 ${displayedChance * .9}deg,#ff9724 ${displayedChance * 1.35}deg,#f32d30 ${displayedChance * 1.8}deg,#ff9724 ${displayedChance * 2.25}deg,#eced00 ${displayedChance * 2.7}deg,#71ee12 ${displayedChance * 3.6}deg,transparent ${displayedChance * 3.6}deg)`
                : "transparent",
        }}/>
          <div className="dial-inner">
            <strong className={finished ? (outcome.won ? "positive" : "negative") : ""}>
              {finished
            ? outcome.won
                ? t("УСПЕХ!") : t("НЕУДАЧА")
            : target
                ? `${displayedChance.toFixed(2)}%`
                : ""}
            </strong>
            <small>
              {finished
            ? outcome.won
                ? t("Предмет в инвентаре") : t("Попробуйте ещё раз")
            : target ? t(displayedChance >= 70 ? "очень высокий шанс" : displayedChance >= 45 ? "высокий шанс" : displayedChance >= 25 ? "средний шанс" : "низкий шанс") : ""}
            </small>
          </div>
          <div className="dial-pointer" ref={pointer}>
            <span><img src="/reference/ui/arrow-5-259.png" alt=""/></span>
          </div>
        </div>
        <div className="upgrade-target">
          <div className="arena-label">{t("Выберите оружие, которое хотите получить")}</div>
          {target ? (<>
              <img className="target-weapon" src={target.image} alt={localizeSkin(target, language).name}/>
              <div className="arena-item-caption" style={{ borderColor: target.rarityColor ?? rarityColors[target.rarity] }}>
                <span><small>{localizeSkin(target, language).weapon}</small>{localizeSkin(target, language).skin}</span>
                <b>{coins(target.price)} ©</b>
              </div>
            </>) : (<div className="arena-placeholder">
            </div>)}
        </div>
      </div>
      <div className="upgrade-controls">
        <label className="balance-slider">
          <Coins size={18}/>
          <span>{t("Добавить баланс")}</span>
          <input aria-label={t("Монеты для апгрейда")} type="range" min={0} max={Math.min(data.player.state.balance, 100000)} value={extra} disabled={busy || finished} onChange={(e) => {
            setExtra(Number(e.target.value));
            setOutcome(null);
        }}/>
          <input aria-label={t("Сумма монет")} type="number" min={0} max={data.player.state.balance} value={extra} disabled={busy || finished} onChange={(e) => setExtra(Math.max(0, Math.min(Number(e.target.value), data.player.state.balance)))}/>
          <span>©</span>
        </label>
        {finished ? (<button className="primary upgrade-button" onClick={reset}>
            <RotateCcw size={16}/>{t("ЕЩЁ АПГРЕЙД")}</button>) : (<button className="primary upgrade-button" disabled={busy || !selected.length || !target || target.price <= value} onClick={upgrade}>
            <ArrowUp size={18}/>
            {busy ? t("ПРОКАЧИВАЕМ…") : t("ПРОКАЧАТЬ")}
          </button>)}
        <div className="multiplier-buttons">
          {[2, 5, 10].map((n) => (<button disabled={!value || busy || finished} key={n} onClick={() => multiplier(n)}>
              x{n}
            </button>))}
          {[30, 50, 75].map((n) => (<button disabled={!value || busy || finished || n - (data.player.state.odds?.upgradeBonus ?? 0) <= 0 || n - (data.player.state.odds?.upgradeBonus ?? 0) > 75} key={n} onClick={() => multiplier((100 - data.settings.upgradeFee) / (n - (data.player.state.odds?.upgradeBonus ?? 0)))}>
              {n}%
            </button>))}
        </div>
      </div>
      <p className="mode-note">{t("При неудаче выбранные предметы и добавленные монеты расходуются. Комиссия:")}{data.settings.upgradeFee}%.
      </p>
      <div className="two-panels">
        <div className="collection-panel">
          <h2>
            <img src="/reference/ui/kerambit-40.png" alt=""/>{t("Мои предметы")}<small>{visibleItems.length}</small>
          </h2>
          {visibleItems.length ? (<>
              <div className="skin-grid small-grid">
                {visibleItems.slice(0, inventoryPage * 60).map((item) => (<SkinCard key={item.uid} skin={lookup.get(item.skinId)!} item={item} selected={selected.includes(item.uid)} onClick={() => toggle(item.uid)}/>))}
              </div>
              {visibleItems.length > inventoryPage * 60 && (<button className="secondary load-more" onClick={() => setInventoryPage((p) => p + 1)}>{t("Ещё предметы")}</button>)}
            </>) : (<Empty title={t("Нет предметов")} description={t("Откройте кейс, чтобы начать апгрейд.")}/>)}
        </div>
        <div className="collection-panel">
          <h2 className="target-heading"><span>{t("Выберите предмет")}</span><div className="target-price-search">
            <span className="target-sort-label">{t("Цена ↑")}</span>
            <input type="number" aria-label={t("Минимальная цена цели")} min={0} placeholder={t("от")} value={minPrice || ""} onChange={event => { setMinPrice(Number(event.target.value)); setPage(1); }}/>
            <input type="number" aria-label={t("Максимальная цена цели")} min={0} placeholder={t("до")} value={maxPrice || ""} onChange={event => { setMaxPrice(Number(event.target.value)); setPage(1); }}/>
            <button aria-label={t("Поиск цели апгрейда")} onClick={() => setSearchOpen(open => !open)}><Search size={16}/></button>
          </div></h2>
          {searchOpen && <div className="search-field target-name-search"><Search size={14}/>
            <input aria-label={t("Название цели апгрейда")} placeholder={t("Название скина")} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/>
          </div>}
          <div className="skin-grid small-grid">
            {targets.slice(0, page * 60).map((skin) => (<SkinCard key={skin.id} skin={skin} selected={target?.id === skin.id} onClick={() => {
                if (!busy && !finished) {
                    setTarget(skin);
                    setOutcome(null);
                }
            }}/>))}
          </div>
          {targets.length === 0 && <div className="upgrade-target-empty">{t("ВОСПОЛЬЗУЙТЕСЬ ПОИСКОМ")}<img src="/reference/ui/ak47-130.png" alt=""/>
          </div>}
          {targets.length > page * 60 && (<button className="secondary load-more" onClick={() => setPage((p) => p + 1)}>{t("Показать ещё 60")}</button>)}
        </div>
      </div>
    </section>);
}
export function Contract({ data, act, audio, fast, onAnimating }: ModeProps) {
    const { t, language } = useLanguage();
    const { lookup, items } = useInventory(data);
    const [selected, setSelected] = useState<string[]>(() => initialSelection(items)), [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState<any>(null), [phase, setPhase] = useState("idle"), [snapshot, setSnapshot] = useState<Item[]>([]), [inventorySnapshot, setInventorySnapshot] = useState<Item[]>([]), [page, setPage] = useState(1);
    const used = phase === "signing" ? snapshot : items.filter((i) => selected.includes(i.uid));
    const total = phase === "revealed" ? result?.total ?? 0 : used.reduce((sum, i) => sum + i.price, 0);
    const filtered = (phase === "signing" ? inventorySnapshot : items).filter((item) => lookup.get(item.skinId)?.name.toLowerCase().includes(query.toLowerCase()));
    function toggle(uid: string) {
        if (busy)
            return;
        if (phase === "revealed") {
            setResult(null);
            setPhase("idle");
        }
        setSelected((current) => current.includes(uid)
            ? current.filter((x) => x !== uid)
            : current.length < 10
                ? [...current, uid]
                : current);
    }
    async function sign() {
        setBusy(true);
        onAnimating(true);
        setSnapshot([...used]);
        setInventorySnapshot([...items]);
        setPhase("signing");
        sound("start", audio);
        try {
            const response = await act("contract", { ids: selected });
            setResult(response.result);
            setSelected([]);
            setSnapshot([]);
            setPhase("revealed");
            sound("success", audio);
        }
        catch {
            setPhase("idle");
        }
        finally {
            setBusy(false);
            onAnimating(false);
        }
    }
    return (<section className={`contract-page ${phase}`}>
      <h1>{t("КОНТРАКТЫ")}</h1>
      <div className="contract-slots">
        {Array.from({ length: 10 }, (_, i) => {
            const item = used[i], skin = item ? lookup.get(item.skinId) : null;
            return (<button className={`contract-slot ${item ? "filled" : ""}`} key={i} disabled={busy || !item} onClick={() => item && toggle(item.uid)}>
              {skin ? (<>
                  <img src={skin.image} alt={skin.name}/>
                  <small>{coins(item.price)} ©</small>
                  <X size={13}/>
                </>) : (<>
                  <img className="slot-placeholder" src="/reference/ui/ak47-130.png" alt=""/>
                </>)}
            </button>);
        })}
      </div>
      <div className="contract-summary">
        <span>
          <Coins size={18}/>{t("Баланс:")}{coins(data.player.state.balance)} ©
        </span>
        <strong>
          {used.length < 3
            ? t(`ДОБАВЬТЕ ЕЩЁ ${3 - used.length} ПРЕДМЕТА`) : ""}
        </strong>
        <span>{t("Сумма контракта:")}<b>{coins(total)} ©</b>
        </span>
      </div>
      <div className="two-panels">
        <div className="collection-panel">
          <h2>{t("МОИ ПРЕДМЕТЫ")}</h2>
          <div className="search-field">
            <Search size={14}/>
            <input aria-label={t("Поиск предметов для контракта")} placeholder={t("Поиск предмета")} value={query} onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
        }}/>
          </div>
          {filtered.length ? (<div className="skin-grid small-grid">
              {filtered.slice(0, page * 60).map((item) => (<SkinCard key={item.uid} skin={lookup.get(item.skinId)!} item={item} selected={selected.includes(item.uid)} onClick={() => toggle(item.uid)}/>))}
            </div>) : (<Empty title={t("Нет предметов")} description={t("Нужно от 3 до 10 незаблокированных предметов.")}/>)}
          {filtered.length > page * 60 && (<button className="secondary load-more" onClick={() => setPage((p) => p + 1)}>{t("Показать ещё")}</button>)}
        </div>
        <div className="contract-document">
          <div className="document-lines">
            {used.length >= 3 && <><p>{t("ВЫ ПОЛУЧИТЕ ПРЕДМЕТ")}</p>
            <strong>{t("ОТ")}{coins(total * data.settings.contractMin)}{t("\u00A9 ДО")}{coins(total * data.settings.contractMax)} ©</strong></>}
          </div>
          {phase === "revealed" && result ? (<div className="contract-reveal">
              <NeonRing />
              <img src={result.skin.image} alt={localizeSkin(result.skin, language).name}/>
              <strong>{localizeSkin(result.skin, language).name}</strong>
              <b>{coins(result.skin.price)} ©</b>
              <small>{t("Предмет добавлен в инвентарь")}</small>
            </div>) : null}
          {<button className="outlined sign-button" disabled={used.length < 3 || busy} onClick={sign}>
              <img src="/reference/ui/handshake-222.png" alt=""/>
              {busy ? t("ПОДПИСЫВАЕМ…") : t("ПОДПИСАТЬ!")}
            </button>}
        </div>
      </div>
      <p className="mode-note">{t("Выбранные предметы расходуются. Результат может стоить меньше общей суммы контракта.")}</p>
    </section>);
}
export function Battle({ data, act, audio, fast, onAnimating }: ModeProps) {
    const { t, language } = useLanguage();
    const [caseId, setCaseId] = useState(data.cases.find((c) => c.price > 0)?.id ?? data.cases[0].id), [rounds, setRounds] = useState(3), [result, setResult] = useState<any>(null), [busy, setBusy] = useState(false), [finished, setFinished] = useState(0);
    const box = data.cases.find((c) => c.id === caseId)!;
    async function start() {
        setBusy(true);
        onAnimating(true);
        setResult(null);
        setFinished(0);
        try {
            const response = await act("battle", { caseId, rounds });
            setResult(response.result);
            if (fast) {
                setFinished(rounds * 2);
                setBusy(false);
                onAnimating(false);
            }
        }
        catch {
            setBusy(false);
            onAnimating(false);
        }
    }
    function finish() {
        setFinished((value) => {
            const next = value + 1;
            if (next === rounds * 2) {
                setBusy(false);
                onAnimating(false);
            }
            return next;
        });
    }
    const revealed = !!result && !busy;
    return (<section>
      <h1>{t("БАТТЛЫ КЕЙСОВ")}</h1>
      <p className="page-description">{t("Вы против бота. Победитель забирает все выпавшие предметы.")}</p>
      <div className="battle-setup panel">
        <CaseArt box={box}/>
        <div>
          <label className="form-field">{t("Выберите кейс")}<select value={caseId} disabled={busy} onChange={(e) => {
            setCaseId(e.target.value);
            setResult(null);
        }}>
              {data.cases
            .filter((c) => c.price > 0)
            .map((c) => (<option key={c.id} value={c.id}>
                    {c.name} · {coins(c.price)} ©
                  </option>))}
            </select>
          </label>
          <div className="open-count">
            <span>{t("Раунды")}</span>
            {[1, 2, 3, 4, 5].map((n) => (<button className={rounds === n ? "active" : ""} key={n} disabled={busy} onClick={() => {
                setRounds(n);
                setResult(null);
            }}>
                {n}
              </button>))}
          </div>
        </div>
        <button className="primary" disabled={busy || data.player.state.balance < box.price * rounds} onClick={start}>
          <Swords size={19}/>
          {busy ? t("БАТТЛ ИДЁТ…") : t(`НАЧАТЬ ЗА ${coins(box.price * rounds)} ©`)}
        </button>
      </div>
      <div className="battle-versus">
        <div className="battle-player">
          <span className="avatar">{data.player.name.slice(0, 1)}</span>
          <strong>{data.player.name}</strong>
          <b>{revealed ? `${coins(result.ownTotal)} ©` : "—"}</b>
        </div>
        <strong className="vs">VS</strong>
        <div className="battle-player">
          <span className="avatar bot">B</span>
          <strong>{t("БОТ")}</strong>
          <b>{revealed ? `${coins(result.botTotal)} ©` : "—"}</b>
        </div>
      </div>
      {result && (<>
          <div className="battle-rounds">
            {result.own.map((skin: Skin, i: number) => (<div className="battle-round" key={i}>
                <div>
                  {fast || revealed ? (<SkinCard skin={skin}/>) : (<Roulette pool={data.skins.slice(0, 60)} winner={skin} duration={4200 + i * 150} audio={audio && i === 0} onFinish={finish}/>)}
                </div>
                <span>{i + 1}</span>
                <div>
                  {fast || revealed ? (<SkinCard skin={result.bot[i]}/>) : (<Roulette pool={data.skins.slice(0, 60)} winner={result.bot[i]} duration={4200 + i * 150} audio={false} onFinish={finish}/>)}
                </div>
              </div>))}
          </div>
          {revealed && (<div className={`battle-result ${result.won ? "won" : "lost"}`}>
              <h2>{result.won ? t("ПОБЕДА!") : t("БОТ ПОБЕДИЛ")}</h2>
              <p>
                {result.won
                    ? t(`${result.items.length} предметов добавлены в ваш инвентарь`) : t("Откройте новый баттл и попробуйте снова")}
              </p>
            </div>)}
        </>)}
    </section>);
}
