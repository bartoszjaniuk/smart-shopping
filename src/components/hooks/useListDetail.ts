import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CategorySectionViewModel,
  ListDetailDto,
  ListDetailViewModel,
  ListItemDto,
  ListItemsListResponseDto,
  RealtimeStatus,
} from "../../types";
import { type ItemRowViewModel } from "../../types";
import type { SupabaseClient } from "../../db/supabase.client";

const DEFAULT_ITEMS_PAGE = 1;
const DEFAULT_ITEMS_PAGE_SIZE = 100;

function getCategoryLocale(): "pl" | "en" {
  if (typeof navigator === "undefined" || !navigator.language) return "en";
  return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
}

function mapItemToViewModel(item: ListItemDto, categoryNameByCode: Record<string, string>): ItemRowViewModel {
  return {
    id: item.id,
    name: item.name,
    categoryCode: item.category_code,
    isPurchased: item.is_purchased,
    createdAt: item.created_at,
    categoryName: categoryNameByCode[item.category_code] ?? item.category_code,
  };
}

function groupItemsByCategory(
  items: ListItemDto[],
  categoryNameByCode: Record<string, string>
): {
  categorySections: CategorySectionViewModel[];
  purchasedItems: ItemRowViewModel[];
} {
  const sectionsMap = new Map<string, CategorySectionViewModel>();
  const purchasedItems: ItemRowViewModel[] = [];

  for (const item of items) {
    const viewModel = mapItemToViewModel(item, categoryNameByCode);

    if (viewModel.isPurchased) {
      purchasedItems.push(viewModel);
      continue;
    }

    const key = item.category_id ?? item.category_code;
    const existing = sectionsMap.get(key);

    if (existing) {
      existing.items.push(viewModel);
      continue;
    }

    const categoryName = categoryNameByCode[item.category_code] ?? item.category_code;
    sectionsMap.set(key, {
      categoryId: item.category_id,
      categoryCode: item.category_code,
      categoryName,
      items: [viewModel],
    });
  }

  const categorySections = Array.from(sectionsMap.values());

  return {
    categorySections,
    purchasedItems,
  };
}

function getInitialOfflineState(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return !navigator.onLine;
}

function getInitialRealtimeStatus(): RealtimeStatus {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "connecting";
  }
  return navigator.onLine ? "online" : "offline";
}

const initialViewModel: ListDetailViewModel = {
  list: null,
  items: [],
  categorySections: [],
  purchasedItems: [],
  isLoadingList: true,
  isLoadingItems: true,
  isMutating: false,
  isError: false,
  errorMessage: undefined,
  listDeleted: false,
  isOffline: false,
  realtimeStatus: "connecting",
  canEditItems: false,
  canClearPurchased: false,
};

function redirectToLoginWithRedirect(currentPath: string) {
  const redirect = encodeURIComponent(currentPath || "/lists");
  window.location.href = `/auth/login?redirect=${redirect}`;
}

/** Mapuje odpowiedź API (400/403) przy dodawaniu produktu na komunikat dla użytkownika. */
function parseAddItemErrorPayload(data: { error?: string; details?: string } | null): string {
  if (!data) return "Nie udało się dodać produktu. Sprawdź dane i spróbuj ponownie.";
  const { error, details } = data;
  const detailLower = (details ?? "").toLowerCase();
  const errorLower = (error ?? "").toLowerCase();
  if (
    detailLower.includes("already exists") ||
    detailLower.includes("już jest") ||
    errorLower.includes("already exists")
  ) {
    return "Ten produkt już jest na liście.";
  }
  if (errorLower.includes("limit") || detailLower.includes("limit") || (error && error.includes("List item limit"))) {
    return "Osiągnięto limit produktów na liście. W planie Basic możesz mieć 10 pozycji; przejdź na Premium, aby zwiększyć limit.";
  }
  if (details && details.trim()) {
    const namePart = details.split(";").find((p) => p.trim().toLowerCase().startsWith("name:"));
    if (namePart) {
      const msg = namePart.split(":").slice(1).join(":").trim();
      if (msg) return msg;
    }
    return details.trim();
  }
  if (error && error.trim()) return error.trim();
  return "Nie udało się dodać produktu. Sprawdź dane i spróbuj ponownie.";
}

export interface InitialSessionForRealtime {
  access_token: string;
  refresh_token: string;
}

