import type { FC, FormEvent } from "react";
import { useCallback, useState } from "react";
import ErrorSummary from "../ErrorSummary";

const RegisterForm: FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      const trimmedEmail = email.trim();
      const trimmedPassword = password;
      const trimmedConfirm = confirmPassword;

      const nextFieldErrors: typeof fieldErrors = {};

      if (!trimmedEmail) {
        nextFieldErrors.email = "Podaj adres e-mail.";
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
        nextFieldErrors.email = "Podaj poprawny adres e-mail.";
      }

      if (!trimmedPassword) {
        nextFieldErrors.password = "Podaj hasło.";
      } else if (trimmedPassword.length < 6 || trimmedPassword.length > 72) {
        nextFieldErrors.password = "Hasło musi mieć od 6 do 72 znaków.";
      }

      if (!trimmedConfirm) {
        nextFieldErrors.confirmPassword = "Potwierdź hasło.";
      } else if (trimmedConfirm !== trimmedPassword) {
        nextFieldErrors.confirmPassword = "Hasła muszą być takie same.";
      }

      setFieldErrors(nextFieldErrors);

      if (Object.keys(nextFieldErrors).length > 0) {
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
        });

        if (!response.ok) {
          let message = "Rejestracja nie powiodła się. Spróbuj ponownie.";
          try {
            const data: { error?: string; details?: string } = await response.json();
            if (data.error) {
              message = data.error;
            }
          } catch {
            // ignore parse error
          }
          setError(message);
          setIsSubmitting(false);
          return;
        }

        // Po udanej rejestracji backend tworzy profil i ustawia sesję.
        // Przekierowujemy użytkownika do list.
        window.location.href = "/lists";
      } catch {
        setError("Wystąpił błąd połączenia. Spróbuj ponownie.");
        setIsSubmitting(false);
      }
    },
    [email, password, confirmPassword, isSubmitting, fieldErrors]
  );

  return (
    <form className="space-y-4" aria-label="Formularz rejestracji" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-invalid={fieldErrors.email ? "true" : "false"}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-xs text-destructive">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Hasło
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-invalid={fieldErrors.password ? "true" : "false"}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
        {fieldErrors.password && (
          <p id="password-error" className="text-xs text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Powtórz hasło
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
        {isSubmitting ? "Zakładanie konta..." : "Załóż konto"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Masz już konto?{" "}
        <a href="/auth/login" className="font-medium text-primary hover:text-primary/90">
          Zaloguj się
        </a>
      </p>

      <ErrorSummary message={error} />
    </form>
  );
};

export default RegisterForm;
