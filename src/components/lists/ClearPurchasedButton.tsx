import type { FC } from "react";

interface ClearPurchasedButtonProps {
  purchasedCount: number;
  disabled?: boolean;
  onClick(): void;
}

const ClearPurchasedButton: FC<ClearPurchasedButtonProps> = ({ purchasedCount, disabled, onClick }) => {
  const isDisabled = disabled || purchasedCount === 0;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      Wyczyść kupione ({purchasedCount})
    </button>
  );
};

export default ClearPurchasedButton;
