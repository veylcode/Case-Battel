"use client";
import { useLanguage, LanguageSwitch, localizeBootstrap, localizeSkin } from "./language";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Coins, Crosshair, FileSignature, Swords, Backpack, Settings2, Search, ChevronLeft, ChevronRight, Gift, Volume2, VolumeX, Shield, User, Trophy, History, HelpCircle, Sparkles, Plus, LogOut, } from "lucide-react";
import type { Bootstrap, Player, Skin, Case, CaseContent, } from "../domain/types";
import { clientContents, rarityColors } from "../domain/rules";
import { api, coins, saleCoins, CaseArt, SkinCard, Modal, Empty, sound } from "./shared";
import { NeonRing, Roulette } from "./roulette";
import { Inventory, Rewards, Leaderboard, Support, HistoryPanel, } from "./player-panels";
import { Upgrade, Contract, Battle } from "./game-modes";
import { OnlineCounter } from "./online";
type View = "cases" | "inventory" | "upgrade" | "contract" | "battle" | "farm" | "leaderboard" | "history" | "support";
export type GameAction = (path: string, body?: unknown) => Promise<any>;
const navigation: {
    id: View;
    label: string;
    icon: typeof Box;
}[] = [
    { id: "farm", label: "Фармилка", icon: Coins },
    { id: "cases", label: "Кейсы", icon: Box },
    { id: "inventory", label: "Инвентарь", icon: Backpack },
    { id: "upgrade", label: "Апгрейд", icon: Crosshair },
    { id: "contract", label: "Контракты", icon: FileSignature },
];
const navigationImages: Record<string, string> = {
    farm: "coins-64", cases: "box-214", inventory: "kerambit-40",
    upgrade: "updrageColor-101", contract: "contract-145",
};
function LiveFeed({ skins }: {
    skins: Skin[];
}) {
    const { t, language } = useLanguage();
    const pool = useMemo(() => {
        const unique = new Map<string, Skin>();
        for (const skin of skins) {
            if (["gold", "red", "pink"].includes(skin.rarity) && skin.price >= 1000) {
                const key = `${skin.weapon}|${skin.skin}`;
                if (!unique.has(key))
                    unique.set(key, skin);
            }
        }
        return [...unique.values()].sort((a, b) => b.price - a.price).slice(0, 1200);
    }, [skins]);
    const [feed, setFeed] = useState<{
        id: string;
        skin: Skin;
        fresh: boolean;
    }[]>([]);
    useEffect(() => {
        if (!pool.length)
            return;
        const pick = (fresh: boolean) => ({ id: crypto.randomUUID(), skin: pool[Math.floor(Math.random() * pool.length)], fresh });
        setFeed(Array.from({ length: 24 }, () => pick(false)));
        const timer = setInterval(() => {
            if (!document.hidden)
                setFeed((current) => [pick(true), ...current.slice(0, 23)]);
        }, 2100);
        return () => clearInterval(timer);
    }, [pool]);
    return <aside className="drop-sidebar" aria-label={t("Лента случайных топовых скинов")}>
    <div className="feed-scroll">{feed.map(({ id, skin, fresh }) => <div className={`feed-item ${fresh ? "new" : ""}`} key={id} style={{ "--rarity": skin.rarityColor ?? rarityColors[skin.rarity] } as React.CSSProperties}>
      <img src={skin.image} alt={skin.name}/><span>{skin.weapon}</span><strong>{skin.skin}</strong>
    </div>)}</div>
  </aside>;
}
export default function Game() {
    const { t, language } = useLanguage();
    const [rawData, setData] = useState<Bootstrap | null>(null), [error, setError] = useState("");
    const catalog = useMemo(() => rawData ? localizeBootstrap(rawData, language) : null, [rawData?.skins, rawData?.cases, language]);
    const data = rawData && catalog ? { ...rawData, skins: catalog.skins, cases: catalog.cases } : null;
    const [view, setView] = useState<View>("cases"), [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [toast, setToast] = useState(""), [modal, setModal] = useState<"auth" | "settings" | "help" | null>(null);
    const [audio, setAudio] = useState(true), [fast, setFast] = useState(false), [pending, setPending] = useState(false);
    const [animating, setAnimating] = useState(false);
    const [farmBalance, setFarmBalance] = useState<number | null>(null);
    const [viewportScale, setViewportScale] = useState(1);
    useEffect(() => {
        const resize = () => {
            const width = document.documentElement.clientWidth;
            setViewportScale(width <= 760 ? 1 : Math.min(1, width / 1280));
        };
        resize();
        addEventListener("resize", resize);
        return () => removeEventListener("resize", resize);
    }, []);
    const bootstrap = useCallback(async () => {
        try {
            const next = await api<Bootstrap>("bootstrap");
            setData(next);
            setError("");
        }
        catch (e) {
            setError((e as Error).message);
        }
    }, []);
    useEffect(() => {
        void bootstrap();
        setAudio(localStorage.getItem("cb_audio") !== "off");
        setFast(localStorage.getItem("cb_fast") === "on" ||
            matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, [bootstrap]);
    useEffect(() => {
        if (!toast)
            return;
        const id = setTimeout(() => setToast(""), 4500);
        return () => clearTimeout(id);
    }, [toast]);
    useEffect(() => {
        if (!data)
            return;
        const sync = () => {
            const hash = decodeURIComponent(location.hash.slice(1));
            const route = hash.split("?")[0];
            if (hash.startsWith("case/")) {
                const box = data.cases.find((c) => c.slug === hash.slice(5));
                if (box) {
                    setSelectedCase(box);
                    setView("cases");
                }
            }
            else if (navigation.some((n) => n.id === route) ||
                ["leaderboard", "history", "support"].includes(route)) {
                setSelectedCase(null);
                setView(route as View);
            }
        };
        sync();
        addEventListener("hashchange", sync);
        return () => removeEventListener("hashchange", sync);
    }, [data?.cases]);
    const notify = (message: string) => setToast(message);
    const updatePlayer = useCallback((player: Player) => setData(previous => {
        if (!previous || (player.id === previous.player.id && (player.version ?? 0) < (previous.player.version ?? 0))) return previous;
        return { ...previous, player };
    }), []);
    const refreshPaused = pending || animating || farmBalance !== null;
    useEffect(() => {
        if (!rawData || refreshPaused) return;
        let mounted = true;
        const refresh = async () => {
            if (document.hidden) return;
            try {
                const response = await api<{ player: Player }>("player");
                if (mounted) updatePlayer(response.player);
            } catch { }
        };
        const timer = setInterval(refresh, 10000);
        window.addEventListener("focus", refresh);
        return () => { mounted = false; clearInterval(timer); window.removeEventListener("focus", refresh); };
    }, [rawData?.player.id, refreshPaused, updatePlayer]);
    const act: GameAction = async (path, body) => {
        setPending(true);
        try {
            const result = await api(path, body);
            if (result.result?.skin) result.result.skin = localizeSkin(result.result.skin, language);
            for (const key of ["drops", "own", "bot"]) {
                if (Array.isArray(result.result?.[key])) result.result[key] = result.result[key].map((entry: any) => entry.skin ? { ...entry, skin: localizeSkin(entry.skin, language) } : localizeSkin(entry, language));
            }
            if (result.player)
                updatePlayer(result.player);
            return result;
        }
        catch (e) {
            notify((e as Error).message);
            throw e;
        }
        finally {
            setPending(false);
        }
    };
    function navigate(next: View) {
        if (animating)
            return;
        setSelectedCase(null);
        setView(next);
        location.hash = next;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function openCase(box: Case) {
        setSelectedCase(box);
        setView("cases");
        location.hash = `case/${box.slug}`;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (!data)
        return (<div className="startup">
        <div className="brand">
          <img src="/case-battle-logo.png" alt="CASE BATTLE"/>
        </div>
        <div className="loader"/>
        <p>{t(error) || t("Загружаем коллекцию…")}</p>
        {error && (<button className="primary" onClick={bootstrap}>{t("Попробовать снова")}</button>)}
      </div>);
    const categories = [
        t("Все кейсы"),
        ...new Set(data.cases.map((c) => c.category)),
    ];
    const visibleCases = data.cases;
    const panels: Record<string, ReactNode> = {
        inventory: (<Inventory data={data} act={act} pending={pending} notify={notify}/>),
        upgrade: (<Upgrade data={data} act={act} audio={audio} fast={fast} onAnimating={setAnimating}/>),
        contract: (<Contract data={data} act={act} audio={audio} fast={fast} onAnimating={setAnimating}/>),
        battle: (<Battle data={data} act={act} audio={audio} fast={fast} onAnimating={setAnimating}/>),
        farm: <Rewards data={data} act={act} notify={notify} pending={pending} onBalancePreview={setFarmBalance}/>,
        leaderboard: <Leaderboard skins={data.skins}/>,
        history: <HistoryPanel player={data.player} skins={data.skins}/>,
        support: <Support act={act} notify={notify}/>,
    };
    return (<div className={`game-shell ${fast ? "fast-mode" : ""}`} style={{ zoom: viewportScale, width: viewportScale < 1 ? 1280 : undefined }}>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("cases")} aria-label={t("CASE BATTLE, главная")}>
          <img src="/case-battle-logo.png" alt="CASE BATTLE"/>
        </button>
        <nav className="main-nav">
          {navigation.map(({ id, label, icon: Icon }) => (<button key={id} className={view === id ? "active" : ""} disabled={animating} onClick={() => navigate(id)}>
              <img src={`/reference/ui/${navigationImages[id]}.png`} alt=""/>
              <span>{t(label)}</span>
            </button>))}
        </nav>
        <OnlineCounter playerId={data.player.id}/>
        <div className="account"><LanguageSwitch />
          <button className="avatar" style={data.player.avatar ? { backgroundImage: `url(${data.player.avatar})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} aria-label={t("Мой профиль")} onClick={() => navigate("inventory")}>
          </button>
          <button className="account-label" onClick={() => data.player.registered ? navigate("inventory") : setModal("auth")}>
            <span>{t("Привет,")}<b>{data.player.name}</b>
            </span>
            <strong>{t("Баланс:")}{coins(farmBalance ?? data.player.state.balance)} <em>©</em>
            </strong>
          </button>
          <button className="icon-button" aria-label={t("Настройки")} onClick={() => setModal("settings")}>
            <img src="/reference/ui/ico-cog-63.png" alt=""/>
          </button>
        </div>
      </header>
      <LiveFeed skins={data.skins}/>
      <main className="main-content">
        {data.settings.announcement && (<div className="announcement">
            <Sparkles size={16}/>
            {data.settings.announcement}
          </div>)}
        {data.player.banned && (<div className="warning">{t("Аккаунт заблокирован. Обратитесь в поддержку.")}</div>)}
        {data.settings.maintenance && (<div className="warning">{t("Техническое обслуживание. Игровые действия временно приостановлены.")}</div>)}
        {view === "cases" ? (selectedCase ? (<CasePage key={selectedCase.id} box={selectedCase} data={data} act={act} fast={fast} audio={audio} onAnimating={setAnimating} onBack={() => navigate("cases")}/>) : (<>
              {categories
                .slice(1)
                .filter((name) => visibleCases.some((c) => c.category === name))
                .map((name) => (<section className="case-section" key={name}>
                    <div className="section-caption">
                      <span />
                      {name.toUpperCase()}
                      <span />
                    </div>
                    <div className="case-grid">
                      {visibleCases
                    .filter((c) => c.category === name)
                    .map((box) => (<button className="case-card" key={box.id} onClick={() => openCase(box)}>
                            <div className="case-card-label">
                              <strong>{box.name.toUpperCase()}</strong>
                              <small>
                                {clientContents(box, data).length}{t("предметов")}</small>
                            </div>
                            <CaseArt box={box}/>
                            <span className="case-price">
                              {box.price === 0 ? t("БЕСПЛАТНО") : coins(box.price)}{" "}
                              <em>©</em>
                            </span>
                          </button>))}
                    </div>
                  </section>))}
              {!visibleCases.length && (<Empty title={t("Кейсы не найдены")} description={t("Попробуйте другой запрос или категорию.")}/>)}
            </>)) : (panels[view])}
        <footer className="footer">
          <div className="footer-top">
            <div className="brand">
              <img src="/case-battle-logo.png" alt="CASE BATTLE"/>
            </div>
            <div>
              <button onClick={() => navigate("leaderboard")}>
                <Trophy size={15}/>{t("Топ игроков")}</button>
              <button onClick={() => navigate("history")}>
                <History size={15}/>{t("История")}</button>
              <button onClick={() => navigate("support")}>
                <HelpCircle size={15}/>{t("Поддержка")}</button>
              <button onClick={() => setModal("help")}>
                <FileSignature size={15}/>{t("Как играть")}</button>
              <a href="/admin">
                <Shield size={15}/>{t("Администратор")}</a>
            </div>
          </div>
          <p>{t("Симулятор CS2. Монеты и предметы виртуальные. Пополнение реальными деньгами, вывод и торговля отсутствуют.")}</p>
          <small>{t("CASE BATTLE \u00A9 2026 \u00B7 Не связан с Valve, Steam или Яндекс Играми.")}</small>
        </footer>
      </main>
      {toast && (<div className="toast" role="status">
          {t(toast)}
        </div>)}
      {modal === "auth" && (<AuthModal onClose={() => setModal(null)} onSuccess={(player) => {
                updatePlayer(player);
                setModal(null);
                notify(t("Вы вошли в аккаунт"));
            }}/>)}
      {modal === "settings" && (<Modal title={t("Настройки")} onClose={() => setModal(null)}>
          <div className="settings-list"><label><span>{language === "ru" ? "Язык" : "Language"}</span><LanguageSwitch /></label>
            <label>
              <span>
                <Volume2 size={18}/>{t("Звуки игры")}</span>
              <input type="checkbox" checked={audio} onChange={(e) => {
                setAudio(e.target.checked);
                localStorage.setItem("cb_audio", e.target.checked ? "on" : "off");
            }}/>
            </label>
            <label>
              <span>
                <Sparkles size={18}/>{t("Быстрые анимации")}</span>
              <input type="checkbox" checked={fast} onChange={(e) => {
                setFast(e.target.checked);
                localStorage.setItem("cb_fast", e.target.checked ? "on" : "off");
            }}/>
            </label>
          </div>
          <p className="muted">{t("Результат определяется сервером до начала анимации. Скорость не влияет на вероятность выпадения.")}</p>
          <button className="secondary wide" onClick={() => {
                setModal("auth");
            }}>
            <User size={16}/>
            {data.player.registered ? t("Сменить аккаунт") : t("Вход и регистрация")}
          </button>
          {data.player.registered && (<button className="text-button" onClick={async () => {
                    try {
                        await api("auth/logout", {});
                        setModal(null);
                        await bootstrap();
                    }
                    catch (e) {
                        notify((e as Error).message);
                    }
                }}>
              <LogOut size={15}/>{t("Выйти из аккаунта")}</button>)}
        </Modal>)}
      {modal === "help" && (<Modal title={t("Как играть")} onClose={() => setModal(null)}>
          <div className="help-copy">
            <h3>{t("Кейсы")}</h3>
            <p>{t("Выберите кейс и откройте до 10 штук одновременно. Выпавшие предметы сохраняются в инвентаре. Их можно продать за монеты или использовать дальше. Шансы показаны в содержимом кейса.")}</p>
            <h3>{t("Апгрейд")}</h3>
            <p>{t("Выберите до 6 предметов и более дорогую цель. Можно добавить монеты. Вероятность зависит от стоимости и комиссии")}{" "}
              {data.settings.upgradeFee}{t("%. При неудаче исходные предметы расходуются.")}</p>
            <h3>{t("Контракты")}</h3>
            <p>{t("Обменяйте 3\u201310 предметов на один в диапазоне")}{" "}
              {data.settings.contractMin}–{data.settings.contractMax}{t("от их общей стоимости.")}</p>
            <h3>{t("Баттлы")}</h3>
            <p>{t("Соревнование с ботом на 1\u20135 раундов. Победитель получает предметы обоих участников. При равенстве побеждает игрок.")}</p>
            <h3>{t("Монеты")}</h3>
            <p>{t("Получайте ежедневный бонус, используйте фармилку и промокоды. Бесплатные кейсы доступны раз в 24 часа: один кейс на аккаунт.")}</p>
            <h3>{t("Сохранение")}</h3>
            <p>{t("Гостевой прогресс привязан к браузеру. Зарегистрируйтесь, чтобы входить в тот же аккаунт с другого устройства.")}</p>
          </div>
        </Modal>)}
    </div>);
}
function CasePage({ box, data, act, fast, audio, onAnimating, onBack, }: {
    box: Case;
    data: Bootstrap;
    act: GameAction;
    fast: boolean;
    audio: boolean;
    onAnimating: (busy: boolean) => void;
    onBack: () => void;
}) {
    const { t, language } = useLanguage();
    const [count, setCount] = useState(1), [drops, setDrops] = useState<{
        skin: Skin;
        item: {
            uid: string;
        };
    }[]>([]), [busy, setBusy] = useState(false), [finished, setFinished] = useState(0), [round, setRound] = useState(0), [sold, setSold] = useState(false), [soldItems, setSoldItems] = useState<string[]>([]), [showOdds, setShowOdds] = useState(false), [quickOpen, setQuickOpen] = useState(false);
    const pool = clientContents(box, data);
    const priceCents = Math.round(box.price * 100);
    const balanceCents = Math.round(data.player.state.balance * 100);
    const affordableCount = priceCents === 0 ? 1 : Math.max(0, Math.min(10, Math.floor(balanceCents / priceCents)));
    const selectedCount = Math.min(count, Math.max(1, affordableCount));
    useEffect(() => { setCount(current => Math.min(current, Math.max(1, affordableCount))); }, [affordableCount]);
    async function open(quick = false) {
        if (busy || affordableCount === 0)
            return;
        setBusy(true);
        onAnimating(true);
        setSold(false);
        setSoldItems([]);
        setQuickOpen(quick || fast);
        setFinished(0);
        try {
            const result = await act("open", { caseId: box.id, count: selectedCount });
            setRound((r) => r + 1);
            setDrops(result.result.drops);
        }
        catch {
            setBusy(false);
            onAnimating(false);
        }
    }
    function finish() {
        setFinished((current) => current + 1);
    }
    useEffect(() => {
        if (drops.length && finished >= drops.length) {
            setBusy(false);
            onAnimating(false);
        }
    }, [finished, drops.length, onAnimating]);
    async function sell(uid?: string) {
        try {
            const ids = uid ? [uid] : drops.map((d) => d.item.uid).filter(id => !soldItems.includes(id));
            await act("sell", { ids });
            sound("coins", audio);
            const soldNext = [...soldItems, ...ids];
            setSoldItems(soldNext);
            setSold(soldNext.length >= drops.length);
        }
        catch { }
    }
    const total = drops.filter(d => !soldItems.includes(d.item.uid)).reduce((sum, d) => sum + d.skin.price, 0);
    return (<section className={`case-detail ${drops.length ? "opened" : ""}`}>
      <button className="back-button" disabled={busy} onClick={onBack}>
        <ChevronLeft size={16}/>{t("Все кейсы")}</button>
      <h1>«{box.name.toUpperCase()}»</h1>
      <div className="case-stage">
        {!drops.length ? (<div className="case-showcase">
            <NeonRing />
            <CaseArt box={box}/>
          </div>) : (<div className={`reels ${drops.length > 3 ? "compact-reels" : ""}`} style={{ "--reel-columns": Math.min(drops.length, 5), maxWidth: drops.length > 3 ? "1094px" : "814px" } as React.CSSProperties}>
            {drops.map((drop, i) => (<Roulette key={`${round}-${i}`} pool={pool.map((x) => x.skin)} winner={drop.skin} duration={quickOpen ? 0 : 6100} audio={audio && i === 0} onFinish={finish} onSell={drops.length > 1 ? () => sell(drop.item.uid) : undefined} sold={soldItems.includes(drop.item.uid)}/>))}
          </div>)}
      </div>
      {!drops.length || busy ? (<>
          {!busy && <div className="open-count">
            {affordableCount > 0 ? <>
            <span>{t("Открыть")}</span>
            {Array.from({ length: affordableCount }, (_, i) => (<button key={i} disabled={busy} className={selectedCount === i + 1 ? "active" : ""} onClick={() => setCount(i + 1)}>
                {i + 1}
              </button>))}
            <span>{t("раз")}</span>
            </> : <span role="status">{t("Недостаточно средств")}</span>}
          </div>}
          <div className="action-row">
            <button className="outlined" disabled={busy || affordableCount === 0} onClick={() => open()}>
              <Box size={15}/>
              {t(`ОТКРЫТЬ ЗА ${coins(box.price * selectedCount)} ©`)}
            </button>
            <button className="outlined" disabled={busy || affordableCount === 0} onClick={() => open(true)}>
              <Sparkles size={15}/>{t("БЫСТРО ЗА")}{coins(box.price * selectedCount)} ©
            </button>
          </div>
        </>) : (<div className="action-row result-actions">
          <button className="outlined" disabled={sold} onClick={() => sell()}>
            <Coins size={16}/>
            {sold ? t("ПРОДАНО") : t(`ПРОДАТЬ ЗА ${saleCoins(total)} ©`)}
          </button>
          <button className="outlined" onClick={() => {
                setDrops([]);
                setFinished(0);
            }}>
            <img src="/reference/ui/again-74.png" alt=""/>{t("ЕЩЁ РАЗ")}</button>
          <span className="result-hint">
            {sold ? t("Монеты зачислены на баланс") : t("Предметы уже в инвентаре")}
          </span>
        </div>)}
      {box.price === 0 && (<p className="center muted">{t("Один бесплатный кейс на аккаунт раз в 24 часа.")}</p>)}
      <div className="contents-heading">
        <h2>{t("СОДЕРЖИМОЕ КЕЙСА")}</h2>
        <button className="text-button" onClick={() => setShowOdds((x) => !x)}>
          {showOdds ? t("Скрыть шансы") : t("Показать шансы")}
        </button>
      </div>
      <div className="skin-grid case-contents">
        {pool.map((entry) => (<SkinCard key={entry.skin.id} skin={entry.skin} roundPrice showChance={showOdds ? entry.chance : undefined}/>))}
      </div>
    </section>);
}
function AuthModal({ onClose, onSuccess, }: {
    onClose: () => void;
    onSuccess: (player: Player) => void;
}) {
    const { t, language } = useLanguage();
    const [register, setRegister] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    return (<Modal title={register ? t("Создать аккаунт") : t("Вход в аккаунт")} onClose={onClose}>
      <div className="segmented">
        <button className={!register ? "active" : ""} onClick={() => setRegister(false)}>{t("Вход")}</button>
        <button className={register ? "active" : ""} onClick={() => setRegister(true)}>{t("Регистрация")}</button>
      </div>
      <form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
                const result = await api(`auth/${register ? "register" : "login"}`, Object.fromEntries(form));
                onSuccess(result.player);
            }
            catch (err) {
                setError((err as Error).message);
            }
            finally {
                setBusy(false);
            }
        }}>
        {register && (<label className="form-field">{t("Никнейм")}<input name="name" minLength={2} maxLength={32} required autoComplete="nickname"/>
          </label>)}
        <label className="form-field">{t("Логин")}<input name="login" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" required autoComplete="username"/>
        </label>
        <label className="form-field">{t("Пароль")}<input name="password" type="password" minLength={8} maxLength={128} required autoComplete={register ? "new-password" : "current-password"}/>
        </label>
        {error && (<p className="form-error" role="alert">
            {t(error)}
          </p>)}
        <button className="primary wide" disabled={busy}>
          {busy ? t("Подождите…") : register ? t("ЗАРЕГИСТРИРОВАТЬСЯ") : t("ВОЙТИ")}
        </button>
        <p className="muted">
          {register
            ? t("Ваш гостевой баланс и предметы сохранятся в новом аккаунте.") : t("Входите в свой аккаунт, чтобы продолжить коллекцию.")}
        </p>
      </form>
    </Modal>);
}
