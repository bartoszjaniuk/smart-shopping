import { useCallback, useEffect, useState } from "react";

import type { ListDetailDto, ListMemberDto, MembersViewViewModel, MembershipRole } from "../../types";

/** Optional toast callback for success/error messages. When Sonner (or other) is added, pass toast from the view. */
export type MembersViewToast = (message: string, type: "success" | "error") => void;

export interface UseMembersViewOptions {
  /** Called on success/error for removeMember and leaveList. Omit if no toast system yet. */
  toast?: MembersViewToast;
}

const initialViewModel: MembersViewViewModel = {
  list: null,
  members: [],
  currentUserId: "",
  myRole: "editor",
  isLoadingList: true,
  isLoadingMembers: true,
  isError: false,
  errorMessage: undefined,
  isRemovingUserId: null,
};

function redirectToLoginWithRedirect(currentPath: string) {
  const redirect = encodeURIComponent(currentPath || "/lists");
  window.location.href = `/auth/login?redirect=${redirect}`;
}

/**
 * Hook for the /lists/:listId/members view. Fetches list (my_role) and members,
 * exposes removeMember and leaveList. On leaveList success, redirects to /lists and shows toast.
 * currentUserId is resolved via Supabase auth.getUser() on the client.
 */
export function useMembersView(listId: string, options: UseMembersViewOptions = {}) {
  const { toast } = options;

  const [list, setList] = useState<ListDetailDto | null>(initialViewModel.list);
  const [members, setMembers] = useState<ListMemberDto[]>(initialViewModel.members);
  const [currentUserId, setCurrentUserId] = useState<string>(initialViewModel.currentUserId);
  const [myRole, setMyRole] = useState<MembershipRole>(initialViewModel.myRole);
  const [isLoadingList, setIsLoadingList] = useState(initialViewModel.isLoadingList);
  const [isLoadingMembers, setIsLoadingMembers] = useState(initialViewModel.isLoadingMembers);
  const [isError, setIsError] = useState(initialViewModel.isError);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(initialViewModel.errorMessage);
  const [isRemovingUserId, setIsRemovingUserId] = useState<string | null>(initialViewModel.isRemovingUserId);

  const loadList = useCallback(async () => {
    if (typeof window === "undefined" || !listId) return;

    setIsLoadingList(true);
    setIsError(false);
    setErrorMessage(undefined);

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        redirectToLoginWithRedirect(window.location.pathname);
        return;
      }

      if (response.status === 403) {
        setIsError(true);
        setErrorMessage("Nie masz uprawnień do tej listy.");
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
      setMyRole(data.my_role);
      setIsLoadingList(false);
    } catch {
      setIsError(true);
      setErrorMessage("Wystąpił błąd połączenia. Sprawdź sieć i spróbuj ponownie.");
      setIsLoadingList(false);
    }
  }, [listId]);

  const loadMembers = useCallback(async () => {
    if (typeof window === "undefined" || !listId) return;

    setIsLoadingMembers(true);
    setIsError(false);
    setErrorMessage(undefined);

    try {
      const response = await fetch(`/api/lists/${listId}/members`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        redirectToLoginWithRedirect(window.location.pathname);
        return;
      }

      if (response.status === 403) {
        setIsError(true);
        setErrorMessage("Nie masz uprawnień do tej listy.");
        setIsLoadingMembers(false);
        return;
      }

      if (response.status === 404) {
        setIsError(true);
        setErrorMessage("Lista nie istnieje lub nie masz do niej dostępu.");
        setIsLoadingMembers(false);
        return;
      }

      if (!response.ok) {
        setIsError(true);
        setErrorMessage("Nie udało się pobrać uczestników. Spróbuj ponownie.");
        setIsLoadingMembers(false);
        return;
      }

      const body = (await response.json()) as { data: ListMemberDto[] };
      setMembers(body.data ?? []);
      setIsLoadingMembers(false);
    } catch {
      setIsError(true);
      setErrorMessage("Wystąpił błąd połączenia podczas pobierania uczestników. Spróbuj ponownie.");
      setIsLoadingMembers(false);
    }
  }, [listId]);

  // Resolve current user on client
  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;
    (async () => {
      try {
        const { createSupabaseBrowserClient } = await import("../../db/supabase.client");
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (mounted && user?.id) {
          setCurrentUserId(user.id);
        }
      } catch {
        // leave currentUserId empty; view can show loading or handle unauthenticated
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load list and members when listId is ready
  useEffect(() => {
    if (!listId) return;
    void loadList();
    void loadMembers();
  }, [listId, loadList, loadMembers]);

  const refetchMembers = useCallback(() => {
    void loadMembers();
  }, [loadMembers]);

  const removeMember = useCallback(
    async (userId: string) => {
      if (!listId) return;
      setIsRemovingUserId(userId);
      setIsError(false);
      setErrorMessage(undefined);

      try {
        const response = await fetch(`/api/lists/${listId}/members/${userId}`, {
          method: "DELETE",
          headers: { Accept: "application/json" },
        });

        if (response.status === 401) {
          redirectToLoginWithRedirect(window.location.pathname);
          return;
        }

        if (response.status === 400) {
          const body = (await response.json()) as { error?: string } | null;
          const msg = body?.error ?? "Nie można usunąć ostatniego właściciela listy.";
          toast?.(msg, "error");
          setIsRemovingUserId(null);
          return;
        }

        if (response.status === 403 || response.status === 404) {
          toast?.("Nie udało się usunąć uczestnika.", "error");
          setIsRemovingUserId(null);
          refetchMembers();
          return;
        }

        if (!response.ok) {
          toast?.("Nie udało się usunąć uczestnika. Spróbuj ponownie.", "error");
          setIsRemovingUserId(null);
          return;
        }

        toast?.("Uczestnik został usunięty z listy.", "success");
        refetchMembers();
      } catch {
        toast?.("Wystąpił błąd połączenia. Spróbuj ponownie.", "error");
      } finally {
        setIsRemovingUserId(null);
      }
    },
    [listId, toast, refetchMembers]
  );

  const leaveList = useCallback(async () => {
    if (!listId || !currentUserId) return;
    setIsRemovingUserId(currentUserId);
    setIsError(false);
    setErrorMessage(undefined);

    try {
      const response = await fetch(`/api/lists/${listId}/members/${currentUserId}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        redirectToLoginWithRedirect(window.location.pathname);
        return;
      }

      if (response.status === 400) {
        const body = (await response.json()) as { error?: string } | null;
        toast?.(body?.error ?? "Nie można opuścić listy.", "error");
        setIsRemovingUserId(null);
        return;
      }

      if (response.status === 403 || response.status === 404) {
        toast?.("Nie udało się opuścić listy.", "error");
        setIsRemovingUserId(null);
        return;
      }

      if (!response.ok) {
        toast?.("Nie udało się opuścić listy. Spróbuj ponownie.", "error");
        setIsRemovingUserId(null);
        return;
      }

      toast?.("Opuszczono listę.", "success");
      window.location.href = "/lists";
    } catch {
      toast?.("Wystąpił błąd połączenia. Spróbuj ponownie.", "error");
      setIsRemovingUserId(null);
    }
  }, [listId, currentUserId, toast]);

  const viewModel: MembersViewViewModel = {
    list,
    members,
    currentUserId,
    myRole,
    isLoadingList,
    isLoadingMembers,
    isError,
    errorMessage,
    isRemovingUserId,
  };

  return {
    ...viewModel,
    refetchMembers,
    removeMember,
    leaveList,
  };
}
