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
    <label className="inline-flex items-center text-xs text-[#a6aca9]">
      <span className="sr-only">{text("language")}</span>
      <select
        aria-label={text("language")}
        className="!min-h-8 !rounded-none !border-0 !border-l !border-[#303533] !bg-[#090a0a] !px-2 !py-1 text-xs text-[#d7dbd9] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#858c88]"
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
