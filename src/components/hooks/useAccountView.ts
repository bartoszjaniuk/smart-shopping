import { useCallback, useEffect, useState } from "react";

import type { ProfileDto } from "../../types";

function redirectToLoginWithRedirect(currentPath: string) {
  const redirect = encodeURIComponent(currentPath || "/account");
  if (typeof window !== "undefined") {
    window.location.href = `/auth/login?redirect=${redirect}`;
  }
}

export interface UseAccountViewReturn {
  profile: ProfileDto | null;
  email: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | undefined;
  refetchProfile: () => void;
  /** True when GET /api/profile returned 401 (session expired). */
  requireAuth: boolean;
}

/**
 * Hook for the /account view. Fetches profile (GET /api/profile) on mount,
 * returns profile, email (from profile.email), loading/error state and refetchProfile.
 * On 401, sets requireAuth and can redirect to login (caller or hook can handle).
 */
export function useAccountView(): UseAccountViewReturn {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [requireAuth, setRequireAuth] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (typeof window === "undefined") return;

    setIsLoading(true);
    setIsError(false);
    setErrorMessage(undefined);
    setRequireAuth(false);

    try {
      const response = await fetch("/api/profile", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        setRequireAuth(true);
        setErrorMessage("Sesja wygasła. Zaloguj się ponownie.");
        setIsError(true);
        redirectToLoginWithRedirect(window.location.pathname + window.location.search);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrorMessage((body.error as string) || "Nie udało się załadować profilu.");
        setIsError(true);
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as ProfileDto;
      setProfile(data);
      setIsError(false);
      setErrorMessage(undefined);
    } catch {
      setErrorMessage("Błąd połączenia. Sprawdź sieć i spróbuj ponownie.");
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const email = profile?.email ?? null;

  return {
    profile,
    email,
    isLoading,
    isError,
    errorMessage,
    refetchProfile: fetchProfile,
    requireAuth,
  };
}
