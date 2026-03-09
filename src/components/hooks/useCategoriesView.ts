import { useCallback, useEffect, useState } from "react";

import type { CategoryDto, CategoriesViewViewModel } from "../../types";

function getCategoryLocale(): "pl" | "en" {
  if (typeof navigator === "undefined" || !navigator.language) return "en";
  return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
}

const initialViewModel: CategoriesViewViewModel = {
  categories: [],
  isLoading: true,
  isError: false,
  errorMessage: undefined,
};

export function useCategoriesView() {
  const [viewModel, setViewModel] = useState<CategoriesViewViewModel>(initialViewModel);

  const loadCategories = useCallback(async () => {
    if (typeof window === "undefined") return;

    setViewModel((prev) => ({
      ...prev,
      isLoading: true,
      isError: false,
      errorMessage: undefined,
    }));

    const locale = getCategoryLocale();

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
  }, []);

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
