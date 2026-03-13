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
      className={
        "rounded-md border border-input bg-card px-3 py-3 text-card-foreground shadow-sm md:mb-4 md:px-4 " +
        (className ?? "")
      }
      aria-label="Informacje o planie"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md md:h-8 md:w-8 ${
            isBasic
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
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

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plan {plan === "basic" ? "Basic" : "Premium"}
            </p>
            <p className="text-xs text-muted-foreground" aria-label={`Użycie: ${listsUsageLabel}`}>
              {listsUsageLabel}
            </p>
          </div>

          <p className="hidden text-sm leading-snug text-muted-foreground md:block">{description}</p>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground md:hidden">{description}</p>

          {limitReached && isBasic && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Osiągnąłeś limit list. Zobacz plan Premium, aby tworzyć więcej.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:pt-0">
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0 md:min-w-0 md:py-1.5 md:text-xs"
              aria-label={isBasic ? "Zobacz plan Premium" : "Zarządzaj planem"}
            >
              {isBasic ? "Zobacz plan Premium" : "Zarządzaj planem"}
            </button>
            {isBasic && !limitReached && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Zbliżasz się do limitu? Sprawdź, co daje Premium.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlanBanner;
