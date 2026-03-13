import type { FC } from "react";

interface EmptyListStateProps {
  onAddFirstItem?: () => void;
}

const EmptyListState: FC<EmptyListStateProps> = ({ onAddFirstItem }) => {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-muted px-4 py-6 text-sm">
      <h2 className="font-medium">Lista jest pusta</h2>
      <p className="max-w-md text-muted-foreground">
        Dodaj pierwszy produkt powyżej, aby rozpocząć zakupy. Produkty będą automatycznie grupowane w kategorie.
      </p>
      {onAddFirstItem && (
        <button
          type="button"
          onClick={onAddFirstItem}
          className="mt-1 inline-flex min-h-[44px] items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          Dodaj pierwszy produkt
        </button>
      )}
    </div>
  );
};

export default EmptyListState;
