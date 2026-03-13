import type { FC } from "react";
import { useEffect, useState } from "react";
import type { ListDto, PlanBannerViewModel, ProfileDto } from "../../types";
import PlanBanner from "./PlanBanner";
import NewListModal from "./NewListModal";
import ListCardGrid from "./ListCardGrid";
import ListsFilterBar from "./ListsFilterBar";
import { useListsDashboard } from "../hooks/useListsDashboard";

const ListsDashboardView: FC = () => {
  const [planBannerVm, setPlanBannerVm] = useState<PlanBannerViewModel | null>(null);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const { viewModel, refetch, setFilter } = useListsDashboard();

  useEffect(() => {
    let isMounted = true;

    const loadProfilePlan = async () => {
      try {
        const response = await fetch("/api/profile", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const profile: ProfileDto = await response.json();
        if (!isMounted || !profile.plan) {
          return;
        }

        const isBasic = profile.plan === "basic";
        const maxLists = isBasic ? 1 : null;

        const viewModel: PlanBannerViewModel = {
          plan: profile.plan,
          ownedListsCount: 0,
          maxLists,
          limitReached: false,
          description: isBasic
            ? "Korzystasz z planu Basic – możesz tworzyć podstawowe listy zakupów i współdzielić je z bliskimi."
            : "Korzystasz z planu Premium – bez limitu list i z pełnią możliwości SmartShopping.",
        };

        setPlanBannerVm(viewModel);
      } catch {
        // Ciche pominięcie błędu – banner nie jest krytyczny dla działania widoku.
      }
    };

    void loadProfilePlan();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNewListCreated = (list: ListDto) => {
    // Po utworzeniu listy odświeżamy dashboard, aby od razu pokazać nową pozycję.
    // W przyszłości może zostać zastąpione integracją z cache'em zapytań.
    if (typeof window !== "undefined") {
      if (list?.id) {
        window.location.href = `/lists/${list.id}`;
        return;
      }
      window.location.reload();
    }
  };

  return (
    <div className="space-y-4" aria-label="Dashboard list zakupów">
      {planBannerVm && <PlanBanner viewModel={planBannerVm} />}

      <div className="flex items-center justify-between gap-3">
        <ListsFilterBar value={viewModel.filter} onChange={setFilter} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-3">
        <div className="min-w-0 flex-1">
          {viewModel.isLoading ? (
            <p className="text-sm text-muted-foreground">Trwa ładowanie Twoich list...</p>
          ) : viewModel.isError ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-destructive">
                {viewModel.errorMessage ?? "Nie udało się pobrać list. Spróbuj ponownie."}
              </p>
              <button
                type="button"
                onClick={refetch}
                className="self-start rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted min-h-[44px]"
              >
                Spróbuj ponownie
              </button>
            </div>
          ) : viewModel.filteredLists.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nie masz jeszcze żadnych list. Utwórz pierwszą listę lub dołącz do listy kodem, aby zacząć planować
              zakupy.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Masz {viewModel.filteredLists.length} {viewModel.filteredLists.length === 1 ? "listę" : "listy"} dostępne
              na swoim koncie.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-row sm:gap-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/join";
              }
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:px-3 md:py-1.5 md:text-xs"
            aria-label="Dołącz do listy kodem zaproszenia"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
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
              <path d="M12 11v6" />
              <path d="M9 14h6" />
            </svg>
            <span>Dołącz z kodem</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewListModalOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:px-3 md:py-1.5 md:text-xs"
            aria-label="Utwórz nową listę"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            <span>Nowa lista</span>
          </button>
        </div>
      </div>

      {!viewModel.isLoading && !viewModel.isError && viewModel.filteredLists.length > 0 && (
        <ListCardGrid
          lists={viewModel.filteredLists}
          onCardClick={(id) => {
            if (typeof window !== "undefined") {
              window.location.href = `/lists/${id}`;
            }
          }}
        />
      )}

      <NewListModal open={isNewListModalOpen} onOpenChange={setIsNewListModalOpen} onCreated={handleNewListCreated} />
    </div>
  );
};

export default ListsDashboardView;
