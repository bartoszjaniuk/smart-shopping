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

      <div className="flex items-center justify-between gap-3">
        {viewModel.isLoading ? (
          <p className="text-sm text-muted-foreground">Trwa ładowanie Twoich list...</p>
        ) : viewModel.isError ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-destructive">
              {viewModel.errorMessage ?? "Nie udało się pobrać list. Spróbuj ponownie."}
            </p>
            <button
              type="button"
              onClick={refetch}
              className="self-start rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : viewModel.filteredLists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nie masz jeszcze żadnych list. Utwórz pierwszą listę, aby zacząć planować zakupy.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Masz {viewModel.filteredLists.length} {viewModel.filteredLists.length === 1 ? "listę" : "listy"} dostępne na
            swoim koncie.
          </p>
        )}

        <button
          type="button"
          onClick={() => setIsNewListModalOpen(true)}
          className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <span className="mr-1.5 text-base leading-none">+</span>
          <span>Nowa lista</span>
        </button>
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
