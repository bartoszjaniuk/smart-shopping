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
      className="inline-flex rounded-full border border-input bg-muted/60 p-0.5 text-xs"
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
            className={`inline-flex min-w-[80px] items-center justify-center rounded-full px-3 py-1 font-medium transition-colors ${
              isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
