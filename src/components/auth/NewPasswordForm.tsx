import type { FC, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import ErrorSummary from "../ErrorSummary";
import { createSupabaseBrowserClient } from "../../db/supabase.client";

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 72;

const NewPasswordForm: FC = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initRecoverySession() {
      try {
        const client = createSupabaseBrowserClient();
        if (cancelled) {
          return;
        }
        setSupabase(client);

        const rawHash = window.location.hash;
        const hash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (!accessToken || !refreshToken || type !== "recovery") {
          // Jeśli nie mamy wymaganych parametrów w URL, przekierowujemy na landing.
          window.location.replace("/");
          return;
        }

        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error && !cancelled) {
          setTokenError("Link wygasł lub jest nieprawidłowy.");
        }
      } catch {
        if (!cancelled) {
          setTokenError("Link wygasł lub jest nieprawidłowy.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isSubmitting || isLoading || tokenError || !supabase) {
        return;
      }

      const errors: typeof fieldErrors = {};

      if (!newPassword) {
        errors.newPassword = "Podaj nowe hasło.";
      } else if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
        errors.newPassword = `Hasło musi mieć od ${PASSWORD_MIN_LENGTH} do ${PASSWORD_MAX_LENGTH} znaków.`;
      }

      if (!confirmPassword) {
        errors.confirmPassword = "Potwierdź hasło.";
      } else if (confirmPassword !== newPassword) {
        errors.confirmPassword = "Hasła muszą być takie same.";
      }

      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        return;
      }

      setFormError(null);
      setIsSubmitting(true);

      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
          setFormError("Nie udało się ustawić nowego hasła. Spróbuj ponownie.");
          setIsSubmitting(false);
          return;
        }

        window.location.href = "/lists";
      } catch {
        setFormError("Wystąpił błąd połączenia. Spróbuj ponownie.");
        setIsSubmitting(false);
      }
    },
    [confirmPassword, isLoading, isSubmitting, newPassword, supabase, tokenError, fieldErrors]
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Ładowanie linku resetującego hasło…</p>;
  }

  if (tokenError) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {tokenError}
        </div>
        <a
          href="/auth/login"
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Wróć do logowania
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-4" aria-label="Formularz ustawienia nowego hasła" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1">
        <label htmlFor="new-password" className="text-sm font-medium">
          Nowe hasło
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-invalid={fieldErrors.newPassword ? "true" : "false"}
            aria-describedby={fieldErrors.newPassword ? "new-password-error" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-2 flex items-center justify-center text-muted-foreground"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
          >
            <span className="sr-only">{showPassword ? "Ukryj hasło" : "Pokaż hasło"}</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {showPassword ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                  <path d="M16.24 16.24A8.46 8.46 0 0 1 12 18c-5 0-9-4-9-6a9.74 9.74 0 0 1 2.88-3.88" />
                  <path d="M9.88 5.46A8.46 8.46 0 0 1 12 6c5 0 9 4 9 6a9.74 9.74 0 0 1-1.64 3.19" />
                </>
              ) : (
                <>
                  <path d="M2 12s2.73-6 10-6 10 6 10 6-2.73 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {fieldErrors.newPassword && (
          <p id="new-password-error" className="text-xs text-destructive">
            {fieldErrors.newPassword}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Powtórz nowe hasło
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
            aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            className="absolute inset-y-0 right-2 flex items-center justify-center text-muted-foreground"
            aria-pressed={showConfirmPassword}
            aria-label={showConfirmPassword ? "Ukryj hasło" : "Pokaż hasło"}
          >
            <span className="sr-only">{showConfirmPassword ? "Ukryj hasło" : "Pokaż hasło"}</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {showConfirmPassword ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                  <path d="M16.24 16.24A8.46 8.46 0 0 1 12 18c-5 0-9-4-9-6a9.74 9.74 0 0 1 2.88-3.88" />
                  <path d="M9.88 5.46A8.46 8.46 0 0 1 12 6c5 0 9 4 9 6a9.74 9.74 0 0 1-1.64 3.19" />
                </>
              ) : (
                <>
                  <path d="M2 12s2.73-6 10-6 10 6 10 6-2.73 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p id="confirm-password-error" className="text-xs text-destructive">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Ustawianie hasła..." : "Ustaw hasło"}
      </button>

      <ErrorSummary message={formError} />
    </form>
  );
};

export default NewPasswordForm;
