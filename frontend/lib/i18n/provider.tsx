"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { defaultLocale, dictionaries, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";

type I18nContextValue = {
  dict: Dictionary;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const storageKey = "zeta-signals-locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const pathname = usePathname();

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(storageKey);
    if (storedLocale === "pl" || storedLocale === "en") {
      setLocaleState(storedLocale);
    }
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/en/")) {
      setLocaleState("en");
      return;
    }

    if (pathname.startsWith("/pl/")) {
      setLocaleState("pl");
    }
  }, [pathname]);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(storageKey, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      dict: dictionaries[locale],
      locale,
      setLocale,
      toggleLocale: () => setLocaleState((current) => (current === "pl" ? "en" : "pl"))
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
