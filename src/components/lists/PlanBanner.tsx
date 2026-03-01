import type { FC } from "react";
import type { PlanBannerViewModel } from "../../types";

interface PlanBannerProps {
  viewModel: PlanBannerViewModel;
  onOpenPremiumModal?: () => void;
  className?: string;
}

const PlanBanner: FC<PlanBannerProps> = ({ viewModel, onOpenPremiumModal, className }) => {
  const { plan, ownedListsCount, maxLists, limitReached, description } = viewModel;

  const listsUsageLabel =
    maxLists && maxLists > 0
      ? `${ownedListsCount}/${maxLists} ${ownedListsCount === 1 ? "lista" : "listy"}`
      : `${ownedListsCount} ${ownedListsCount === 1 ? "lista" : "listy"}`;

  const isBasic = plan === "basic";

  const handlePrimaryClick = () => {
    if (onOpenPremiumModal) {
      onOpenPremiumModal();
      return;
    }

    window.location.href = "/account#plan";
  };

  return (
    <section
      className={"mb-4 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm " + (className ?? "")}
      aria-label="Informacje o planie"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isBasic ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
          aria-hidden="true"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isBasic ? (
              <>
                <path d="M12 2 3 7l9 5 9-5-9-5Z" />
                <path d="M3 17l9 5 9-5" />
                <path d="M3 12l9 5 9-5" />
              </>
            ) : (
              <>
                <path d="M12 2l2.39 4.85L20 8l-3.5 3.6L17.2 18 12 15.7 6.8 18l.7-6.4L4 8l5.61-1.15L12 2Z" />
              </>
            )}
          </svg>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plan {plan === "basic" ? "Basic" : "Premium"}
            </p>
            <p className="text-xs text-muted-foreground">
              {listsUsageLabel}
              {maxLists && ` • limit: ${maxLists === 1 ? "1 lista" : `${maxLists} list`}`}
            </p>
          </div>

          <p className="text-sm leading-snug">{description}</p>

          {limitReached && isBasic && (
            <p className="text-xs font-medium text-amber-700">
              Osiągnąłeś limit list w planie Basic. Aby utworzyć kolejne listy, rozważ przejście na plan Premium.
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {isBasic ? "Zobacz plan Premium" : "Zarządzaj planem"}
            </button>

            {isBasic && !limitReached && (
              <span className="text-xs text-muted-foreground">Zbliżasz się do limitu? Sprawdź, co daje Premium.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlanBanner;
