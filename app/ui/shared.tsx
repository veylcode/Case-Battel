"use client";
import { useLanguage, localizeSkin } from "./language";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Lock, Check, Box } from "lucide-react";
import { rarityColors } from "../domain/rules";
import type { Skin, Case, Item } from "../domain/types";
export const coins = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
export const saleCoins = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json()) as {
        error?: string;
    } & T;
    if (!response.ok)
        throw new Error(data.error ?? "Не удалось выполнить действие");
    return data as T;
}
export function CaseArt({ box, className = "", }: {
    box: Case;
    className?: string;
}) {
    const { t, language } = useLanguage();
    return (<div className={`case-art ${className}`} style={{ "--case-color": box.color ?? "#46c3e1" } as React.CSSProperties}>
      {box.imageBack && (<img src={box.imageBack} alt="" className="case-back" loading="lazy"/>)}
      <img src={box.image} alt={box.name} className="case-front" loading="lazy"/>
    </div>);
}
export function SkinCard({ skin, item, selected, onClick, onLock, showChance, roundPrice = false, actions, }: {
    skin: Skin;
    item?: Item;
    selected?: boolean;
    onClick?: () => void;
    onLock?: () => void;
    showChance?: number;
    roundPrice?: boolean;
    actions?: ReactNode;
}) {
    const { t, language } = useLanguage();
    skin = localizeSkin(skin, language);
    return (<div className={`skin-card ${selected ? "selected" : ""}`} style={{
            "--rarity": skin.rarityColor ?? rarityColors[skin.rarity],
        } as React.CSSProperties}>
      <button className="skin-main" onClick={onClick} type="button" disabled={!onClick} aria-label={t(`${skin.name}, ${coins(item?.price ?? skin.price)} монет`)}>
        <span className="skin-price">
          {roundPrice ? coins(Math.round(item?.price ?? skin.price)) : saleCoins(item?.price ?? skin.price)} <span>©</span>
        </span>
        <img src={skin.image} alt={skin.name} loading="lazy"/>
        <span className="weapon-name">{skin.name.startsWith("StatTrak") ? "StatTrak™ " : skin.name.startsWith("Souvenir") ? "Souvenir " : ""}{skin.weapon}</span>
        <strong>{skin.skin}</strong>
        {selected && <Check className="selected-check" size={15}/>}{" "}
        {showChance !== undefined && (<span className="skin-chance">{showChance.toFixed(2)}%</span>)}
      </button>
      {actions && <div className="item-actions">{actions}</div>}
      {item && onLock && (<button className={`lock-button ${item.locked ? "locked" : ""}`} onClick={onLock} aria-label={item.locked ? t("Разблокировать предмет") : t("Заблокировать предмет")}>
          <Lock size={13}/>
        </button>)}
    </div>);
}
export function Modal({ title, children, onClose, }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const { t, language } = useLanguage();
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);
    return (<dialog ref={ref} className="modal" onCancel={onClose} onClick={(e) => {
            if (e.target === e.currentTarget)
                onClose();
        }}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button onClick={onClose} className="icon-button" aria-label={t("Закрыть")}>
          <X />
        </button>
      </div>
      {children}
    </dialog>);
}
export function Empty({ title, description, action, }: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    const { t, language } = useLanguage();
    return (<div className="empty">
      <Box size={42}/>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>);
}
let audio: AudioContext | null = null;
const audioBuffers = new Map<string, Promise<AudioBuffer>>();
const audioFiles = { tick: "step", win: "finish", start: "start", coins: "coins", success: "applause", loss: "finish" };
export function sound(kind: keyof typeof audioFiles, enabled: boolean) {
    if (!enabled)
        return;
    try {
        audio ??= new AudioContext();
        if (audio.state === "suspended")
            void audio.resume();
        const context = audio;
        const file = audioFiles[kind];
        if (!audioBuffers.has(file))
            audioBuffers.set(file, fetch(`/reference/audio/${file}.m4a`)
                .then(response => { if (!response.ok)
                throw new Error("Audio unavailable"); return response.arrayBuffer(); })
                .then(bytes => context.decodeAudioData(bytes)));
        void audioBuffers.get(file)!.then(buffer => {
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start();
        }).catch(() => { audioBuffers.delete(file); });
    }
    catch {
        /* Audio may be unavailable in embedded browsers. */
    }
}
