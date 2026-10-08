import {
  configuredCases,
  configuredSkins,
  contents,
  chanceForUpgrade,
  publicContents,
  defaults,
} from "../../domain/catalog";
import type { Case, Settings, PlayerState, PlayerOdds, Rarity } from "../../domain/types";
import {
  database,
  session,
  createSession,
  assertOrigin,
  ApiError,
  integer,
  moneyValue,
  textValue,
  rateLimit,
  adminConfig,
  verifyPassword,
  hashPassword,
  cookie,
  digest,
} from "../../server/security";
import {
  getSettings,
  getPlayer,
  createPlayer,
  mutatePlayer,
  history,
  addItem,
  takeItems,
  achievements,
  bestDrop,
  audit,
  allPlayers,
} from "../../server/players";

export const dynamic = "force-dynamic";
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
function selectDrop(box: Case, settings: Settings, odds?: PlayerOdds) {
  const pool = contents(box, settings, odds);
  const total = pool.reduce((sum, x) => sum + x.weight, 0);
  let cursor = random() * total;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.skin;
  }
  return pool[pool.length - 1].skin;
}
function response(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\//, "");
    const post = request.method === "POST";
    if (post) assertOrigin(request);
    const body = (
      post
        ? await request.json().catch(() => {
            throw new ApiError("Некорректный запрос");
          })
        : {}
    ) as Record<string, any>;
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError("Некорректный запрос");
    if (path.startsWith("avatar/") && !post) {
      const stored = await database().prepare("SELECT image FROM avatars WHERE user_id=?")
        .bind(path.slice(7)).first<{ image: string }>();
      if (!stored) throw new ApiError("Аватар не найден", 404);
      const [prefix, encoded] = stored.image.split(",");
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      return new Response(bytes, { headers: { "Content-Type": prefix.slice(5, prefix.indexOf(";")), "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
    }
    const settings = await getSettings();
    const playerSession = await session(request);
    const adminSession = await session(request, "admin");
    if (path === "online") {
      const cutoff = Date.now() - 45000;
      if (post) {
        if (!playerSession) throw new ApiError("Обновите страницу или войдите в аккаунт", 401);
        await rateLimit(`presence:${playerSession.user_id}`, 30, 60000);
        await database().prepare("INSERT INTO presence (user_id,seen) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET seen=excluded.seen")
          .bind(playerSession.user_id, Date.now()).run();
        await database().prepare("DELETE FROM presence WHERE seen < ?").bind(cutoff).run();
      }
      const row = await database().prepare("SELECT COUNT(*) AS active FROM presence WHERE seen >= ?")
        .bind(cutoff).first<{ active: number }>();
      return response({ online: 5000 + (row?.active ?? 0), active: row?.active ?? 0 });
    }
    if (path === "profile/avatar" && post) {
      if (!playerSession) throw new ApiError("Войдите в аккаунт", 401);
      const player = await getPlayer(playerSession.user_id);
      if (player.banned) throw new ApiError("Аккаунт заблокирован", 403);
      const image = textValue(body.image, 20, 150000);
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
      if (!match) throw new ApiError("Выберите изображение PNG, JPEG или WebP");
      let signature: string;
      try { signature = atob(match[2]); } catch { throw new ApiError("Некорректное изображение"); }
      const valid = match[1] === "png" ? signature.startsWith("\x89PNG\r\n\x1a\n")
        : match[1] === "jpeg" ? signature.startsWith("\xff\xd8\xff")
        : signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP";
      if (!valid) throw new ApiError("Некорректное изображение");
      await database().prepare("INSERT INTO avatars (user_id,image,updated) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET image=excluded.image,updated=excluded.updated")
        .bind(player.id, image, Date.now()).run();
      return response({ player: await getPlayer(player.id) });
    }
    if (path === "bootstrap" && !post) {
      const player = playerSession
        ? await getPlayer(playerSession.user_id)
        : await createPlayer(settings);
      const leaders = await allPlayers();
      const feed = leaders
        .flatMap((p) =>
          p.state.history
            .filter((h) => h.type === "case")
            .flatMap((h) =>
              (h.items ?? []).map((skinId) => ({
                name: p.name,
                skinId,
                time: h.time,
              })),
            ),
        )
        .sort((a, b) => b.time - a.time)
        .slice(0, 30);
      return response(
        {
          player,
          cases: configuredCases(settings).filter((c) => c.enabled !== false),
          skins: configuredSkins(settings),
          settings: { ...settings, promos: [] },
          caseContents: publicContents(settings),
          feed,
        },
        200,
        playerSession
          ? {}
          : { "Set-Cookie": await createSession(player.id, "player", request) },
      );
    }
    if (path === "catalog" && !post) {
      const id = new URL(request.url).searchParams.get("case");
      const box = configuredCases(settings).find((c) => c.id === id);
      if (!box) throw new ApiError("Кейс не найден", 404);
      return response(contents(box, settings, playerSession ? (await getPlayer(playerSession.user_id)).state.odds : undefined));
    }
    if (path === "leaderboard" && !post) {
      return response(
        (await allPlayers())
          .filter((p) => !p.banned)
          .sort((a, b) => b.state.earned - a.state.earned)
          .slice(0, 50)
          .map((p) => ({
            id: p.id,
            name: p.name,
            opened: p.state.opened,
            earned: p.state.earned,
            balance: p.state.balance,
            bestDrop: p.state.bestDrop,
          })),
      );
    }
    if (path === "auth/login" && post) {
      await rateLimit(
        `login:${request.headers.get("cf-connecting-ip") ?? "local"}`,
      );
      const login = textValue(body.login, 3, 32).toLowerCase();
      const row = await database()
        .prepare("SELECT id,password FROM users WHERE login=?")
        .bind(login)
        .first<{ id: string; password: string }>();
      if (
        !row ||
        !(await verifyPassword(textValue(body.password, 8, 128), row.password))
      )
        throw new ApiError("Неверный логин или пароль", 401);
      const player = await getPlayer(row.id);
      if (player.banned) throw new ApiError("Аккаунт заблокирован", 403);
      return response({ player }, 200, {
        "Set-Cookie": await createSession(row.id, "player", request),
      });
    }
    if (path === "auth/register" && post) {
      if (!playerSession) throw new ApiError("Обновите страницу", 401);
      await rateLimit(
        `register:${request.headers.get("cf-connecting-ip") ?? "local"}`,
        10,
      );
      const login = textValue(body.login, 3, 32).toLowerCase();
      if (!/^[a-z0-9_]+$/.test(login))
        throw new ApiError("Логин: латинские буквы, цифры и _");
      const player = await getPlayer(playerSession.user_id);
      if (player.registered) throw new ApiError("Аккаунт уже зарегистрирован");
      const password = await hashPassword(textValue(body.password, 8, 128));
      try {
        await database()
          .prepare(
            "UPDATE users SET login=?,password=?,name=? WHERE id=? AND login IS NULL",
          )
          .bind(login, password, textValue(body.name, 2, 32), player.id)
          .run();
      } catch {
        throw new ApiError("Этот логин уже занят", 409);
      }
      return response({ player: await getPlayer(player.id) });
    }
    if (path === "auth/logout" && post) {
      const token = cookie(request, "cb_session");
      if (token)
        await database()
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await digest(token))
          .run();
      return response({ ok: true }, 200, {
        "Set-Cookie":
          "cb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    if (path === "admin/login" && post) {
      await rateLimit(
        `admin-login:${request.headers.get("cf-connecting-ip") ?? "local"}`,
        8,
      );
      const config = adminConfig();
      if (!config.hash)
        throw new ApiError("Доступ администратора ещё не настроен", 503);
      if (
        textValue(body.login) !== config.login ||
        !(await verifyPassword(textValue(body.password, 8, 128), config.hash))
      )
        throw new ApiError("Неверный логин или пароль", 401);
      await audit("admin", "login", {});
      return response({ ok: true }, 200, {
        "Set-Cookie": await createSession("admin", "admin", request),
      });
    }
    if (path === "admin/logout" && post) {
      const token = cookie(request, "cb_admin");
      if (token)
        await database()
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await digest(token))
          .run();
      return response({ ok: true }, 200, {
        "Set-Cookie": "cb_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    if (path.startsWith("admin/")) {
      if (!adminSession)
        throw new ApiError("Войдите в панель администратора", 401);
      if (path === "admin/bootstrap" && !post) {
        const [users, logs, tickets] = await Promise.all([
          allPlayers(),
          database()
            .prepare("SELECT * FROM audit ORDER BY created DESC LIMIT 200")
            .all(),
          database()
            .prepare("SELECT * FROM tickets ORDER BY created DESC LIMIT 200")
            .all(),
        ]);
        return response({
          users,
          logs: logs.results,
          tickets: tickets.results,
          settings,
          cases: configuredCases(settings),
          skins: configuredSkins(settings),
          caseContents: publicContents(settings),
        });
      }
      if (path === "admin/user" && post) {
        const id = textValue(body.id);
        const action = textValue(body.action);
        let changed;
        if (action === "balance") {
          const amount = moneyValue(body.amount, -100000000, 100000000);
          const mode = body.mode;
          if (!["add", "subtract", "set"].includes(mode))
            throw new ApiError("Неизвестный режим");
          changed = await mutatePlayer(
            id,
            (state) => {
              const before = state.balance;
              state.balance =
                mode === "set"
                  ? amount
                  : state.balance +
                    (mode === "subtract" ? -Math.abs(amount) : amount);
              history(
                state,
                "admin",
                textValue(body.reason, 3, 200),
                state.balance - before,
              );
              return { before, after: state.balance };
            },
            true,
          );
        } else if (action === "odds") {
          if (!body.odds || typeof body.odds !== "object" || !body.odds.rarityWeights)
            throw new ApiError("Некорректные настройки шансов");
          const odds: PlayerOdds = {
            caseLuck: moneyValue(body.odds.caseLuck, .1, 10),
            upgradeBonus: moneyValue(body.odds.upgradeBonus, -100, 100),
            rarityWeights: {} as Record<Rarity, number>,
          };
          for (const rarity of ["blue", "purple", "pink", "red", "gold"] as const)
            odds.rarityWeights[rarity] = moneyValue(body.odds.rarityWeights[rarity], .01, 100);
          changed = await mutatePlayer(id, state => { state.odds = odds; return odds; }, true);
        } else if (action === "ban") {
          if (typeof body.banned !== "boolean")
            throw new ApiError("Некорректный статус");
          await database()
            .prepare("UPDATE users SET banned=?,version=version+1 WHERE id=?")
            .bind(body.banned ? 1 : 0, id)
            .run();
        } else if (action === "give") {
          const skin = configuredSkins(settings).find(
            (s) => s.id === body.skinId,
          );
          if (!skin) throw new ApiError("Предмет не найден");
          changed = await mutatePlayer(
            id,
            (state) => {
              addItem(state, skin.id, skin.price);
              history(state, "admin", `Выдан предмет: ${skin.name}`, 0, [
                skin.id,
              ]);
              return skin.id;
            },
            true,
          );
        } else if (action === "name") {
          await database()
            .prepare("UPDATE users SET name=?,version=version+1 WHERE id=?")
            .bind(textValue(body.name, 2, 32), id)
            .run();
        } else throw new ApiError("Неизвестное действие");
        await audit("admin", `user.${action}`, {
          id,
          ...body,
          password: undefined,
          result: changed?.result,
        });
        return response({ player: await getPlayer(id) });
      }
      if (path === "admin/settings" && post) {
        const incoming = body.settings as Settings;
        if (!incoming || typeof incoming !== "object")
          throw new ApiError("Некорректные настройки");
        const valid: Settings = { ...settings };
        for (const key of [
          "startingBalance",
          "dailyBonus",
          "farmReward",
        ] as const)
          if (key in incoming) valid[key] = integer(incoming[key], 0, 10000000);
        if ("farmCooldown" in incoming)
          valid.farmCooldown = integer(incoming.farmCooldown, 10, 86400);
        if ("upgradeFee" in incoming)
          valid.upgradeFee = integer(incoming.upgradeFee, 0, 50);
        for (const key of ["contractMin", "contractMax"] as const)
          if (key in incoming) {
            const value = incoming[key];
            if (
              typeof value !== "number" ||
              !Number.isFinite(value) ||
              value < 0.1 ||
              value > 10
            )
              throw new ApiError("Множитель контракта: 0.1–10");
            valid[key] = value;
          }
        if (valid.contractMin > valid.contractMax)
          throw new ApiError("Минимум должен быть меньше максимума");
        if ("maintenance" in incoming)
          valid.maintenance = !!incoming.maintenance;
        if ("announcement" in incoming)
          valid.announcement =
            typeof incoming.announcement === "string"
              ? incoming.announcement.slice(0, 300)
              : "";
        if (incoming.promos) {
          if (!Array.isArray(incoming.promos) || incoming.promos.length > 100)
            throw new ApiError("Слишком много промокодов");
          valid.promos = incoming.promos.map((p) => ({
            code: textValue(p.code, 2, 32).toUpperCase(),
            amount: integer(p.amount, 1, 10000000),
            enabled: !!p.enabled,
          }));
        }
        if (incoming.skinPrices) {
          for (const [id, price] of Object.entries(incoming.skinPrices)) {
            if (!configuredSkins(settings).some((s) => s.id === id))
              throw new ApiError("Предмет не найден");
            moneyValue(price, 0.01, 100000000);
          }
          valid.skinPrices = incoming.skinPrices;
        }
        if (incoming.caseOverrides) {
          for (const [id, patch] of Object.entries(incoming.caseOverrides)) {
            if (patch.price !== undefined) moneyValue(patch.price, 0, 10000000);
            if (patch.name !== undefined) textValue(patch.name, 2, 80);
            if (patch.id && patch.id !== id)
              throw new ApiError("Идентификатор не совпадает");
          }
          valid.caseOverrides = incoming.caseOverrides;
        }
        if (incoming.odds) {
          for (const [id, odds] of Object.entries(incoming.odds)) {
            if (!configuredCases(valid).some((c) => c.id === id))
              throw new ApiError("Кейс не найден");
            if (!odds || typeof odds !== "object")
              throw new ApiError("Некорректные вероятности");
            for (const [skinId, weight] of Object.entries(odds)) {
              if (
                !configuredSkins(valid).some((s) => s.id === skinId) ||
                typeof weight !== "number" ||
                !Number.isFinite(weight) ||
                weight < 0 ||
                weight > 1000000
              )
                throw new ApiError("Вес выпадения: 0–1000000");
            }
            const box = configuredCases(valid).find((c) => c.id === id)!;
            if (
              contents(box, {
                ...valid,
                odds: { ...valid.odds, [id]: odds },
              }).some((x) => !Number.isFinite(x.chance))
            )
              throw new ApiError("Сумма весов должна быть больше нуля");
          }
          valid.odds = incoming.odds;
        }
        await database()
          .prepare(
            "INSERT INTO settings (key,value,version) VALUES ('game',?,1) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=version+1",
          )
          .bind(JSON.stringify(valid))
          .run();
        await audit("admin", "settings.update", {
          keys: Object.keys(incoming),
        });
        return response({ settings: valid });
      }
      if (path === "admin/ticket" && post) {
        await database()
          .prepare("UPDATE tickets SET reply=?,status=? WHERE id=?")
          .bind(
            textValue(body.reply, 1, 2000),
            body.status === "closed" ? "closed" : "open",
            textValue(body.id),
          )
          .run();
        await audit("admin", "ticket.reply", { id: body.id });
        return response({ ok: true });
      }
      throw new ApiError("Раздел не найден", 404);
    }
    if (!playerSession)
      throw new ApiError("Обновите страницу или войдите в аккаунт", 401);
    const playerId = playerSession.user_id;
    if (path === "player" && !post) return response({ player: await getPlayer(playerId) });
    if (path === "tickets" && !post)
      return response(
        (
          await database()
            .prepare(
              "SELECT * FROM tickets WHERE user_id=? ORDER BY created DESC LIMIT 50",
            )
            .bind(playerId)
            .all()
        ).results,
      );
    if (path === "tickets" && post) {
      await rateLimit(`ticket:${playerId}`, 5, 3600000);
      await database()
        .prepare(
          "INSERT INTO tickets (id,user_id,subject,message,created) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          playerId,
          textValue(body.subject, 3, 100),
          textValue(body.message, 10, 2000),
          Date.now(),
        )
        .run();
      return response({ ok: true });
    }
    if (settings.maintenance && !adminSession)
      throw new ApiError("Техническое обслуживание. Скоро вернёмся", 503);
    if (!post) throw new ApiError("Раздел не найден", 404);
    await rateLimit(`action:${playerId}`, 120, 60000);
    const outcome = await mutatePlayer(playerId, (state) => {
      if (path === "open") {
        const box = configuredCases(settings).find(
          (c) => c.id === body.caseId && c.enabled !== false,
        );
        if (!box) throw new ApiError("Кейс не найден", 404);
        const count = integer(body.count, 1, 10);
        const cost = box.price * count;
        if (state.balance < cost) throw new ApiError("Недостаточно монет");
        state.balance -= cost;
        state.spent += cost;
        state.opened += count;
        if (box.price === 0) {
          if (count !== 1)
            throw new ApiError("Бесплатный кейс можно открыть один раз");
          if (Date.now() - (state.freeAt ?? 0) < 86400000)
            throw new ApiError("Бесплатный кейс доступен раз в 24 часа");
          state.freeAt = Date.now();
        }
        const drops = Array.from({ length: count }, () => {
          const skin = selectDrop(box, settings, state.odds);
          return { skin, item: addItem(state, skin.id, skin.price) };
        });
        history(
          state,
          "case",
          `${box.name} ×${count}`,
          -cost,
          drops.map((d) => d.skin.id),
        );
        achievements(state);
        bestDrop(state, settings);
        return { drops };
      }
      if (path === "sell") {
        const sold = takeItems(state, body.ids, 1, 2000);
        const total = sold.reduce((sum, x) => sum + x.price, 0);
        state.balance += total;
        state.earned += total;
        history(
          state,
          "sell",
          `Продажа ${sold.length} предметов`,
          total,
          sold.map((x) => x.skinId),
        );
        achievements(state);
        return { total };
      }
      if (path === "lock") {
        const item = state.inventory.find((x) => x.uid === body.uid);
        if (!item) throw new ApiError("Предмет не найден");
        item.locked = !item.locked;
        return { locked: item.locked };
      }
      if (path === "upgrade") {
        const target = configuredSkins(settings).find(
          (s) => s.id === body.target,
        );
        if (!target) throw new ApiError("Выберите цель апгрейда");
        const extra = moneyValue(body.extra ?? 0, 0, 100000000);
        if (state.balance < extra) throw new ApiError("Недостаточно монет");
        const used = takeItems(state, body.ids, 1, 6);
        const value = used.reduce((sum, x) => sum + x.price, 0) + extra;
        if (target.price <= value)
          throw new ApiError("Цель должна быть дороже исходных предметов");
        state.balance -= extra;
        state.spent += extra;
        state.upgrades++;
        const chance = chanceForUpgrade(
          value,
          target.price,
          settings.upgradeFee,
          state.odds?.upgradeBonus,
        );
        const roll = random() * 100;
        const won = roll < chance;
        const item = won ? addItem(state, target.id, target.price) : null;
        history(
          state,
          "upgrade",
          `${won ? "Успех" : "Неудача"}: ${target.name}`,
          -extra,
          won ? [target.id] : used.map((x) => x.skinId),
        );
        achievements(state);
        bestDrop(state, settings);
        return { won, chance, roll, target, item };
      }
      if (path === "contract") {
        const used = takeItems(state, body.ids, 3, 10);
        const total = used.reduce((sum, x) => sum + x.price, 0);
        const value =
          total *
          (settings.contractMin +
            random() * (settings.contractMax - settings.contractMin));
        const pool = configuredSkins(settings)
          .filter(
            (s) =>
              s.price >= total * settings.contractMin &&
              s.price <= total * settings.contractMax,
          )
          .sort(
            (a, b) => Math.abs(a.price - value) - Math.abs(b.price - value),
          );
        if (!pool.length)
          throw new ApiError(
            "Нет предметов в диапазоне этого контракта. Выберите другой набор",
          );
        const skin = pool[0];
        const item = addItem(state, skin.id, skin.price);
        state.contracts++;
        history(state, "contract", `Контракт из ${used.length} предметов`, 0, [
          skin.id,
        ]);
        achievements(state);
        bestDrop(state, settings);
        return { skin, item, total };
      }
      if (path === "bonus") {
        if (Date.now() - state.bonusAt < 86400000)
          throw new ApiError("Бонус доступен раз в 24 часа");
        state.bonusAt = Date.now();
        state.balance += settings.dailyBonus;
        history(state, "bonus", "Ежедневный бонус", settings.dailyBonus);
        return { amount: settings.dailyBonus };
      }
      if (path === "farm/start") {
        state.farmHoldAt = Date.now();
        return { amount: 0 };
      }
      if (path === "farm/tick") {
        const now = Date.now();
        if (!state.farmHoldAt) throw new ApiError("Начните удержание");
        const elapsed = now - state.farmHoldAt;
        state.farmHoldAt = now;
        const amount = elapsed > 3000 ? 0 : Math.round(Math.min(elapsed, 1500) * settings.farmReward * .8 / 1000 * 100) / 100;
        state.balance += amount;
        if (body.stop) delete state.farmHoldAt;
        return { amount };
      }
      if (path === "farm") {
        if (Date.now() - state.farmAt < settings.farmCooldown * 1000)
          throw new ApiError("Дождитесь окончания таймера");
        state.farmAt = Date.now();
        state.balance += settings.farmReward;
        history(state, "farm", "Фармилка", settings.farmReward);
        return { amount: settings.farmReward };
      }
      if (path === "promo") {
        const code = textValue(body.code, 2, 32).toUpperCase();
        const promo = settings.promos.find((p) => p.code === code && p.enabled);
        if (!promo) throw new ApiError("Промокод не найден");
        if (state.promoCodes.includes(code))
          throw new ApiError("Промокод уже использован");
        state.promoCodes.push(code);
        state.balance += promo.amount;
        history(state, "promo", `Промокод ${code}`, promo.amount);
        return { amount: promo.amount };
      }
      if (path === "profile") {
        return { name: textValue(body.name, 2, 32) };
      }
      if (path === "battle") {
        const box = configuredCases(settings).find(
          (c) => c.id === body.caseId && c.enabled !== false,
        );
        if (!box) throw new ApiError("Выберите кейс");
        const rounds = integer(body.rounds, 1, 5);
        const cost = box.price * rounds;
        if (state.balance < cost) throw new ApiError("Недостаточно монет");
        const own = Array.from({ length: rounds }, () =>
          selectDrop(box, settings, state.odds),
        );
        const bot = Array.from({ length: rounds }, () =>
          selectDrop(box, settings),
        );
        const ownTotal = own.reduce((sum, s) => sum + s.price, 0),
          botTotal = bot.reduce((sum, s) => sum + s.price, 0);
        const won = ownTotal >= botTotal;
        state.balance -= cost;
        state.spent += cost;
        state.battles++;
        const awarded = won ? [...own, ...bot] : [];
        const items = awarded.map((s) => addItem(state, s.id, s.price));
        history(
          state,
          "battle",
          `Баттл с ботом: ${won ? "победа" : "поражение"}`,
          -cost,
          awarded.map((s) => s.id),
        );
        bestDrop(state, settings);
        return { own, bot, ownTotal, botTotal, won, items };
      }
      throw new ApiError("Действие не найдено", 404);
    });
    if (path === "profile") {
      await database()
        .prepare("UPDATE users SET name=? WHERE id=?")
        .bind((outcome.result as { name: string }).name, playerId)
        .run();
      outcome.player.name = (outcome.result as { name: string }).name;
    }
    return response(outcome);
  } catch (error) {
    if (error instanceof ApiError)
      return response({ error: error.message }, error.status);
    console.error(
      "API failure",
      error instanceof Error ? error.message : "unknown",
    );
    return response(
      { error: "Не удалось выполнить действие. Попробуйте ещё раз" },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
