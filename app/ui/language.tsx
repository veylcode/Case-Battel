"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import english from "../domain/interface-en.json";
import caseMetadata from "../domain/reference-case-metadata.json";
import type { Bootstrap, Case, Skin } from "../domain/types";

export type Language = "ru" | "en";
const dictionary = english as Record<string, string>;
const fragments = Object.keys(dictionary).sort((a, b) => b.length - a.length);
const LanguageContext = createContext({ language: "ru" as Language, setLanguage: (_: Language) => {}, t: (value: string) => value });

export function translate(value: string, language: Language) {
  if (language === "ru" || !/[а-яё]/i.test(value)) return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (dictionary[normalized]) return dictionary[normalized];
  let translated = value;
  for (const fragment of fragments) {
    if (fragment.length > 2 && translated.includes(fragment)) translated = translated.replaceAll(fragment, dictionary[fragment]);
  }
  return translated;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ru");
  useEffect(() => { if (localStorage.getItem("cb_language") === "en") setLanguage("en"); }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "ru" ? "CASE BATTLE • Кейсы, апгрейды и контракты" : "CASE BATTLE • Cases, upgrades and contracts";
  }, [language]);
  const change = (next: Language) => { localStorage.setItem("cb_language", next); setLanguage(next); };
  return <LanguageContext.Provider value={{ language, setLanguage: change, t: (value) => translate(value, language) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switch" aria-label="Language / Язык">
    <button type="button" aria-pressed={language === "ru"} onClick={() => setLanguage("ru")}>RU</button>
    <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
  </div>;
}

const originalSkins = new WeakMap<Skin, Skin>();
const wearNames: Record<string, string> = {
  "Factory New": "Прямо с завода", "Minimal Wear": "Немного поношенное",
  "Field-Tested": "После полевых испытаний", "Well-Worn": "Поношенное",
  "Battle-Scarred": "Закалённое в боях",
};
export function localizeSkin(skin: Skin, language: Language): Skin {
  const original = originalSkins.get(skin) ?? skin;
  if (language === "en" || !original.nameRu) return original;
  const prefix = original.name.startsWith("StatTrak") ? "StatTrak™ " : original.name.startsWith("Souvenir") ? "Сувенирный " : "";
  const name = (prefix + original.nameRu.replace(/^(?:(?:StatTrak™|Souvenir|Сувенирный)\s+)+/, ""))
    .replace(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, (_, wear: string) => `(${wearNames[wear]})`);
  const display = name.replace(/\s*\((?:Прямо с завода|Немного поношенное|После полевых испытаний|Поношенное|Закалённое в боях)\)$/, "");
  const parts = display.split(" | ");
  const localized = { ...original, name, weapon: parts[0].replace(/^StatTrak™\s*/, ""), skin: parts.slice(1).join(" | ") };
  originalSkins.set(localized, original);
  return localized;
}

const caseNames = new Map(caseMetadata.map((entry) => [entry.canonicalCaseId ?? entry.id, entry]));
export function caseName(box: Case, language: Language) {
  const names = caseNames.get(box.id);
  if (!names || (box.name !== names.nameRu && box.name !== names.nameEn)) return box.name;
  return language === "ru" ? names.nameRu : names.nameEn;
}
export function localizeBootstrap(data: Bootstrap, language: Language): Bootstrap {
  return { ...data, skins: data.skins.map((skin) => localizeSkin(skin, language)), cases: data.cases.map((box) => ({
    ...box, name: caseName(box, language),
    category: translate(box.category, language),
  })) };
}
