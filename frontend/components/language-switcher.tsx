"use client";

import { motion } from "framer-motion";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { dict, locale, setLocale } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-[#1A1A1A] bg-[rgba(255,255,255,0.03)] p-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted",
        className
      )}
      aria-label={dict.common.languageSwitcher}
    >
      {(["pl", "en"] as const).map((option) => {
        const isActive = locale === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={cn("relative rounded-full px-3 py-1.5 transition-colors", isActive ? "text-[#050505]" : "hover:text-brass")}
          >
            {isActive ? (
              <motion.span
                layoutId="language-switcher-active"
                className="absolute inset-0 rounded-full bg-brass"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10">{option.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
