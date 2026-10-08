import { env } from "cloudflare:workers";

export function database(): D1Database {
  const db = env.DB;
  if (!db) throw new Error("База данных не настроена");
  return db;
}
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hashPassword(password: string, salt = randomToken()) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `${salt}:${Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function verifyPassword(value: string, hash: string) {
  const actual = await hashPassword(value, hash.split(":")[0]);
  if (actual.length !== hash.length) return false;
  let difference = 0;
  for (let i = 0; i < hash.length; i++)
    difference |= hash.charCodeAt(i) ^ actual.charCodeAt(i);
  return difference === 0;
}
export function cookie(request: Request, name: string) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}
export async function session(request: Request, role = "player") {
  const frontend = (env as unknown as { FRONTEND_ORIGIN?: string }).FRONTEND_ORIGIN;
  const fromFrontend = frontend && request.headers.get("origin") === frontend;
  const token = (fromFrontend ? request.headers.get(role === "admin" ? "X-CB-Admin" : "X-CB-Player") : null)
    || cookie(request, role === "admin" ? "cb_admin" : "cb_session");
  if (!token) return null;
  return database()
    .prepare(
      "SELECT user_id FROM sessions WHERE token = ? AND role = ? AND expires > ?",
    )
    .bind(await digest(token), role, Date.now())
    .first<{ user_id: string }>();
}
export async function createSession(
  userId: string,
  role: string,
  request: Request,
) {
  const token = randomToken();
  const maxAge = role === "admin" ? 28800 : 2592000;
  await database()
    .prepare(
      "INSERT INTO sessions (token,user_id,role,expires) VALUES (?,?,?,?)",
    )
    .bind(await digest(token), userId, role, Date.now() + maxAge * 1000)
    .run();
  return `${role === "admin" ? "cb_admin" : "cb_session"}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== (env as unknown as { FRONTEND_ORIGIN?: string }).FRONTEND_ORIGIN)
    throw new ApiError("Запрос с другого сайта запрещён", 403);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function integer(value: unknown, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new ApiError(`Введите целое число от ${min} до ${max}`);
  return value;
}
export function moneyValue(value: unknown, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    Math.abs(Math.round(value * 100) - value * 100) > 0.0001
  )
    throw new ApiError(
      `Введите сумму от ${min} до ${max}, не больше двух знаков после запятой`,
    );
  return Math.round(value * 100) / 100;
}
export function textValue(value: unknown, min = 1, max = 100) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new ApiError(`Длина текста: ${min}–${max} символов`);
  return value.trim();
}
export async function rateLimit(key: string, limit = 8, interval = 900000) {
  const now = Date.now();
  await database()
    .prepare(
      "INSERT INTO attempts (key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset < ? THEN 1 ELSE count + 1 END, reset = CASE WHEN reset < ? THEN ? ELSE reset END",
    )
    .bind(key, now + interval, now, now, now + interval)
    .run();
  const row = await database()
    .prepare("SELECT count FROM attempts WHERE key=?")
    .bind(key)
    .first<{ count: number }>();
  if (row && row.count > limit)
    throw new ApiError("Слишком много попыток. Попробуйте позже", 429);
}
export function adminConfig() {
  const configured = env as unknown as {
    ADMIN_HASH?: string;
    ADMIN_LOGIN?: string;
  };
  return {
    hash: configured.ADMIN_HASH,
    login: configured.ADMIN_LOGIN ?? "admin",
  };
}
