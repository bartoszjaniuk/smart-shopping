import type { FC } from "react";

import type { ItemRowViewModel } from "../../types";
import ItemRow from "./ItemRow";

interface PurchasedSectionProps {
  items: ItemRowViewModel[];
  disabled?: boolean;
  onTogglePurchased(itemId: string, next: boolean): void;
  onEdit(itemId: string): void;
  onDelete(itemId: string): void;
}

const PurchasedSection: FC<PurchasedSectionProps> = ({ items, disabled, onTogglePurchased, onEdit, onDelete }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Kupione produkty" className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Kupione</h2>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "produkt" : "produktów"}
        </span>
      </div>
      <div className="divide-y divide-border rounded-lg border bg-card">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            disabled={disabled}
            onTogglePurchased={(next) => onTogglePurchased(item.id, next)}
            onEdit={() => onEdit(item.id)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>
    </section>
  );
};

export default PurchasedSection;
