import en from "@/locales/en.json";
import pl from "@/locales/pl.json";

export type Locale = "pl" | "en";
export type Dictionary = typeof pl;

export const defaultLocale: Locale = "pl";

export const dictionaries = {
  pl,
  en
} satisfies Record<Locale, Dictionary>;
