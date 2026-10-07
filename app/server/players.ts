import type {
  Player,
  PlayerState,
  Settings,
  HistoryEntry,
  Item,
} from "../domain/types";
import { defaults, configuredSkins } from "../domain/catalog";
import { money } from "../domain/rules";
import { database, ApiError } from "./security";

type UserRow = {
  id: string;
  name: string;
  login: string | null;
  state: string;
  version: number;
  banned: number;
  created: number;
  password?: string;
  avatar_updated?: number;
};
export async function getSettings(): Promise<Settings> {
  const row = await database()
    .prepare("SELECT value FROM settings WHERE key='game'")
    .first<{ value: string }>();
  return row
    ? { ...defaults, ...JSON.parse(row.value) }
    : structuredClone(defaults);
}
export function initialState(balance: number): PlayerState {
  return {
    balance,
    inventory: [],
    history: [],
    opened: 0,
    upgrades: 0,
    contracts: 0,
    battles: 0,
    earned: 0,
    spent: 0,
    bonusAt: 0,
    farmAt: 0,
    promoCodes: [],
    achievements: [],
    bestDrop: null,
  };
}
export async function getPlayer(id: string): Promise<Player> {
  const row = await database()
    .prepare("SELECT users.*, avatars.updated AS avatar_updated FROM users LEFT JOIN avatars ON avatars.user_id=users.id WHERE users.id=?")
    .bind(id)
    .first<UserRow>();
  if (!row) throw new ApiError("Аккаунт не найден", 401);
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar_updated ? `/api/avatar/${row.id}?v=${row.avatar_updated}` : undefined,
    registered: !!row.login,
    banned: !!row.banned,
    created: row.created,
    version: row.version,
    state: JSON.parse(row.state),
  };
}
export async function createPlayer(settings: Settings): Promise<Player> {
  const id = crypto.randomUUID();
  await database()
    .prepare("INSERT INTO users (id,name,state,created) VALUES (?,?,?,?)")
    .bind(
      id,
      `Игрок ${id.slice(0, 4).toUpperCase()}`,
      JSON.stringify(initialState(settings.startingBalance)),
      Date.now(),
    )
    .run();
  return getPlayer(id);
}
export async function mutatePlayer<T>(
  id: string,
  change: (state: PlayerState) => T,
  allowBanned = false,
): Promise<{ player: Player; result: T }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const player = await getPlayer(id);
    if (player.banned && !allowBanned)
      throw new ApiError("Аккаунт заблокирован", 403);
    const result = change(player.state);
    player.state.balance = money(player.state.balance);
    player.state.earned = money(player.state.earned);
    player.state.spent = money(player.state.spent);
    if (
      !Number.isFinite(player.state.balance) ||
      player.state.balance < 0 ||
      player.state.balance > 1e12
    )
      throw new ApiError("Недостаточно монет или превышен лимит баланса");
    player.state.history = player.state.history.slice(0, 200);
    const update = await database()
      .prepare(
        "UPDATE users SET state=?,version=version+1 WHERE id=? AND version=?",
      )
      .bind(JSON.stringify(player.state), id, player.version)
      .run();
    if (update.meta.changes) {
      player.version = (player.version ?? 0) + 1;
      return { player, result };
    }
  }
  throw new ApiError("Аккаунт обновился. Повторите действие", 409);
}
export function history(
  state: PlayerState,
  type: string,
  label: string,
  change: number,
  items?: string[],
) {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    type,
    label,
    change: money(change),
    time: Date.now(),
    items,
  };
  state.history.unshift(entry);
}
export function addItem(
  state: PlayerState,
  skinId: string,
  price: number,
): Item {
  if (state.inventory.length >= 2000)
    throw new ApiError("Инвентарь заполнен. Продайте часть предметов");
  const item = {
    uid: crypto.randomUUID(),
    skinId,
    price,
    locked: false,
    acquired: Date.now(),
  };
  state.inventory.unshift(item);
  return item;
}
export function takeItems(
  state: PlayerState,
  ids: unknown,
  min: number,
  max: number,
) {
  if (
    !Array.isArray(ids) ||
    ids.length < min ||
    ids.length > max ||
    new Set(ids).size !== ids.length
  )
    throw new ApiError(`Выберите от ${min} до ${max} разных предметов`);
  const items = ids.map((id) => state.inventory.find((x) => x.uid === id));
  if (items.some((x) => !x || x.locked))
    throw new ApiError("Предмет отсутствует или заблокирован");
  state.inventory = state.inventory.filter((x) => !ids.includes(x.uid));
  return items as Item[];
}
export function achievements(state: PlayerState) {
  const unlocked = [
    state.opened >= 10 ? "open10" : "",
    state.opened >= 100 ? "open100" : "",
    state.upgrades >= 5 ? "upgrade5" : "",
    state.contracts >= 5 ? "contract5" : "",
    state.earned >= 10000 ? "profit10k" : "",
  ].filter(Boolean);
  state.achievements = Array.from(
    new Set([...state.achievements, ...unlocked]),
  );
}
export function bestDrop(state: PlayerState, settings: Settings) {
  const pool = configuredSkins(settings);
  state.bestDrop = state.inventory.reduce((best, item) => {
    const price = pool.find((x) => x.id === best)?.price ?? 0;
    return item.price > price ? item.skinId : best;
  }, state.bestDrop);
}
export async function audit(actor: string, action: string, details: unknown) {
  await database()
    .prepare(
      "INSERT INTO audit (id,actor,action,details,created) VALUES (?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      actor,
      action,
      JSON.stringify(details),
      Date.now(),
    )
    .run();
}
export async function allPlayers() {
  const rows = await database()
    .prepare(
      "SELECT id,name,login,state,banned,created,version FROM users ORDER BY created DESC LIMIT 500",
    )
    .all<UserRow>();
  return rows.results.map(
    (row) =>
      ({
        id: row.id,
        name: row.name,
        registered: !!row.login,
        banned: !!row.banned,
        created: row.created,
        version: row.version,
        state: JSON.parse(row.state),
      }) as Player,
  );
}
