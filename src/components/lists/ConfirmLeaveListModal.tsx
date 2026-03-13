import type { FC } from "react";

interface ConfirmLeaveListModalProps {
  open: boolean;
  onConfirm(): void;
  onCancel(): void;
}

const ConfirmLeaveListModal: FC<ConfirmLeaveListModalProps> = ({ open, onConfirm, onCancel }) => {
  if (!open) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:px-4 md:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-list-modal-title"
    >
      <button
        type="button"
        onClick={onCancel}
        className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-sm"
        aria-label="Zamknij"
      />
      <div className="relative flex h-full w-full max-h-dvh flex-col justify-between rounded-t-md border border-b-0 bg-card px-5 py-5 text-card-foreground shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-md md:border-b md:justify-start md:overflow-auto">
        <div className="mb-4">
          <h2 id="leave-list-modal-title" className="text-base font-semibold tracking-tight">
            Na pewno chcesz opuścić tę listę?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Przestaniesz mieć dostęp do tej listy i jej uczestników. Aby ponownie dołączyć, będziesz potrzebować nowego
            kodu zaproszenia.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
          >
            Opuść listę
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmLeaveListModal;
