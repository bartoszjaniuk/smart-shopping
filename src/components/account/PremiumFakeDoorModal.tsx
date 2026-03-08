import type { FC } from "react";

export interface PremiumFakeDoorModalProps {
  open: boolean;
  onClose: () => void;
}

const PremiumFakeDoorModal: FC<PremiumFakeDoorModalProps> = ({ open, onClose }) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:px-4 md:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-sm"
        aria-label="Zamknij"
      />
      <div className="relative flex h-full w-full max-h-dvh flex-col justify-between rounded-t-2xl border border-b-0 bg-card px-5 py-5 text-card-foreground shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border-b md:justify-start md:overflow-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="premium-modal-title" className="text-base font-semibold tracking-tight">
              Plan Premium
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">W przyszłości plan Premium będzie oferował:</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Zamknij"
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

        <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-foreground">
          <li>Nielimitowane listy zakupów</li>
          <li>Do 50 produktów na listę</li>
          <li>Priorytetowe wsparcie i przyszłe funkcje</li>
        </ul>

        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Płatności będą dostępne w przyszłości. Dziękujemy za zainteresowanie!
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            aria-label="Zamknij"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumFakeDoorModal;
