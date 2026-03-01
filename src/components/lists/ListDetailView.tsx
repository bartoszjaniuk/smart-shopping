import type { FC } from "react";
import { useState } from "react";

import { useListDetail, type InitialSessionForRealtime } from "../hooks/useListDetail";
import AddItemForm from "./AddItemForm";
import RealtimeStatusIndicator from "./RealtimeStatusIndicator";
import ListHeader from "./ListHeader";
import CategorySection from "./CategorySection";
import PurchasedSection from "./PurchasedSection";
import EmptyListState from "./EmptyListState";
import ClearPurchasedButton from "./ClearPurchasedButton";
import ConfirmClearPurchasedModal from "./ConfirmClearPurchasedModal";
import EditItemSheet from "./EditItemSheet";

interface ListDetailViewProps {
  listId: string;
  /** Sesja z serwera – ustawiana w kliencie Supabase przed subskrypcją Realtime (ciasteczka są httpOnly). */
  initialSession?: InitialSessionForRealtime | null;
}

const ListDetailView: FC<ListDetailViewProps> = ({ listId, initialSession }) => {
  const { viewModel, addItem, updateItem, togglePurchased, deleteItem, clearPurchased } = useListDetail(
    listId,
    initialSession ?? null
  );
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const handleBackToLists = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/lists";
    }
  };

  if (viewModel.isLoadingList || viewModel.isLoadingItems) {
    return (
      <div className="flex flex-1 flex-col gap-4 py-8">
        <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-5/6 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (viewModel.listDeleted) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-4 py-8">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Lista została usunięta</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {viewModel.errorMessage ?? "Właściciel mógł ją usunąć."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleBackToLists}
          className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Wróć do list
        </button>
      </div>
    );
  }

  if (!viewModel.list || viewModel.isError) {
    const message =
      viewModel.errorMessage ?? "Nie udało się wczytać tej listy. Mogła zostać usunięta lub nie masz do niej dostępu.";

    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-4 py-8">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Nie udało się wczytać listy</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Odśwież stronę
          </button>
          <button
            type="button"
            onClick={handleBackToLists}
            className="inline-flex items-center rounded-full border border-input bg-background px-4 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Wróć do list
          </button>
        </div>
      </div>
    );
  }

  const hasItems = viewModel.categorySections.length > 0 || viewModel.purchasedItems.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <RealtimeStatusIndicator status={viewModel.realtimeStatus} />

      {/* Nagłówek listy */}
      <ListHeader
        list={viewModel.list}
        totalItems={viewModel.items.length}
        purchasedItemsCount={viewModel.purchasedItems.length}
      />

      {/* Formularz dodawania produktu */}
      <section aria-label="Dodawanie produktu" className="mt-2">
        <AddItemForm disabled={!viewModel.canEditItems} onAddItem={async (name) => addItem(name)} />
      </section>

      {/* Główna zawartość listy */}
      <section aria-label="Produkty na liście" className="mt-2 flex-1 space-y-4">
        {!hasItems ? (
          <EmptyListState />
        ) : (
          <>
            {/* Sekcje kategorii (niekupione) */}
            <div className="space-y-4">
              {viewModel.categorySections.map((section) => (
                <CategorySection
                  key={section.categoryId}
                  category={section}
                  disabled={!viewModel.canEditItems}
                  onTogglePurchased={async (itemId, next) => {
                    await togglePurchased(itemId, next);
                  }}
                  onEdit={(itemId) => setEditingItemId(itemId)}
                  onDelete={async (itemId) => {
                    await deleteItem(itemId);
                  }}
                />
              ))}
            </div>

            {/* Sekcja kupionych produktów */}
            <PurchasedSection
              items={viewModel.purchasedItems}
              disabled={!viewModel.canEditItems}
              onTogglePurchased={async (itemId, next) => {
                await togglePurchased(itemId, next);
              }}
              onEdit={(itemId) => setEditingItemId(itemId)}
              onDelete={async (itemId) => {
                await deleteItem(itemId);
              }}
            />
          </>
        )}
      </section>

      {/* Sticky dolny pasek akcji */}
      <section
        aria-label="Akcje listy"
        className="sticky inset-x-0 bottom-0 -mx-4 mt-4 border-t bg-background/95 px-4 pb-safe pt-3 md:static md:mx-0 md:border-none md:bg-transparent md:px-0 md:pb-0"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <ClearPurchasedButton
            purchasedCount={viewModel.purchasedItems.length}
            disabled={!viewModel.canClearPurchased}
            onClick={async () => {
              setIsConfirmClearOpen(true);
            }}
          />
          <p className="text-[11px] text-muted-foreground">Kupione: {viewModel.purchasedItems.length} pozycji</p>
        </div>
      </section>

      <ConfirmClearPurchasedModal
        open={isConfirmClearOpen}
        purchasedCount={viewModel.purchasedItems.length}
        onCancel={() => setIsConfirmClearOpen(false)}
        onConfirm={async () => {
          setIsConfirmClearOpen(false);
          await clearPurchased();
        }}
      />

      {editingItemId && (
        <EditItemSheet
          open={!!editingItemId}
          itemId={editingItemId}
          initialName={viewModel.items.find((i) => i.id === editingItemId)?.name ?? ""}
          onSave={async (name) => {
            await updateItem(editingItemId, { name });
          }}
          onClose={() => setEditingItemId(null)}
        />
      )}
    </div>
  );
};

export default ListDetailView;
