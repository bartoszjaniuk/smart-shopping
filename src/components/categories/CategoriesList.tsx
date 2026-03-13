import type { FC } from "react";

import type { CategoryDto } from "../../types";

interface CategoriesListProps {
  categories: CategoryDto[];
  showCode?: boolean;
}

const CategoriesList: FC<CategoriesListProps> = ({ categories, showCode = true }) => {
  if (!categories.length) {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Brak zdefiniowanych kategorii.
      </p>
    );
  }

  return (
    <section aria-label="Lista kategorii">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Kategorie produktów">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{category.name}</p>
              {showCode && (
                <p className="mt-0.5 text-xs text-muted-foreground" aria-label={`Kod kategorii ${category.code}`}>
                  Kod: <span className="font-mono text-[11px] uppercase tracking-wide">{category.code}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default CategoriesList;
