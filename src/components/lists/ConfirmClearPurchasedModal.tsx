import type { FC } from "react";

interface ConfirmClearPurchasedModalProps {
  open: boolean;
  onConfirm(): void;
  onCancel(): void;
  purchasedCount: number;
}

const ConfirmClearPurchasedModal: FC<ConfirmClearPurchasedModalProps> = ({
  open,
  onConfirm,
  onCancel,
  purchasedCount,
}) => {
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
      aria-labelledby="clear-purchased-modal-title"
    >
      <button
        type="button"
        onClick={onCancel}
        className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-sm"
        aria-label="Zamknij"
      />
      <div className="relative flex h-full w-full max-h-dvh flex-col justify-between rounded-t-2xl border border-b-0 bg-card px-5 py-5 text-card-foreground shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border-b md:justify-start md:overflow-auto">
        <div className="mb-4">
          <h2 id="clear-purchased-modal-title" className="text-base font-semibold tracking-tight">
            Usunąć wszystkie kupione produkty?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ta operacja bezpowrotnie usunie <span className="font-medium text-foreground">{purchasedCount}</span>{" "}
            {purchasedCount === 1 ? "pozycję" : "pozycji"} oznaczonych jako kupione z tej listy.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nie będziesz mógł cofnąć tej zmiany. Upewnij się, że chcesz wyczyścić kupione produkty.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center justify-center rounded-full bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
          >
            Usuń kupione
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmClearPurchasedModal;
