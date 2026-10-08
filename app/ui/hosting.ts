type Hosting = { apiOrigin: string; basePath: string };
declare global { interface Window { CASE_BATTLE_HOSTING?: Hosting; } }
const hosting = typeof window === "undefined" ? undefined : window.CASE_BATTLE_HOSTING;
export const apiOrigin = hosting?.apiOrigin ?? "";
export const basePath = hosting?.basePath ?? "/";
export function hostedImages<T>(data: T): T {
  if (!hosting) return data;
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["image", "imageBack", "avatar"].includes(key) && typeof child === "string" && child.startsWith("/") && !child.startsWith("//")) {
        (value as Record<string, unknown>)[key] = child.startsWith("/api/") ? apiOrigin + child : basePath + child.slice(1);
      } else visit(child);
    }
  }
  visit(data);
  return data;
}
