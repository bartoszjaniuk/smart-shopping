import type { FC } from "react";
import type { ListDetailDto, ListDto } from "../../types";
import ListForm from "./ListForm";

interface NewListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (list: ListDto | ListDetailDto) => void;
}

const NewListModal: FC<NewListModalProps> = ({ open, onOpenChange, onCreated }) => {
  if (!open) {
    return null;
  }

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccessCreate = (list: ListDto | ListDetailDto) => {
    onCreated?.(list);
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:px-4 md:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-list-modal-title"
    >
      <button
        type="button"
        onClick={handleClose}
        className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-sm"
        aria-label="Zamknij"
      />
      <div className="relative flex h-full w-full max-h-dvh flex-col rounded-t-2xl border border-b-0 bg-card px-5 py-5 text-card-foreground shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border-b md:overflow-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="new-list-modal-title" className="text-base font-semibold tracking-tight">
              Nowa lista
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Utwórz nową listę zakupów, nadaj jej nazwę i wybierz kolor, aby łatwiej ją odróżnić.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Zamknij okno tworzenia listy"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto md:min-h-0">
          <ListForm mode="create" onSuccessCreate={handleSuccessCreate} onCancel={handleClose} />
        </div>
      </div>
    </div>
  );
};

export default NewListModal;
