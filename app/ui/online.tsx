"use client";
import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { api, coins } from "./shared";
import { useLanguage } from "./language";

export function OnlineCounter({ playerId }: { playerId: string }) {
  const { t } = useLanguage();
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    let pending = false;
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await api<{ online: number }>("online", {});
        if (mounted) setOnline(response.online);
      } catch { /* The next heartbeat retries a temporary connection failure. */ }
      finally { pending = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [playerId]);
  return <div className="online-counter" title={t("Пользователей онлайн")}>
    <UsersRound aria-hidden="true" size={18}/>
    <strong key={online} aria-live="polite">{online === null ? "…" : coins(online)}</strong>
    <span>{t("Пользователей онлайн")}</span>
  </div>;
}
