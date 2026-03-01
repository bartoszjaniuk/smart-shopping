import type { FC } from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { ItemRowViewModel } from "../../types";

interface ItemRowProps {
  item: ItemRowViewModel;
  disabled?: boolean;
  onTogglePurchased(next: boolean): void;
  onEdit(): void;
  onDelete(): void;
}

const ItemRow: FC<ItemRowProps> = ({ item, disabled, onTogglePurchased, onEdit, onDelete }) => {
  const handleToggle = () => {
    if (disabled) return;
    onTogglePurchased(!item.isPurchased);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-foreground">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="flex flex-1 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-input bg-background ${
            item.isPurchased ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          {item.isPurchased && <span className="block h-3 w-3 rounded-full bg-primary-foreground" />}
        </span>
        <span
          className={`max-w-[16rem] truncate ${item.isPurchased ? "text-muted-foreground line-through" : ""}`}
          title={item.name}
        >
          {item.name}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          aria-label="Edytuj"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pencil className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Usuń"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default ItemRow;