export function useListDetail(listId: string, initialSession: InitialSessionForRealtime | null = null) {
  const [list, setList] = useState<ListDetailDto | null>(null);
  const [items, setItems] = useState<ListItemDto[]>([]);
  const [categoryNameByCode, setCategoryNameByCode] = useState<Record<string, string>>({});

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const [isOffline, setIsOffline] = useState(getInitialOfflineState);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(getInitialRealtimeStatus);
  const [listDeleted, setListDeleted] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const locale = getCategoryLocale();
    let mounted = true;
    (async () => {
      try {
        const response = await fetch(`/api/categories?locale=${locale}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!mounted || !response.ok) return;
        const { data } = (await response.json()) as { data: { code: string; name: string }[] };
        if (!mounted || !data) return;
        const map: Record<string, string> = {};
        for (const c of data) {
          map[c.code] = c.name;
        }
        setCategoryNameByCode(map);
      } catch {
        // leave map empty; categoryName will fallback to category_code
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOffline(false);
      setRealtimeStatus("online");
    };

    const handleOffline = () => {
      setIsOffline(true);
      setRealtimeStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !listId) return;

    setRealtimeStatus("connecting");

    const channels: ReturnType<SupabaseClient["channel"]>[] = [];
    let supabase: SupabaseClient | null = null;
    let mounted = true;

    const triggerRefetch = () => {
      if (mounted) {
        setRealtimeStatus((prev) => (prev === "online" ? "syncing" : prev));
        setReloadToken((t) => t + 1);
      }
    };

    const setStatusFromChannel = (channelName: string, status: string) => {
      if (!mounted) return;
      if (status === "SUBSCRIBED") {
        setRealtimeStatus((prev) => (prev === "connecting" ? "online" : prev));
      } else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
        setRealtimeStatus("unavailable");
      }
    };

    (async () => {
      try {
        const { createSupabaseBrowserClient } = await import("../../db/supabase.client");
        supabase = createSupabaseBrowserClient();

        let tokenForRealtime: string | undefined;
        if (initialSession?.access_token && initialSession?.refresh_token) {
          await supabase.auth.setSession({
            access_token: initialSession.access_token,
            refresh_token: initialSession.refresh_token,
          });
          tokenForRealtime = initialSession.access_token;
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          tokenForRealtime = session?.access_token;
        }
        if (tokenForRealtime) {
          await supabase.realtime.setAuth(tokenForRealtime);
        } else {
          await supabase.realtime.setAuth();
        }

        const usePrivateChannel = true;

        const topicList = `list:${listId}`;
        const topicItems = `list:${listId}:items`;
        const topicMembers = `list:${listId}:members`;

        const channelList = supabase.channel(topicList, {
          config: { broadcast: { self: false }, private: usePrivateChannel },
        });
        channelList
          .on("broadcast", { event: "list_updated" }, () => triggerRefetch())
          .on("broadcast", { event: "list_deleted" }, () => {
            if (mounted) {
              setListDeleted(true);
              setIsError(true);
              setErrorMessage("Lista została usunięta. Właściciel mógł ją usunąć.");
            }
          })
          .on("broadcast", { event: "UPDATE" }, () => triggerRefetch())
          .on("broadcast", { event: "DELETE" }, () => {
            if (mounted) {
              setListDeleted(true);
              setIsError(true);
              setErrorMessage("Lista została usunięta. Właściciel mógł ją usunąć.");
            }
          });
        channelList.subscribe((status) => setStatusFromChannel(topicList, status));
        channels.push(channelList);

        const channelItems = supabase.channel(topicItems, {
          config: { broadcast: { self: false }, private: usePrivateChannel },
        });
        channelItems
          .on("broadcast", { event: "list_item_inserted" }, () => triggerRefetch())
          .on("broadcast", { event: "list_item_updated" }, () => triggerRefetch())
          .on("broadcast", { event: "list_item_deleted" }, () => triggerRefetch())
          .on("broadcast", { event: "INSERT" }, () => triggerRefetch())
          .on("broadcast", { event: "UPDATE" }, () => triggerRefetch())
          .on("broadcast", { event: "DELETE" }, () => triggerRefetch())
          .on("broadcast", { event: "*" }, () => triggerRefetch());
        channelItems.subscribe((status) => setStatusFromChannel(topicItems, status));
        channels.push(channelItems);

        const channelMembers = supabase.channel(topicMembers, {
          config: { broadcast: { self: false }, private: usePrivateChannel },
        });
        channelMembers
          .on("broadcast", { event: "list_membership_inserted" }, () => triggerRefetch())
          .on("broadcast", { event: "list_membership_deleted" }, () => triggerRefetch())
          .on("broadcast", { event: "INSERT" }, () => triggerRefetch())
          .on("broadcast", { event: "DELETE" }, () => triggerRefetch());
        channelMembers.subscribe((status) => setStatusFromChannel(topicMembers, status));
        channels.push(channelMembers);
      } catch {
        if (mounted) setRealtimeStatus("unavailable");
      }
    })();

    return () => {
      mounted = false;
      const client = supabase;
      if (client && channels.length > 0) {
        channels.forEach((ch) => client.removeChannel(ch));
      }
    };
  }, [listId, initialSession]);

  useEffect(() => {
    let isMounted = true;

    const loadList = async () => {
      setIsLoadingList(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const response = await fetch(`/api/lists/${listId}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!isMounted) return;

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            redirectToLoginWithRedirect(window.location.pathname + window.location.search);
          }
          return;
        }

        if (response.status === 403) {
          setIsError(true);
          setErrorMessage("Brak dostępu do tej listy.");
          setIsLoadingList(false);
          return;
        }

        if (response.status === 404) {
          setIsError(true);
          setErrorMessage("Lista nie istnieje lub nie masz do niej dostępu.");
          setIsLoadingList(false);
          return;
        }

        if (!response.ok) {
          setIsError(true);
          setErrorMessage("Nie udało się pobrać szczegółów listy. Spróbuj ponownie.");
          setIsLoadingList(false);
          return;
        }

        const data = (await response.json()) as ListDetailDto;
        setList(data);
        setIsLoadingList(false);
        setRealtimeStatus((prev) => (prev === "connecting" || prev === "syncing" ? "online" : prev));
      } catch {
        if (!isMounted) return;

        setIsError(true);
        setErrorMessage("Wystąpił błąd połączenia. Sprawdź sieć i spróbuj ponownie.");
        setIsLoadingList(false);
        setIsOffline(true);
        setRealtimeStatus("offline");
      }
    };

    const loadItems = async () => {
      setIsLoadingItems(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const response = await fetch(
          `/api/lists/${listId}/items?page=${DEFAULT_ITEMS_PAGE}&page_size=${DEFAULT_ITEMS_PAGE_SIZE}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!isMounted) return;

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            redirectToLoginWithRedirect(window.location.pathname + window.location.search);
          }
          return;
        }

        if (response.status === 404) {
          setIsError(true);
          setErrorMessage("Produkty tej listy nie zostały znalezione.");
          setIsLoadingItems(false);
          return;
        }

        if (!response.ok) {
          setIsError(true);
          setErrorMessage("Nie udało się pobrać produktów listy. Spróbuj ponownie.");
          setIsLoadingItems(false);
          return;
        }

        const data = (await response.json()) as ListItemsListResponseDto;
        setItems(data.data ?? []);
        setIsLoadingItems(false);
        setRealtimeStatus((prev) => (prev === "connecting" || prev === "syncing" ? "online" : prev));
      } catch {
        if (!isMounted) return;

        setIsError(true);
        setErrorMessage("Wystąpił błąd połączenia podczas pobierania produktów. Sprawdź sieć i spróbuj ponownie.");
        setIsLoadingItems(false);
        setIsOffline(true);
        setRealtimeStatus("offline");
      }
    };

    setRealtimeStatus((prev) => (prev === "offline" ? prev : "connecting"));
    void loadList();
    void loadItems();

    return () => {
      isMounted = false;
    };
  }, [listId, reloadToken]);

  const refetchAll = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const addItem = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      if (isOffline) {
        setIsError(true);
        setErrorMessage("Jesteś offline. Dodawanie produktów wymaga połączenia z siecią.");
        return;
      }

      setIsMutating(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const response = await fetch(`/api/lists/${listId}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ name: trimmed }),
        });

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            redirectToLoginWithRedirect(window.location.pathname + window.location.search);
          }
          return;
        }

        if (response.status === 400 || response.status === 403) {
          let errorText = "Nie udało się dodać produktu. Sprawdź dane i spróbuj ponownie.";
          try {
            const data = (await response.json()) as { error?: string; details?: string } | null;
            errorText = parseAddItemErrorPayload(data);
          } catch {
            // leave default errorText if JSON parse fails
          }
          setIsError(true);
          setErrorMessage(errorText);
          throw new Error(errorText);
        }

        if (response.status === 404) {
          setIsError(true);
          setErrorMessage("Lista nie istnieje lub nie masz do niej dostępu.");
          throw new Error("Lista nie istnieje lub nie masz do niej dostępu.");
        }

        if (!response.ok) {
          setIsError(true);
          setErrorMessage("Nie udało się dodać produktu. Spróbuj ponownie.");
          throw new Error("Nie udało się dodać produktu. Spróbuj ponownie.");
        }

        const item = (await response.json()) as ListItemDto;
        setItems((prev) => [...prev, item]);
      } catch {
        if (!isOffline) {
          setIsError(true);
          setErrorMessage("Wystąpił błąd połączenia podczas dodawania produktu. Sprawdź sieć i spróbuj ponownie.");
          setIsOffline(true);
          setRealtimeStatus("offline");
        }
      } finally {
        setIsMutating(false);
      }
    },
    [isOffline, listId]
  );

  const updateItem = useCallback(
    async (itemId: string, payload: { name?: string; category_id?: string }) => {
      if (isOffline) {
        setIsError(true);
        setErrorMessage("Jesteś offline. Edycja produktu wymaga połączenia z siecią.");
        return;
      }
      if (!payload.name && payload.category_id === undefined) return;

      setIsMutating(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const body: { name?: string; category_id?: string } = {};
        if (payload.name !== undefined) body.name = payload.name;
        if (payload.category_id !== undefined) body.category_id = payload.category_id;

        const response = await fetch(`/api/lists/${listId}/items/${itemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            redirectToLoginWithRedirect(window.location.pathname + window.location.search);
          }
          return;
        }
        if (response.status === 404) {
          setIsError(true);
          setErrorMessage("Ten produkt został już usunięty lub nie istnieje.");
          void refetchAll();
          return;
        }
        if (response.status === 403) {
          setIsError(true);
          setErrorMessage("Nie masz uprawnień do edycji produktów na tej liście.");
          return;
        }
        if (response.status === 400) {
          setIsError(true);
          try {
            const data = (await response.json()) as { error?: string; details?: string } | null;
            setErrorMessage(
              data?.details ?? data?.error ?? "Nieprawidłowe dane. Sprawdź nazwę (max 50 znaków) i spróbuj ponownie."
            );
          } catch {
            setErrorMessage("Nieprawidłowe dane. Sprawdź nazwę i spróbuj ponownie.");
          }
          return;
        }
        if (!response.ok) {
          setIsError(true);
          setErrorMessage("Nie udało się zapisać zmian. Spróbuj ponownie.");
          return;
        }
        const updated = (await response.json()) as ListItemDto;
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
        setIsError(true);
        setErrorMessage("Wystąpił błąd połączenia podczas zapisywania. Sprawdź sieć i spróbuj ponownie.");
        setIsOffline(true);
        setRealtimeStatus("offline");
      } finally {
        setIsMutating(false);
      }
    },
    [isOffline, listId, refetchAll]
  );

  const togglePurchased = useCallback(
    async (itemId: string, next: boolean) => {
      if (isOffline) {
        setIsError(true);
        setErrorMessage("Jesteś offline. Oznaczanie produktów jako kupione działa tylko z połączeniem sieciowym.");
        return;
      }

      setIsMutating(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const response = await fetch(`/api/lists/${listId}/items/${itemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ is_purchased: next }),
        });

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            redirectToLoginWithRedirect(window.location.pathname + window.location.search);
          }
          return;
        }

        if (response.status === 404) {
          setIsError(true);
          setErrorMessage("Ten produkt został już usunięty lub nie istnieje.");
          void refetchAll();
          return;
        }

        if (response.status === 403) {
          setIsError(true);
          setErrorMessage("Nie masz uprawnień do modyfikowania produktów na tej liście.");
          return;
        }

        if (!response.ok) {
          setIsError(true);
          setErrorMessage("Nie udało się zaktualizować produktu. Spróbuj ponownie.");
          return;
        }

        const updated = (await response.json()) as ListItemDto;
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
        setIsError(true);
        setErrorMessage("Wystąpił błąd połączenia podczas aktualizowania produktu. Sprawdź sieć i spróbuj ponownie.");
        setIsOffline(true);
        setRealtimeStatus("offline");
      } finally {
        setIsMutating(false);
      }
    },
    [isOffline, listId, refetchAll]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (isOffline) {
        setIsError(true);
        setErrorMessage("Jesteś offline. Usuwanie produktów wymaga połączenia z siecią.");
        return;
      }

      setIsMutating(true);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const response = await fetch(`/api/lists/${listId}/items/${itemId}`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            redirectToLoginWithRedirect(window.location.pathname + window.location.search);
          }
          return;
        }

        if (response.status === 404) {
          setIsError(true);
          setErrorMessage("Ten produkt został już usunięty lub nie istnieje.");
          void refetchAll();
          return;
        }

        if (response.status === 403) {
          setIsError(true);
          setErrorMessage("Nie masz uprawnień do usuwania produktów z tej listy.");
          return;
        }

        if (!response.ok) {
          setIsError(true);
          setErrorMessage("Nie udało się usunąć produktu. Spróbuj ponownie.");
          return;
        }

        setItems((prev) => prev.filter((item) => item.id !== itemId));
      } catch {
        setIsError(true);
        setErrorMessage("Wystąpił błąd połączenia podczas usuwania produktu. Sprawdź sieć i spróbuj ponownie.");
        setIsOffline(true);
        setRealtimeStatus("offline");
      } finally {
        setIsMutating(false);
      }
    },
    [isOffline, listId, refetchAll]
  );

  const clearPurchased = useCallback(async () => {
    if (isOffline) {
      setIsError(true);
      setErrorMessage("Jesteś offline. Po odzyskaniu połączenia spróbuj ponownie wyczyścić kupione pozycje.");
      return;
    }

    setIsMutating(true);
    setIsError(false);
    setErrorMessage(undefined);

    try {
      const response = await fetch(`/api/lists/${listId}/items/clear-purchased`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        if (typeof window !== "undefined") {
          redirectToLoginWithRedirect(window.location.pathname + window.location.search);
        }
        return;
      }

      if (response.status === 403) {
        setIsError(true);
        setErrorMessage("Nie masz uprawnień do czyszczenia kupionych produktów na tej liście.");
        return;
      }

      if (!response.ok) {
        setIsError(true);
        setErrorMessage("Nie udało się usunąć kupionych produktów. Spróbuj ponownie.");
        return;
      }

      setItems((prev) => prev.filter((item) => !item.is_purchased));
    } catch {
      setIsError(true);
      setErrorMessage(
        "Wystąpił błąd połączenia podczas czyszczenia kupionych produktów. Sprawdź sieć i spróbuj ponownie."
      );
      setIsOffline(true);
      setRealtimeStatus("offline");
    } finally {
      setIsMutating(false);
    }
  }, [isOffline, listId]);

  const viewModel: ListDetailViewModel = useMemo(() => {
    if (!list) {
      return {
        ...initialViewModel,
        list,
        items,
        isLoadingList,
        isLoadingItems,
        isMutating,
        isError,
        errorMessage,
        listDeleted,
        isOffline,
        realtimeStatus,
      };
    }

    const { categorySections, purchasedItems } = groupItemsByCategory(items, categoryNameByCode);
    const canEditItems = !list.is_disabled && (list.my_role === "owner" || list.my_role === "editor");
    const canClearPurchased = canEditItems && purchasedItems.length > 0;

    return {
      list,
      items,
      categorySections,
      purchasedItems,
      isLoadingList,
      isLoadingItems,
      isMutating,
      isError,
      errorMessage,
      listDeleted,
      isOffline,
      realtimeStatus,
      canEditItems,
      canClearPurchased,
    };
  }, [
    list,
    items,
    categoryNameByCode,
    isLoadingList,
    isLoadingItems,
    isMutating,
    isError,
    errorMessage,
    listDeleted,
    isOffline,
    realtimeStatus,
  ]);

  return {
    viewModel,
    addItem,
    updateItem,
    togglePurchased,
    deleteItem,
    clearPurchased,
    refetchAll,
  };
}
