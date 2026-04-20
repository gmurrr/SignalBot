export function formatPrice(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatSignedPips(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)} pips`;
}

export function formatRelativeTimestamp(timestamp?: string | null, locale: "pl" | "en" = "pl") {
  if (!timestamp) {
    return locale === "pl" ? "Oczekiwanie" : "Waiting";
  }

  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(date);
}
