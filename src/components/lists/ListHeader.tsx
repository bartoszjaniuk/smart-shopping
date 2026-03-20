import type { FC } from "react";
import { useEffect, useState } from "react";

import type { ListDetailDto } from "../../types";

interface ListHeaderProps {
  list: ListDetailDto;
  totalItems: number;
  purchasedItemsCount: number;
  onUpdateDescription?: (next: string) => Promise<void>;
}

const ListHeader: FC<ListHeaderProps> = ({ list, totalItems, purchasedItemsCount, onUpdateDescription }) => {
  const isOwner = list.my_role === "owner";
  const canEditDescription = list.my_role === "owner" || list.my_role === "editor";

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState(list.description ?? "");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isEditingDescription) {
      setDraftDescription(list.description ?? "");
      setSaveError(undefined);
    }
  }, [list.description, isEditingDescription]);

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
              className="inline-flex h-5 w-1.5 rounded-md"
              style={{ backgroundColor: list.color }}
            />
            <h1 className="text-lg font-semibold tracking-tight">{list.name || "Lista zakupów"}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-[10px] uppercase tracking-wide"
              aria-label={`Rola: ${isOwner ? "Właściciel" : "Edytor"}`}
            >
              {isOwner ? "Owner" : "Editor"}
            </span>
            <span>
              {totalItems} pozycji, {purchasedItemsCount} kupionych
            </span>
          </div>

          {canEditDescription && (
            <>
              {!isEditingDescription ? (
                <div className="space-y-1">
                  {list.description?.trim() ? (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{list.description}</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">Dodaj notatkę do tej listy.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDescription(true);
                      setDraftDescription(list.description ?? "");
                      setSaveError(undefined);
                    }}
                    className="text-xs font-medium text-foreground/80 hover:text-foreground"
                    aria-label="Edytuj notatkę listy"
                  >
                    Edytuj
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    rows={3}
                    className="block w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Np. Lista przypomnień / co dodatkowo kupić..."
                    aria-label="Notatka listy"
                  />
                  {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!onUpdateDescription) return;
                        setIsSavingDescription(true);
                        setSaveError(undefined);
                        try {
                          await onUpdateDescription(draftDescription);
                          setIsEditingDescription(false);
                        } catch {
                          setSaveError("Nie udało się zapisać notatki. Spróbuj ponownie.");
                        } finally {
                          setIsSavingDescription(false);
                        }
                      }}
                      disabled={isSavingDescription}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingDescription ? "Zapis..." : "Zapisz"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingDescription(false);
                        setDraftDescription(list.description ?? "");
                        setSaveError(undefined);
                      }}
                      disabled={isSavingDescription}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {list.is_disabled && (
            <p className="text-xs font-medium text-amber-700">
              Lista jest wyłączona – przekroczono limit planu. Możesz przeglądać produkty, ale nie możesz ich edytować.
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={() => handleNavigate(`/lists/${list.id}/settings`)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
                aria-label="Ustawienia listy"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 3.6a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 3.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 2Z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNavigate(`/lists/${list.id}/members`)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
              aria-label="Członkowie listy"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ListHeader;
