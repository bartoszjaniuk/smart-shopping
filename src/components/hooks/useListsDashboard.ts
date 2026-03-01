import { useEffect, useState } from "react";

import type { ListSummaryDto, ListsDashboardViewModel, ListsFilter, ListsListResponseDto, PlanType } from "../../types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const initialViewModel: ListsDashboardViewModel = {
  lists: [],
  filteredLists: [],
  filter: "all",
  isLoading: true,
  isError: false,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
  totalCount: 0,
  ownedListsCount: 0,
  hasReachedListLimit: false,
};

function applyFilter(lists: ListSummaryDto[], filter: ListsFilter): ListSummaryDto[] {
  if (filter === "owned") {
    return lists.filter((list) => list.my_role === "owner");
  }
  if (filter === "shared") {
    return lists.filter((list) => list.my_role === "editor");
  }
  return lists;
}

function computeOwnedListsCount(lists: ListSummaryDto[]): number {
  return lists.filter((list) => list.my_role === "owner").length;
}

function computeHasReachedListLimit(plan: PlanType | undefined, ownedListsCount: number): boolean {
  if (!plan) return false;
  if (plan === "basic") {
    return ownedListsCount >= 1;
  }
  return false;
}

export function useListsDashboard() {
  const [viewModel, setViewModel] = useState<ListsDashboardViewModel>(initialViewModel);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadLists = async () => {
      setViewModel((prev) => ({
        ...prev,
        isLoading: true,
        isError: false,
      }));
      setErrorMessage(undefined);

      try {
        const response = await fetch(`/api/lists?page=${DEFAULT_PAGE}&page_size=${DEFAULT_PAGE_SIZE}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          if (!isMounted) return;

          if (response.status === 401) {
            setErrorMessage("Twoja sesja wygasła. Zaloguj się ponownie, aby zobaczyć swoje listy.");
          } else {
            setErrorMessage("Nie udało się pobrać list. Spróbuj ponownie.");
          }

          setViewModel((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
          }));
          return;
        }

        const data = (await response.json()) as ListsListResponseDto;
        if (!isMounted) return;

        const lists = data.data ?? [];
        const ownedCount = computeOwnedListsCount(lists);

        setViewModel((prev) => {
          const filter = prev.filter ?? "all";
          const filteredLists = applyFilter(lists, filter);
          const hasReachedListLimit = computeHasReachedListLimit(prev.plan, ownedCount);

          return {
            ...prev,
            lists,
            filteredLists,
            isLoading: false,
            isError: false,
            errorMessage: undefined,
            page: data.meta?.page ?? DEFAULT_PAGE,
            pageSize: data.meta?.page_size ?? DEFAULT_PAGE_SIZE,
            totalCount: data.meta?.total_count ?? lists.length,
            ownedListsCount: ownedCount,
            hasReachedListLimit,
          };
        });
      } catch {
        if (!isMounted) return;

        setErrorMessage("Wystąpił błąd połączenia. Sprawdź sieć i spróbuj ponownie.");
        setViewModel((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
        }));
      }
    };

    void loadLists();

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  const setFilter = (next: ListsFilter) => {
    setViewModel((prev) => {
      const filteredLists = applyFilter(prev.lists, next);
      return {
        ...prev,
        filter: next,
        filteredLists,
      };
    });
  };

  const refetch = () => {
    setReloadToken((token) => token + 1);
  };

  return {
    viewModel: {
      ...viewModel,
      errorMessage,
    },
    setFilter,
    refetch,
  };
}
