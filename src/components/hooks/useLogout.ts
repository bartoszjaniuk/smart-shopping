import { useCallback, useState } from "react";

export interface UseLogoutReturn {
  logout: () => Promise<void>;
  isLoggingOut: boolean;
}

/**
 * Returns a logout function that POSTs to /api/auth/logout and redirects to /.
 * Does not depend on profile or any other API state.
 */
export function useLogout(): UseLogoutReturn {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok || response.status === 204) {
        window.location.href = "/";
        return;
      }
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  return { logout, isLoggingOut };
}
