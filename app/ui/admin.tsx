"use client";
import { useLanguage, LanguageSwitch, localizeSkin, translate, caseName } from "./language";
import { useEffect, useMemo, useState } from "react";
import { Shield, Users, Box, SlidersHorizontal, Gift, Coins, ScrollText, LifeBuoy, LayoutDashboard, LogOut, Search, Save, Plus, Download, ChevronRight, ArrowLeft, TrendingUp, Lock, Ban, FileSignature, Crosshair, Menu, } from "lucide-react";
import type { Case, Player, Settings, Skin, Bootstrap } from "../domain/types";
import { clientContents } from "../domain/rules";
import { api, coins, CaseArt, SkinCard, Modal, Empty } from "./shared";
import { PlayerOddsForm } from "./player-odds";
interface AdminData {
    users: Player[];
    logs: any[];
    tickets: any[];
    settings: Settings;
    cases: Case[];
    skins: Skin[];
    caseContents: Bootstrap["caseContents"];
}
type Section = "dashboard" | "users" | "cases" | "odds" | "skins" | "promos" | "economy" | "tickets" | "audit";
const tabs = [
    { id: "dashboard", label: "Обзор", icon: LayoutDashboard },
    { id: "users", label: "Пользователи", icon: Users },
    { id: "cases", label: "Кейсы", icon: Box },
    { id: "odds", label: "Шансы выпадения", icon: SlidersHorizontal },
    { id: "skins", label: "Каталог предметов", icon: Crosshair },
    { id: "promos", label: "Промокоды", icon: Gift },
    { id: "economy", label: "Экономика и сайт", icon: Coins },
    { id: "tickets", label: "Поддержка", icon: LifeBuoy },
    { id: "audit", label: "Журнал действий", icon: ScrollText },
];
export default function Admin() {
    const { t, language } = useLanguage();
    const [rawData, setData] = useState<AdminData | null>(null), [loading, setLoading] = useState(true), [section, setSection] = useState<Section>("dashboard"), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [mobileMenu, setMobileMenu] = useState(false);
    const data = useMemo(() => rawData ? { ...rawData, skins: rawData.skins.map((skin) => localizeSkin(skin, language)) } : null, [rawData, language]);
    async function load() {
        try {
            setData(await api<AdminData>("admin/bootstrap"));
            setError("");
        }
        catch (e) {
            if ((e as Error).message !== "Войдите в панель администратора")
                setError((e as Error).message);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
    }, []);
    useEffect(() => {
        if (!notice)
            return;
        const timer = setTimeout(() => setNotice(""), 4500);
        return () => clearTimeout(timer);
    }, [notice]);
    async function request(path: string, body: unknown) {
        setBusy(true);
        setError("");
        try {
            const response = await api(path, body);
            await load();
            setNotice(t("Изменения сохранены"));
            return response;
        }
        catch (e) {
            setError((e as Error).message);
            throw e;
        }
        finally {
            setBusy(false);
        }
    }
    const save = (settings: Partial<Settings>) => request("admin/settings", { settings });
    if (loading)
        return (<div className="startup">
        <Shield size={42}/>
        <div className="loader"/>
        <p>{t("Проверяем доступ\u2026")}</p>
      </div>);
    if (!data)
        return (<div className="admin-login">
        <a className="back-button" href="/">
          <ArrowLeft size={16}/>{t("К игре")}</a>
        <div className="admin-login-card">
          <div className="admin-shield">
            <Shield size={35}/>
          </div>
          <div className="brand"><img src="/case-battle-logo.png" alt="CASE BATTLE"/></div>
          <LanguageSwitch /><h1>{t("Панель администратора")}</h1>
          <p className="muted">{t("Войдите, чтобы управлять игрой.")}</p>
          <form onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                    await api("admin/login", Object.fromEntries(new FormData(e.currentTarget)));
                    await load();
                }
                catch (err) {
                    setError((err as Error).message);
                }
                finally {
                    setBusy(false);
                }
            }}>
            <label className="form-field">{t("Логин")}<input name="login" autoComplete="username" required defaultValue="admin"/>
            </label>
            <label className="form-field">{t("Пароль")}<input name="password" type="password" autoComplete="current-password" required minLength={8}/>
            </label>
            {error && (<p className="form-error" role="alert">
                {t(error)}
              </p>)}
            <button className="primary wide" disabled={busy}>
              <Lock size={16}/>
              {busy ? t("ПРОВЕРЯЕМ…") : t("ВОЙТИ")}
            </button>
          </form>
          <small>{t("Защищённая сессия \u00B7 8 часов")}</small>
        </div>
      </div>);
    const shared = { data, busy, save, request };
    const panels: Record<Section, React.ReactNode> = {
        dashboard: <Dashboard data={data} navigate={setSection}/>,
        users: <UserManagement {...shared}/>,
        cases: <CaseManagement {...shared}/>,
        odds: <OddsManagement {...shared}/>,
        skins: <SkinManagement {...shared}/>,
        promos: <PromoManagement {...shared}/>,
        economy: <Economy {...shared}/>,
        tickets: <TicketManagement {...shared}/>,
        audit: <AuditLog data={data}/>,
    };
    return (<div className="admin-shell">
      <aside className={`admin-sidebar ${mobileMenu ? "expanded" : ""}`}>
        <a className="brand" href="/"><img src="/case-battle-logo.png" alt="CASE BATTLE"/></a>
        <div className="admin-role">
          <Shield size={15}/>
          {language === "ru" ? "АДМИН-ПАНЕЛЬ" : "ADMIN CONSOLE"}
        </div>
        <nav>
          {tabs.map(({ id, label, icon: Icon }) => (<button key={id} className={section === id ? "active" : ""} onClick={() => {
                setSection(id as Section);
                setError("");
                setMobileMenu(false);
            }}>
              <Icon size={18}/>
              {t(label)}
              {id === "tickets" &&
                data.tickets.some((t) => t.status === "open") && <i />}
            </button>))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/">
            <ArrowLeft size={16}/>{t("Открыть игру")}</a>
          <button onClick={async () => {
            await api("admin/logout", {});
            setData(null);
        }}>
            <LogOut size={16}/>{t("Выйти")}</button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <button className="icon-button mobile-menu" aria-label={t("Меню администратора")} onClick={() => setMobileMenu((x) => !x)}>
            <Menu />
          </button>
          <div>
            <span>{t("ПАНЕЛЬ УПРАВЛЕНИЯ")}</span>
            <h1>{t(tabs.find((entry) => entry.id === section)?.label ?? "")}</h1>
          </div>
          <div className="admin-header-right"><LanguageSwitch />
            <span className="status-dot"/>
            {data.settings.maintenance ? t("Обслуживание") : t("Сайт работает")}
            <button className="secondary" onClick={load} disabled={busy}>{t("Обновить")}</button>
            <div className="avatar">A</div>
          </div>
        </header>
        {error && (<div className="warning" role="alert">
            {t(error)}
          </div>)}
        {panels[section]}
      </main>
      {notice && (<div className="toast" role="status">
          {t(notice)}
        </div>)}
    </div>);
}
type AdminProps = {
    data: AdminData;
    busy: boolean;
    save: (settings: Partial<Settings>) => Promise<any>;
    request: (path: string, body: unknown) => Promise<any>;
};
function Dashboard({ data, navigate, }: {
    data: AdminData;
    navigate: (section: Section) => void;
}) {
    const { t, language } = useLanguage();
    const sum = (field: "balance" | "opened" | "earned" | "spent") => data.users.reduce((total, user) => total + user.state[field], 0);
    const stats = [
        {
            label: t("Пользователи"),
            value: coins(data.users.length),
            icon: Users,
            note: t(`${data.users.filter((u) => u.registered).length} зарегистрированных`),
        },
        {
            label: t("Открыто кейсов"),
            value: coins(sum("opened")),
            icon: Box,
            note: t(`${data.cases.length} кейсов в каталоге`),
        },
        {
            label: t("Баланс игроков"),
            value: `${coins(sum("balance"))} ◉`,
            icon: Coins,
            note: t("Общий виртуальный баланс"),
        },
        {
            label: t("Предметы в каталоге"),
            value: coins(data.skins.length),
            icon: Crosshair,
            note: t("Оружие, ножи и перчатки"),
        },
    ];
    return (<>
      <div className="admin-stat-grid">
        {stats.map(({ label, value, icon: Icon, note }) => (<article className="admin-stat" key={t(label)}>
            <div>
              <span>{t(label)}</span>
              <Icon size={20}/>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>))}
      </div>
      <div className="admin-overview">
        <div className="panel">
          <div className="panel-title">
            <h2>{t("ЭКОНОМИКА")}</h2>
            <button className="text-button" onClick={() => navigate("economy")}>{t("Настроить")}<ChevronRight size={14}/>
            </button>
          </div>
          <div className="economy-summary">
            <span>{t("Потрачено в игре")}<b>{coins(sum("spent"))} ◉</b>
            </span>
            <span>{t("Продано предметов")}<b>{coins(sum("earned"))} ◉</b>
            </span>
            <span>{t("В инвентарях")}<b>
                {coins(data.users.reduce((sum, u) => sum + u.state.inventory.length, 0))}
              </b>
            </span>
          </div>
          <div className="mini-chart">
            {Array.from({ length: 14 }, (_, i) => {
            const now = Date.now(), start = now - (13 - i) * 86400000, end = start + 86400000;
            const opened = data.users.reduce((sum, u) => sum +
                u.state.history.filter((h) => h.type === "case" && h.time >= start && h.time < end).length, 0);
            return (<div key={i}>
                  <span style={{
                    height: `${Math.max(4, Math.min(100, opened * 10))}%`,
                }}/>
                  <small>{new Date(start).getDate()}</small>
                </div>);
        })}
          </div>
          <p className="muted">{t("Операции за 14 дней в пределах сохранённой истории.")}</p>
        </div>
        <div className="panel">
          <h2>{t("БЫСТРЫЕ ДЕЙСТВИЯ")}</h2>
          <div className="admin-quick-actions">
            {[
            {
                section: "users",
                label: t("Изменить баланс игрока"),
                icon: Coins,
            },
            { section: "cases", label: t("Настроить кейсы"), icon: Box },
            {
                section: "odds",
                label: t("Редактировать шансы"),
                icon: SlidersHorizontal,
            },
            { section: "promos", label: t("Создать промокод"), icon: Gift },
            {
                section: "tickets",
                label: t(`Обращения: ${data.tickets.filter((t) => t.status === "open").length} открытых`),
                icon: LifeBuoy,
            },
        ].map(({ section, label, icon: Icon }) => (<button key={section} onClick={() => navigate(section as Section)}>
                <Icon size={18}/>
                {t(label)}
                <ChevronRight size={15}/>
              </button>))}
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <h2>{t("ПОСЛЕДНИЕ ДЕЙСТВИЯ")}</h2>
          <button className="text-button" onClick={() => navigate("audit")}>{t("Весь журнал")}<ChevronRight size={14}/>
          </button>
        </div>
        <AuditTable rows={data.logs.slice(0, 8)}/>
      </div>
    </>);
}
function UserManagement({ data, busy, request }: AdminProps) {
    const { t, language } = useLanguage();
    const [query, setQuery] = useState(""), [selected, setSelected] = useState<Player | null>(null), [mode, setMode] = useState("add"), [amount, setAmount] = useState(1000), [reason, setReason] = useState(t("Бонус от администратора")), [skinQuery, setSkinQuery] = useState(""), [skinId, setSkinId] = useState(data.skins[0].id);
    const users = data.users.filter((u) => `${u.name} ${u.id}`.toLowerCase().includes(query.toLowerCase()));
    const player = selected
        ? (data.users.find((u) => u.id === selected.id) ?? selected)
        : null;
    function exportUsers() {
        const blob = new Blob([
            JSON.stringify(data.users.map(({ id, name, registered, banned, created, state }) => ({
                id,
                name,
                registered,
                banned,
                created,
                balance: state.balance,
                opened: state.opened,
                inventory: state.inventory.length,
            })), null, 2),
        ], { type: "application/json" });
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url;
        link.download = "case-battel-users.json";
        link.click();
        URL.revokeObjectURL(url);
    }
    return (<>
      <div className="admin-toolbar">
        <div className="search-field">
          <Search size={16}/>
          <input placeholder={t("Имя или ID игрока")} aria-label={t("Поиск пользователя")} value={query} onChange={(e) => setQuery(e.target.value)}/>
        </div>
        <span>{users.length}{t("пользователей")}</span>
        <button className="secondary" onClick={exportUsers}>
          <Download size={15}/>{t("Экспорт")}</button>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>{t("Пользователь")}</th>
              <th>{t("Баланс")}</th>
              <th>{t("Предметы")}</th>
              <th>{t("Кейсы")}</th>
              <th>{t("Статус")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (<tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small className="block">{u.id.slice(0, 8)}</small>
                </td>
                <td className="orange">{coins(u.state.balance)} ◉</td>
                <td>{u.state.inventory.length}</td>
                <td>{u.state.opened}</td>
                <td>
                  <span className={`badge ${u.banned ? "red" : "green"}`}>
                    {u.banned
                ? t("Заблокирован") : u.registered
                ? t("Аккаунт") : t("Гость")}
                  </span>
                </td>
                <td>
                  <button className="secondary" onClick={() => setSelected(u)}>{t("Управление")}</button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {player && (<Modal title={t(`Игрок: ${player.name}`)} onClose={() => setSelected(null)}>
          <div className="user-detail-stats">
            <div>{t("Баланс")}<strong>{coins(player.state.balance)} ◉</strong>
            </div>
            <div>{t("Инвентарь")}<strong>{player.state.inventory.length}</strong>
            </div>
            <div>{t("Открыто")}<strong>{player.state.opened}</strong>
            </div>
          </div>
          <form onSubmit={(e) => {
                e.preventDefault();
                void request("admin/user", {
                    id: player.id,
                    action: "balance",
                    mode,
                    amount,
                    reason,
                }).catch(() => { });
            }}>
            <h3>{t("Изменить баланс")}</h3>
            <div className="segmented">
              {[
                { id: "add", label: t("Начислить") },
                { id: "subtract", label: t("Списать") },
                { id: "set", label: t("Установить") },
            ].map((x) => (<button type="button" key={x.id} className={mode === x.id ? "active" : ""} onClick={() => setMode(x.id)}>
                  {x.label}
                </button>))}
            </div>
            <label className="form-field">{t("Сумма")}<input aria-label={t("Сумма изменения баланса")} type="number" step="0.01" min={0} max={100000000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required/>
            </label>
            <label className="form-field">{t("Причина")}<input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={200} required/>
            </label>
            <button className="primary wide" disabled={busy}>
              <Coins size={16}/>{t("ПРИМЕНИТЬ")}</button>
          </form>
          <hr />
          <h3>{t("Выдать предмет")}</h3>
          <input placeholder={t("Поиск скина")} aria-label={t("Поиск выдаваемого скина")} value={skinQuery} onChange={(e) => setSkinQuery(e.target.value)}/>
          <select aria-label={t("Выдать скин")} className="wide" value={skinId} onChange={(e) => setSkinId(e.target.value)}>
            {data.skins
                .filter((s) => s.name.toLowerCase().includes(skinQuery.toLowerCase()))
                .slice(0, 200)
                .map((s) => (<option value={s.id} key={s.id}>
                  {s.name} · {coins(s.price)} ◉
                </option>))}
          </select>
          <button className="secondary wide" disabled={busy} onClick={() => void request("admin/user", {
                id: player.id,
                action: "give",
                skinId,
            }).catch(() => { })}>
            <Plus size={16}/>{t("Выдать предмет")}</button>
          <hr />
          <PlayerOddsForm player={player} busy={busy} save={body => request("admin/user", body)}/>
          <hr />
          <button className={`secondary wide ${player.banned ? "" : "danger"}`} disabled={busy} onClick={() => void request("admin/user", {
                id: player.id,
                action: "ban",
                banned: !player.banned,
            }).catch(() => { })}>
            <Ban size={16}/>
            {player.banned ? t("Разблокировать аккаунт") : t("Заблокировать аккаунт")}
          </button>
          <p className="muted">{t("Изменения записываются в журнал. У игрока сохраняются история и инвентарь.")}</p>
        </Modal>)}
    </>);
}
function CaseManagement({ data, busy, save }: AdminProps) {
    const { t, language } = useLanguage();
    const [query, setQuery] = useState(""), [category, setCategory] = useState("all"), [editing, setEditing] = useState<Case | null>(null), [form, setForm] = useState<Case | null>(null);
    const rows = data.cases.filter((c) => caseName(c, language).toLowerCase().includes(query.toLowerCase()) &&
        (category === "all" || c.category === category));
    return (<>
      <div className="admin-toolbar">
        <div className="search-field">
          <Search size={16}/>
          <input aria-label={t("Поиск кейса в админке")} placeholder={t("Название кейса")} value={query} onChange={(e) => setQuery(e.target.value)}/>
        </div>
        <select aria-label={t("Категория кейса")} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">{t("Все")}</option>
          {Array.from(new Set(data.cases.map((c) => c.category))).map((c) => (<option key={c} value={c}>{t(c)}</option>))}
        </select>
        <span>{rows.length}{t("кейсов")}</span>
        <button className="primary" onClick={() => {
            const id = `custom-${Date.now()}`;
            const box = {
                ...data.cases[0],
                id,
                slug: id,
                name: t("Новый кейс"),
                price: 99,
                category: t("Авторские кейсы"),
                enabled: true,
            };
            setEditing(box);
            setForm(box);
        }}>
          <Plus size={16}/>{t("ДОБАВИТЬ КЕЙС")}</button>
      </div>
      <div className="admin-case-grid">
        {rows.map((c) => (<article className={`admin-case panel ${c.enabled === false ? "disabled-case" : ""}`} key={c.id}>
            <CaseArt box={c}/>
            <strong>{caseName(c, language)}</strong>
            <small>{t(c.category)}</small>
            <div>
              <b>{coins(c.price)} ◉</b>
              <span className={`badge ${c.enabled === false ? "red" : "green"}`}>
                {c.enabled === false ? t("Скрыт") : t("Активен")}
              </span>
            </div>
            <button className="secondary wide" onClick={() => {
                setEditing(c);
                setForm({ ...c });
            }}>{t("Редактировать")}</button>
          </article>))}
      </div>
      {editing && form && (<Modal title={t("Настройки кейса")} onClose={() => {
                setEditing(null);
                setForm(null);
            }}>
          <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                    await save({
                        caseOverrides: {
                            ...data.settings.caseOverrides,
                            [form.id]: form,
                        },
                    });
                    setEditing(null);
                    setForm(null);
                }
                catch { }
            }}>
            <CaseArt box={form}/>
            <label className="form-field">{t("Название")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} maxLength={80} required/>
            </label>
            <label className="form-field">{t("Цена, монеты")}<input type="number" step="0.01" min={0} max={10000000} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required/>
            </label>
            <label className="form-field">{t("Категория")}<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={80} required/>
            </label>
            <label className="form-field">{t("Обложка")}<select value={form.image} onChange={(e) => {
                const art = data.cases.find((c) => c.image === e.target.value)!;
                setForm({
                    ...form,
                    image: art.image,
                    imageBack: art.imageBack,
                    color: art.color,
                });
            }}>
                {data.cases.map((c) => (<option key={c.id} value={c.image}>
                    {caseName(c, language)}
                  </option>))}
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.enabled !== false} onChange={(e) => setForm({ ...form, enabled: e.target.checked })}/>{t("Показывать на сайте")}</label>
            <button className="primary wide" disabled={busy}>
              <Save size={16}/>{t("СОХРАНИТЬ")}</button>
          </form>
        </Modal>)}
    </>);
}
function OddsManagement({ data, busy, save }: AdminProps) {
    const { t, language } = useLanguage();
    const [caseId, setCaseId] = useState(data.cases[0].id), [weights, setWeights] = useState<Record<string, number>>({}), [changed, setChanged] = useState(false);
    const box = data.cases.find((c) => c.id === caseId)!;
    const pool = clientContents(box, data as unknown as Bootstrap);
    useEffect(() => {
        setWeights(Object.fromEntries(pool.map((x) => [x.skin.id, x.weight])));
        setChanged(false);
    }, [caseId, data.settings]);
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return (<>
      <div className="admin-toolbar">
        <label className="inline-label">{t("Кейс")}<select aria-label={t("Кейс для настройки шансов")} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            {data.cases.map((c) => (<option value={c.id} key={c.id}>
                {caseName(c, language)} · {coins(c.price)} ◉
              </option>))}
          </select>
        </label>
        <button className="secondary" disabled={busy} onClick={() => {
            const next = { ...data.settings.odds };
            delete next[caseId];
            void save({ odds: next }).catch(() => { });
        }}>{t("Сбросить шансы")}</button>
        <button className="primary" disabled={busy || !changed || total <= 0} onClick={() => void save({
            odds: { ...data.settings.odds, [caseId]: weights },
        }).catch(() => { })}>
          <Save size={16}/>{t("СОХРАНИТЬ ШАНСЫ")}</button>
      </div>
      <div className="info-banner">
        <SlidersHorizontal size={20}/>
        <div>
          <strong>{t("Вероятности задаются весами")}</strong>
          <p>{t("Шанс = вес предмета / сумма всех весов. Вес 0 отключает выпадение. Текущие вероятности видны игрокам в содержимом кейса.")}</p>
        </div>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>{t("Предмет")}</th>
              <th>{t("Цена")}</th>
              <th>{t("Вес выпадения")}</th>
              <th>{t("Шанс")}</th>
            </tr>
          </thead>
          <tbody>
            {pool.map(({ skin }) => (<tr key={skin.id}>
                <td className="table-item">
                  <img src={skin.image} alt=""/>
                  <span>{skin.name}</span>
                </td>
                <td>{coins(skin.price)} ◉</td>
                <td>
                  <input aria-label={t(`Вес ${skin.name}`)} type="number" min={0} max={1000000} step="0.001" value={weights[skin.id] ?? 0} onChange={(e) => {
                setWeights({
                    ...weights,
                    [skin.id]: Number(e.target.value),
                });
                setChanged(true);
            }}/>
                </td>
                <td>
                  <div className="odds-display">
                    <strong>
                      {total
                ? (((weights[skin.id] ?? 0) / total) * 100).toFixed(3)
                : "0"}
                      %
                    </strong>
                    <span style={{
                width: `${Math.min(100, total ? ((weights[skin.id] ?? 0) / total) * 100 : 0)}%`,
            }}/>
                  </div>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </>);
}
function SkinManagement({ data, busy, save }: AdminProps) {
    const { t, language } = useLanguage();
    const [query, setQuery] = useState(""), [rarity, setRarity] = useState("all"), [page, setPage] = useState(1), [editing, setEditing] = useState<Skin | null>(null), [price, setPrice] = useState(0);
    const rows = data.skins.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) &&
        (rarity === "all" || s.rarity === rarity));
    return (<>
      <div className="admin-toolbar">
        <div className="search-field">
          <Search size={16}/>
          <input aria-label={t("Поиск в каталоге скинов")} placeholder={t("Оружие или название скина")} value={query} onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
        }}/>
        </div>
        <select aria-label={t("Редкость скинов")} value={rarity} onChange={(e) => {
            setRarity(e.target.value);
            setPage(1);
        }}>
          <option value="all">{t("Все редкости")}</option>
          <option value="gold">{t("Ножи / перчатки")}</option>
          <option value="red">{t("Тайное")}</option>
          <option value="pink">{t("Засекреченное")}</option>
          <option value="purple">{t("Запрещённое")}</option>
          <option value="blue">{t("Армейское")}</option>
        </select>
        <span>{coins(rows.length)}{t("предметов")}</span>
      </div>
      <div className="skin-grid">
        {rows.slice(0, page * 60).map((s) => (<SkinCard skin={s} key={s.id} onClick={() => {
                setEditing(s);
                setPrice(s.price);
            }}/>))}
      </div>
      {rows.length > page * 60 && (<button className="secondary load-more" onClick={() => setPage((p) => p + 1)}>{t("Показать ещё 60")}</button>)}
      {editing && (<Modal title={editing.name} onClose={() => setEditing(null)}>
          <img className="skin-preview" src={editing.image} alt={editing.name}/>
          <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                    await save({
                        skinPrices: {
                            ...data.settings.skinPrices,
                            [editing.id]: price,
                        },
                    });
                    setEditing(null);
                }
                catch { }
            }}>
            <label className="form-field">{t("Цена в монетах")}<input type="number" step="0.01" min={0.01} max={100000000} value={price} onChange={(e) => setPrice(Number(e.target.value))} required/>
            </label>
            <p className="muted">{t("Новая цена применяется к будущим дропам и целям апгрейда. Предметы в инвентарях сохраняют стоимость при получении.")}</p>
            <button className="primary wide" disabled={busy}>{t("СОХРАНИТЬ ЦЕНУ")}</button>
          </form>
        </Modal>)}
    </>);
}
function PromoManagement({ data, busy, save }: AdminProps) {
    const { t, language } = useLanguage();
    const [code, setCode] = useState(""), [amount, setAmount] = useState(500);
    return (<>
      <form className="panel promo-create" onSubmit={async (e) => {
            e.preventDefault();
            try {
                await save({
                    promos: [
                        ...data.settings.promos,
                        { code: code.toUpperCase().trim(), amount, enabled: true },
                    ],
                });
                setCode("");
            }
            catch { }
        }}>
        <label className="form-field">{t("Промокод")}<input value={code} minLength={2} maxLength={32} onChange={(e) => setCode(e.target.value.toUpperCase())} required/>
        </label>
        <label className="form-field">{t("Награда, монеты")}<input type="number" min={1} max={10000000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required/>
        </label>
        <button className="primary" disabled={busy || data.settings.promos.some((p) => p.code === code.trim())}>
          <Plus size={16}/>{t("СОЗДАТЬ")}</button>
      </form>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>{t("Промокод")}</th>
              <th>{t("Награда")}</th>
              <th>{t("Использован")}</th>
              <th>{t("Статус")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.settings.promos.map((p, index) => (<tr key={`${p.code}-${index}`}>
                <td>
                  <strong>{p.code}</strong>
                </td>
                <td className="orange">+{coins(p.amount)} ◉</td>
                <td>
                  {data.users.filter((u) => u.state.promoCodes.includes(p.code)).length}
                </td>
                <td>
                  <span className={`badge ${p.enabled ? "green" : "red"}`}>
                    {p.enabled ? t("Активен") : t("Отключён")}
                  </span>
                </td>
                <td>
                  <button className="secondary" disabled={busy} onClick={() => void save({
                promos: data.settings.promos.map((promo, i) => i === index
                    ? { ...promo, enabled: !promo.enabled }
                    : promo),
            }).catch(() => { })}>
                    {p.enabled ? t("Отключить") : t("Включить")}
                  </button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <p className="muted">{t("Каждый промокод можно активировать один раз на аккаунт.")}</p>
    </>);
}
function Economy({ data, busy, save }: AdminProps) {
    const { t, language } = useLanguage();
    const [settings, setSettings] = useState(data.settings);
    useEffect(() => setSettings(data.settings), [data.settings]);
    const fields: {
        key: keyof Settings;
        label: string;
        min: number;
        max: number;
        step?: number | "any";
    }[] = [
        {
            key: "startingBalance",
            label: t("Баланс нового пользователя"),
            min: 0,
            max: 10000000,
        },
        { key: "dailyBonus", label: t("Ежедневный бонус"), min: 0, max: 10000000 },
        { key: "farmReward", label: t("Награда фармилки"), min: 0, max: 10000000 },
        {
            key: "farmCooldown",
            label: t("Таймер фармилки, секунд"),
            min: 10,
            max: 86400,
        },
        { key: "upgradeFee", label: t("Комиссия апгрейда, %"), min: 0, max: 50 },
        {
            key: "contractMin",
            label: t("Минимальный множитель контракта"),
            min: 0.1,
            max: 10,
            step: "any",
        },
        {
            key: "contractMax",
            label: t("Максимальный множитель контракта"),
            min: 0.1,
            max: 10,
            step: "any",
        },
    ];
    return (<form onSubmit={(e) => {
            e.preventDefault();
            const patch = Object.fromEntries([
                ...fields.map((f) => [f.key, settings[f.key]]),
                ["announcement", settings.announcement],
                ["maintenance", settings.maintenance],
            ]);
            void save(patch).catch(() => { });
        }}>
      <div className="admin-form-grid">
        <div className="panel">
          <h2>{t("ЭКОНОМИКА ИГРЫ")}</h2>
          {fields.map((f) => (<label className="form-field horizontal" key={f.key}>
              {f.label}
              <input type="number" min={f.min} max={f.max} step={f.step ?? 1} value={settings[f.key] as number} onChange={(e) => setSettings({ ...settings, [f.key]: Number(e.target.value) })} required/>
            </label>))}
        </div>
        <div className="panel">
          <h2>{t("НАСТРОЙКИ САЙТА")}</h2>
          <label className="form-field">{t("Объявление для игроков")}<textarea rows={4} maxLength={300} value={settings.announcement} placeholder={t("Появится над игровыми разделами")} onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}/>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={settings.maintenance} onChange={(e) => setSettings({ ...settings, maintenance: e.target.checked })}/>{t("Техническое обслуживание")}</label>
          <p className="muted">{t("Игроки смогут смотреть инвентарь, но игровые действия будут недоступны.")}</p>
          <div className="security-note">
            <Shield size={24}/>
            <div>
              <strong>{t("Доступ и журнал")}</strong>
              <p>{t("Админка проверяет сессию на сервере. Все изменения баланса, кейсов и вероятностей записываются в журнал.")}</p>
            </div>
          </div>
        </div>
      </div>
      <button className="primary save-settings" disabled={busy}>
        <Save size={17}/>{t("СОХРАНИТЬ НАСТРОЙКИ")}</button>
    </form>);
}
function TicketManagement({ data, busy, request }: AdminProps) {
    const { t, language } = useLanguage();
    const [filter, setFilter] = useState("open"), [editing, setEditing] = useState<any>(null), [reply, setReply] = useState("");
    const rows = data.tickets.filter((t) => filter === "all" || t.status === filter);
    return (<>
      <div className="admin-toolbar">
        <select aria-label={t("Статус обращений")} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">{t("Открытые")}</option>
          <option value="closed">{t("Закрытые")}</option>
          <option value="all">{t("Все обращения")}</option>
        </select>
        <span>{rows.length}{t("обращений")}</span>
      </div>
      {rows.length ? (<div className="table-wrap panel">
          <table>
            <thead>
              <tr>
                <th>{t("Дата")}</th>
                <th>{t("Игрок")}</th>
                <th>{t("Тема")}</th>
                <th>{t("Статус")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (<tr key={t.id}>
                  <td>{new Date(t.created).toLocaleString("ru-RU")}</td>
                  <td>
                    {data.users.find((u) => u.id === t.user_id)?.name ??
                    t.user_id.slice(0, 8)}
                  </td>
                  <td>{t.subject}</td>
                  <td>{t.status === "open" ? t("Открыто") : t("Закрыто")}</td>
                  <td>
                    <button className="secondary" onClick={() => {
                    setEditing(t);
                    setReply(t.reply);
                }}>{t("Ответить")}</button>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>) : (<Empty title={t("Обращений нет")} description={t("Здесь появятся сообщения игроков.")}/>)}
      {editing && (<Modal title={editing.subject} onClose={() => setEditing(null)}>
          <p className="ticket-message">{editing.message}</p>
          <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                    await request("admin/ticket", {
                        id: editing.id,
                        reply,
                        status: "closed",
                    });
                    setEditing(null);
                }
                catch { }
            }}>
            <label className="form-field">{t("Ответ")}<textarea rows={5} minLength={1} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} required/>
            </label>
            <button className="primary wide" disabled={busy}>{t("ОТВЕТИТЬ И ЗАКРЫТЬ")}</button>
          </form>
        </Modal>)}
    </>);
}
function AuditTable({ rows }: {
    rows: any[];
}) {
    const { t, language } = useLanguage();
    return rows.length ? (<div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("Дата")}</th>
            <th>{t("Администратор")}</th>
            <th>{t("Действие")}</th>
            <th>{t("Детали")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (<tr key={row.id}>
              <td>{new Date(row.created).toLocaleString("ru-RU")}</td>
              <td>{row.actor}</td>
              <td>{row.action}</td>
              <td>
                <details>
                  <summary>{t("Показать")}</summary>
                  <pre>{JSON.stringify(JSON.parse(row.details), null, 2)}</pre>
                </details>
              </td>
            </tr>))}
        </tbody>
      </table>
    </div>) : (<p className="muted">{t("Журнал пока пуст")}</p>);
}
function AuditLog({ data }: {
    data: AdminData;
}) {
    const { t, language } = useLanguage();
    const [query, setQuery] = useState("");
    return (<>
      <div className="admin-toolbar">
        <div className="search-field">
          <Search size={16}/>
          <input placeholder={t("Поиск действия или пользователя")} aria-label={t("Поиск в журнале")} value={query} onChange={(e) => setQuery(e.target.value)}/>
        </div>
        <span>{t("Последние 200 действий")}</span>
      </div>
      <div className="panel">
        <AuditTable rows={data.logs.filter((l) => `${l.action} ${l.details}`
            .toLowerCase()
            .includes(query.toLowerCase()))}/>
      </div>
    </>);
}
