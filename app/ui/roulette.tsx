"use client";
import { useEffect, useRef, useState } from "react";
import type { Skin } from "../domain/types";
import { saleCoins, sound } from "./shared";
import { useLanguage, localizeSkin } from "./language";

export function NeonRing() {
  return (
    <div className="neon-ring" aria-hidden="true">
      <img className="ring-core" src="/reference/ui/csgo-man-circle-125.png" alt="" />
      <img className="ring-motion" src="/reference/ui/case-circle-265.png" alt="" />
    </div>
  );
}
export function Roulette({
  pool,
  winner,
  duration,
  audio,
  onFinish,
  onSell,
  sold,
}: {
  pool: Skin[];
  winner: Skin;
  duration: number;
  audio: boolean;
  onFinish: () => void;
  onSell?: () => void;
  sold?: boolean;
}) {
  const { t, language } = useLanguage();
  const container = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const [done, setDone] = useState(false);
  const [reel] = useState(() =>
    Array.from({ length: 68 }, (_, i) =>
      i === 58 ? winner : pool[Math.floor(Math.random() * pool.length)],
    ),
  );
  useEffect(() => {
    const element = track.current,
      viewport = container.current;
    if (!element || !viewport) return;
    const width = 110,
      center = viewport.clientWidth / 2;
    const end = center - (58 * width + width / 2);
    if (duration > 0) sound("start", audio);
    const animation = element.animate(
      [
        { transform: `translateX(${center - 3 * width}px)` },
        { transform: `translateX(${end}px)` },
      ],
      { duration, easing: "cubic-bezier(.08,.62,.08,1)", fill: "forwards" },
    );
    let frame = 0,
      last = 0;
    const tick = () => {
      const x = new DOMMatrixReadOnly(getComputedStyle(element).transform).m41;
      const index = Math.floor(Math.abs(x) / width);
      if (index !== last) {
        last = index;
        sound("tick", audio);
      }
      if (animation.playState === "running")
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    animation.onfinish = () => {
      setDone(true);
      sound("win", audio);
      finishRef.current();
    };
    return () => {
      cancelAnimationFrame(frame);
      animation.cancel();
    };
  }, [duration, audio]);
  return (
    <div
      className={`roulette ${done ? "finished" : ""}`}
      ref={container}
      aria-label={done ? t(`Выпал ${localizeSkin(winner, language).name}`) : t("Рулетка вращается")}
    >
      <div className="roulette-track" ref={track}>
        {reel.map((entry, i) => {
          const skin = localizeSkin(entry, language);
          return (
          <div className={`reel-item ${i === 58 ? "winner" : ""}`} key={i}>
            <img src={skin.image} alt={skin.name} />
            <small>{skin.weapon}</small>
            <strong>{skin.skin}</strong>
          </div>
        ); })}
      </div>
      <div className="roulette-focus">
        <NeonRing />
      </div>
      {done && onSell && <button className="outlined reel-sell" disabled={sold} onClick={onSell}>
        <img src="/reference/ui/coins-64.png" alt="" />
        {sold ? t("ПРОДАНО") : t(`ПРОДАТЬ ЗА ${saleCoins(winner.price)} ©`)}
      </button>}
    </div>
  );
}
