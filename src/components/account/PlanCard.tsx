import type { FC } from "react";
import type { PlanType } from "../../types";

export interface PlanCardProps {
  plan: PlanType;
  onOpenPremiumModal?: () => void;
}

const LOCALE_LIMITS: Record<PlanType, { maxLists: number | null; maxItemsPerList: number; description: string }> = {
  basic: {
    maxLists: 1,
    maxItemsPerList: 10,
    description: "1 lista, do 10 produktów na listę.",
  },
  premium: {
    maxLists: null,
    maxItemsPerList: 50,
    description: "Nielimitowane listy, do 50 produktów na listę.",
  },
};

const PlanCard: FC<PlanCardProps> = ({ plan, onOpenPremiumModal }) => {
  const limits = LOCALE_LIMITS[plan];
  const isPremium = plan === "premium";

  return (
    <div className="rounded-md border border-input bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-medium ${
            isPremium ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {isPremium ? "Premium" : "Basic"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{limits.description}</p>
      {isPremium ? (
        <p className="mt-3 text-sm font-medium text-foreground">Korzystasz z planu Premium.</p>
      ) : (
        <button
          type="button"
          onClick={onOpenPremiumModal}
          className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          aria-label="Przejdź na Premium"
        >
          Przejdź na Premium
        </button>
      )}
    </div>
  );
};

export default PlanCard;
