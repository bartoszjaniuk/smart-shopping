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
      className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      Wyczyść kupione ({purchasedCount})
    </button>
  );
};

export default ClearPurchasedButton;
