import { useCallback, useEffect, useState } from "react";

import type { CategoryDto, CategoriesViewViewModel } from "../../types";

import {
  applyDocumentLocale,
  fetchProfilePreferredLocale,
  getClientAppLocaleFallback,
  getStoredAppLocale,
  setStoredAppLocale,
  type AppLocale,
} from "../../lib/locale";

const initialViewModel: CategoriesViewViewModel = {
  categories: [],
  isLoading: true,
  isError: false,
  errorMessage: undefined,
};

export function useCategoriesView() {
  const [viewModel, setViewModel] = useState<CategoriesViewViewModel>(initialViewModel);
  const [locale, setLocale] = useState<AppLocale>(() => getStoredAppLocale() ?? getClientAppLocaleFallback());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<{ locale?: AppLocale }>).detail?.locale;
      if (!next) return;
      setLocale(next);
    };

    window.addEventListener("app:localechange", onLocaleChange as EventListener);
    return () => window.removeEventListener("app:localechange", onLocaleChange as EventListener);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const fromProfile = await fetchProfilePreferredLocale();
      if (!mounted || !fromProfile) return;
      setStoredAppLocale(fromProfile);
      applyDocumentLocale(fromProfile);
      setLocale(fromProfile);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadCategories = useCallback(async () => {
    if (typeof window === "undefined") return;

    setViewModel((prev) => ({
      ...prev,
      isLoading: true,
      isError: false,
      errorMessage: undefined,
    }));

    try {
      const response = await fetch(`/api/categories?locale=${locale}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        setViewModel((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMessage: "Nie udało się załadować kategorii. Spróbuj ponownie.",
        }));
        return;
      }

      const payload = (await response.json()) as { data?: CategoryDto[] } | null;
      if (!payload || !Array.isArray(payload.data)) {
        setViewModel((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMessage: "Otrzymano nieprawidłową odpowiedź z serwera.",
        }));
        return;
      }

      setViewModel({
        categories: payload.data,
        isLoading: false,
        isError: false,
        errorMessage: undefined,
      });
    } catch {
      setViewModel((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        errorMessage: "Wystąpił błąd połączenia. Sprawdź sieć i spróbuj ponownie.",
      }));
    }
  }, [locale]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const refetch = useCallback(() => {
    void loadCategories();
  }, [loadCategories]);

  return {
    viewModel,
    refetch,
  };
}
