export type AppLocale = "pl" | "en";

const LOCALE_STORAGE_KEY = "preferred_locale";

export function normalizeAppLocale(raw: string | null | undefined): AppLocale | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "pl") return "pl";
  if (v === "en") return "en";
  return undefined;
}

export function getStoredAppLocale(): AppLocale | undefined {
  if (typeof window === "undefined") return undefined;
  return normalizeAppLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function setStoredAppLocale(locale: AppLocale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function getClientAppLocaleFallback(): AppLocale {
  if (typeof document !== "undefined") {
    const fromHtml = normalizeAppLocale(document.documentElement.lang);
    if (fromHtml) return fromHtml;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
  }
  return "en";
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export async function fetchProfilePreferredLocale(): Promise<AppLocale | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    const response = await fetch("/api/profile", { method: "GET", headers: { Accept: "application/json" } });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { preferred_locale?: string } | null;
    return normalizeAppLocale(payload?.preferred_locale);
  } catch {
    return undefined;
  }
}

export function broadcastLocaleChange(locale: AppLocale) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app:localechange", { detail: { locale } }));
}
