import type { FC } from "react";

import type { ListDetailDto } from "../../types";

interface ListHeaderProps {
  list: ListDetailDto;
  totalItems: number;
  purchasedItemsCount: number;
}

const ListHeader: FC<ListHeaderProps> = ({ list, totalItems, purchasedItemsCount }) => {
  const isOwner = list.my_role === "owner";

  const handleNavigate = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.href = path;
    }
  };

  return (
    <header className="space-y-2" aria-label="Nagłówek listy">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-1.5 rounded-full"
              style={{ backgroundColor: list.color }}
            />
            <h1 className="text-lg font-semibold tracking-tight">{list.name || "Lista zakupów"}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] uppercase tracking-wide"
              aria-label={`Rola: ${isOwner ? "Właściciel" : "Edytor"}`}
            >
              {isOwner ? "Owner" : "Editor"}
            </span>
            <span>
              {totalItems} pozycji, {purchasedItemsCount} kupionych
            </span>
          </div>
          {list.is_disabled && (
            <p className="text-xs font-medium text-amber-700">
              Lista jest wyłączona – przekroczono limit planu. Możesz przeglądać produkty, ale nie możesz ich edytować.
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 text-xs">
          {isOwner && (
            <button
              type="button"
              onClick={() => handleNavigate(`/lists/${list.id}/settings`)}
              className="inline-flex items-center rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Ustawienia
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNavigate(`/lists/${list.id}/members`)}
            className="inline-flex items-center rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Członkowie
          </button>
        </div>
      </div>
    </header>
  );
};

export default ListHeader;
