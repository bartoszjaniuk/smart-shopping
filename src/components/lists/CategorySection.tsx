import type { FC } from "react";

import type { CategorySectionViewModel } from "../../types";
import ItemRow from "./ItemRow";

interface CategorySectionProps {
  category: CategorySectionViewModel;
  disabled?: boolean;
  onTogglePurchased(itemId: string, next: boolean): void;
  onEdit(itemId: string): void;
  onDelete(itemId: string): void;
}

const CategorySection: FC<CategorySectionProps> = ({ category, disabled, onTogglePurchased, onEdit, onDelete }) => {
  return (
    <section className="space-y-2" aria-label={category.categoryName}>
      <div className="flex items-center gap-1">
        <h2 className="text-sm font-semibold tracking-tight">{category.categoryName}</h2>
        <h2 className="text-sm font-semibold tracking-tight">({category.items.length})</h2>
      </div>
      <div className="divide-y divide-border rounded-lg border bg-card">
        {category.items.map((item) => (
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

export default CategorySection;
