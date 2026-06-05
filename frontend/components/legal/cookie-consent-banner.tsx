"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { getLocalizedLegalLinks } from "@/lib/legal/constants";

type CookieConsent = {
  analytics: boolean;
  marketing: boolean;
  necessary: true;
  savedAt: string;
  source: "ACCEPT_ALL" | "REJECT_OPTIONAL" | "CUSTOM";
};

const storageKey = "zeta_cookie_consent";

export function CookieConsentBanner() {
  const { dict, locale } = useI18n();
  const legalLinks = getLocalizedLegalLinks(locale === "en" ? "EN" : "PL");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const copy = dict.legal.cookieBanner;

  useEffect(() => {
    const storedConsent = readStoredConsent();
    setConsent(storedConsent);
    setDraft({
      analytics: storedConsent?.analytics ?? false,
      marketing: storedConsent?.marketing ?? false
    });
    setHasLoaded(true);
  }, []);

  function saveConsent(nextConsent: CookieConsent) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextConsent));
    } catch {
      // LocalStorage may be blocked by browser settings; keep the UI decision for the current session.
    }
    setConsent(nextConsent);
    setDraft({
      analytics: nextConsent.analytics,
      marketing: nextConsent.marketing
    });
    setIsSettingsOpen(false);
  }

  function acceptAll() {
    saveConsent({
      analytics: true,
      marketing: true,
      necessary: true,
      savedAt: new Date().toISOString(),
      source: "ACCEPT_ALL"
    });
  }

  function rejectOptional() {
    saveConsent({
      analytics: false,
      marketing: false,
      necessary: true,
      savedAt: new Date().toISOString(),
      source: "REJECT_OPTIONAL"
    });
  }

  function saveCustom() {
    saveConsent({
      analytics: draft.analytics,
      marketing: draft.marketing,
      necessary: true,
      savedAt: new Date().toISOString(),
      source: "CUSTOM"
    });
  }

  if (!hasLoaded) {
    return null;
  }

  if (consent && !isSettingsOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full border border-[#1A1A1A] bg-[rgba(5,5,5,0.88)] px-4 py-2 text-xs text-muted shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur transition-colors hover:text-brass"
      >
        <Settings className="h-3.5 w-3.5" />
        {copy.changePreferences}
      </button>
    );
  }

  return (
    <section className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-5xl rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(5,5,5,0.94)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-brass">
            <Cookie className="h-4 w-4" />
            {copy.title}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            {copy.body} {copy.detailsPrefix}{" "}
            <Link href={legalLinks.cookie} className="text-brass transition-colors hover:text-[#e6c55a]">
              {dict.common.cookiePolicy}
            </Link>
            .
          </p>
          <p className="mt-2 text-xs leading-6 text-zinc-500">{copy.necessaryNotice}</p>

          {isSettingsOpen ? (
            <div className="mt-4 space-y-3 rounded-xl border border-[#1A1A1A] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-xs leading-6 text-muted">{copy.optionalDescription}</p>
              <CookieToggle checked label={copy.necessaryLabel} locked />
              <CookieToggle
                checked={draft.analytics}
                label={copy.analyticsLabel}
                onChange={(checked) => setDraft((current) => ({ ...current, analytics: checked }))}
              />
              <CookieToggle
                checked={draft.marketing}
                label={copy.marketingLabel}
                onChange={(checked) => setDraft((current) => ({ ...current, marketing: checked }))}
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
          {isSettingsOpen ? (
            <Button type="button" onClick={saveCustom}>
              {copy.save}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(true)}>
              {copy.settings}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={rejectOptional}>
            {copy.reject}
          </Button>
          <Button type="button" onClick={acceptAll}>
            {copy.accept}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CookieToggle({
  checked,
  label,
  locked = false,
  onChange
}: {
  checked: boolean;
  label: string;
  locked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm leading-6 text-muted">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 shrink-0 accent-[#D4AF37]"
        disabled={locked}
        onChange={(event) => onChange?.(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function readStoredConsent() {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<CookieConsent>;
    if (parsedValue.necessary !== true || typeof parsedValue.savedAt !== "string") {
      return null;
    }

    return {
      analytics: parsedValue.analytics === true,
      marketing: parsedValue.marketing === true,
      necessary: true,
      savedAt: parsedValue.savedAt,
      source: parsedValue.source === "ACCEPT_ALL" || parsedValue.source === "CUSTOM" ? parsedValue.source : "REJECT_OPTIONAL"
    } satisfies CookieConsent;
  } catch {
    return null;
  }
}
