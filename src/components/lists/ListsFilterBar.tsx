import type { FC } from "react";

import type { ListsFilter } from "../../types";

interface ListsFilterBarProps {
  value: ListsFilter;
  onChange: (next: ListsFilter) => void;
}

const FILTER_OPTIONS: { value: ListsFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "owned", label: "Moje" },
  { value: "shared", label: "Współdzielone" },
];

const ListsFilterBar: FC<ListsFilterBarProps> = ({ value, onChange }) => {
  return (
    <div
      className="inline-flex w-full max-w-md rounded-md border border-input bg-muted/60 p-1 text-sm md:w-auto md:text-xs"
      role="tablist"
      aria-label="Filtruj listy"
    >
      {FILTER_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md px-4 py-2 font-medium transition-colors md:min-h-[32px] md:flex-none md:px-3 md:py-1 ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default ListsFilterBar;
