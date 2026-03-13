import type { FC } from "react";

import CategoriesList from "./CategoriesList";
import { useCategoriesView } from "../hooks/useCategoriesView";

const CategoriesView: FC = () => {
  const { viewModel, refetch } = useCategoriesView();
  const { categories, isLoading, isError, errorMessage } = viewModel;

  return (
    <section aria-label="Słownik kategorii" aria-busy={isLoading}>
      {isLoading && (
        <div className="space-y-3" aria-live="polite" role="status">
          <p className="text-sm text-muted-foreground">Trwa ładowanie kategorii...</p>
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-5/6 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      )}

      {!isLoading && isError && (
        <div className="space-y-3" aria-live="polite" role="status">
          <p className="text-sm font-medium text-foreground">{errorMessage ?? "Nie udało się załadować kategorii."}</p>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {!isLoading && !isError && <CategoriesList categories={categories} showCode />}
    </section>
  );
};

export default CategoriesView;
