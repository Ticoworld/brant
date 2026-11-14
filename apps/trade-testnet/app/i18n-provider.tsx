"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { t, type Locale, type MessageKey } from "./i18n";

const STORAGE_KEY = "roveko-locale";
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => undefined });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh-CN") setLocaleState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale(next: Locale) {
        localStorage.setItem(STORAGE_KEY, next);
        setLocaleState(next);
      },
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  return { ...context, t: (key: MessageKey) => t(context.locale, key) };
}

export function LanguageSwitcher() {
  const { locale, setLocale, t: text } = useLocale();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
      <span className="sr-only">{text("language")}</span>
      <select
        aria-label={text("language")}
        className="rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-100"
        style={{ width: "auto" }}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value="en">{text("english")}</option>
        <option value="zh-CN">{text("chineseSimplified")}</option>
      </select>
    </label>
  );
}
