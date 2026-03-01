import type { FC } from "react";

import type { ListSummaryDto } from "../../types";

interface ListCardProps {
  list: ListSummaryDto;
  onClick?: (id: string) => void;
}

const ListCard: FC<ListCardProps> = ({ list, onClick }) => {
  const handleClick = () => {
    if (list.is_disabled) {
      return;
    }
    if (onClick) {
      onClick(list.id);
    }
  };

  const itemCountLabel =
    typeof list.item_count === "number"
      ? list.item_count === 0
        ? "Brak produktów"
        : `${list.item_count} ${list.item_count === 1 ? "produkt" : "produkty"}`
      : undefined;

  const roleLabel = list.my_role === "owner" ? "Właściciel" : "Współdzielona";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition-colors ${
        list.is_disabled
          ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground/80"
          : "cursor-pointer border-border bg-card hover:bg-muted"
      }`}
      aria-disabled={list.is_disabled || undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border shadow-sm"
          style={{ backgroundColor: list.color }}
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">
            {list.name.trim() || "Bez nazwy"}
            {list.is_disabled && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Wyłączona
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {roleLabel}
            {itemCountLabel && <> • {itemCountLabel}</>}
          </p>
        </div>
      </div>

      {!list.is_disabled && (
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  );
};

export default ListCard;
