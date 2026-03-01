import type { FormEvent, FC } from "react";
import { useCallback, useState } from "react";
import ErrorSummary from "../ErrorSummary";

interface LoginFormProps {
  redirectUrl?: string;
  message?: string;
}

const LoginForm: FC<LoginFormProps> = ({ redirectUrl, message }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError("Podaj adres e-mail.");
        return;
      }

      if (!password) {
        setError("Podaj hasło.");
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });

        if (!response.ok) {
          let message = "Nieprawidłowy e-mail lub hasło.";
          try {
            const data: { error?: string; details?: string } = await response.json();
            if (data.error) {
              message = data.error;
            }
          } catch {
            // ignore JSON parse errors and fall back to generic message
          }
          setError(message);
          setIsSubmitting(false);
          return;
        }

        const target =
          redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/lists";
        window.location.href = target;
      } catch {
        setError("Wystąpił błąd połączenia. Spróbuj ponownie.");
        setIsSubmitting(false);
      }
    },
    [email, password, redirectUrl, isSubmitting]
  );

  return (
    <form className="space-y-4" aria-label="Formularz logowania" onSubmit={handleSubmit}>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

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
          required
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Hasło
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Logowanie..." : "Zaloguj"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <a href="/auth/forgot-password" className="text-muted-foreground hover:text-foreground">
          Nie pamiętasz hasła?
        </a>
        <a href="/auth/register" className="font-medium text-primary hover:text-primary/90">
          Załóż konto
        </a>
      </div>

      <ErrorSummary message={error} />
    </form>
  );
};

export default LoginForm;
