import type { FC, FormEvent } from "react";
import { useCallback, useState } from "react";
import ErrorSummary from "../ErrorSummary";

const ResetPasswordRequestForm: FC = () => {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setFieldError("Podaj adres e-mail.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
        setFieldError("Podaj poprawny adres e-mail.");
        return;
      }

      setFieldError(null);
      setError(null);
      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: trimmedEmail }),
        });

        if (!response.ok) {
          let message = "Nie udało się wysłać linku resetującego. Spróbuj ponownie.";
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

        try {
          const data: { message?: string } = await response.json();
          setSentMessage(
            data.message ?? "Jeśli konto istnieje, wysłaliśmy link do resetowania hasła na podany adres e-mail."
          );
        } catch {
          setSentMessage("Jeśli konto istnieje, wysłaliśmy link do resetowania hasła na podany adres e-mail.");
        }

        setIsSubmitting(false);
      } catch {
        setError("Wystąpił błąd połączenia. Spróbuj ponownie.");
        setIsSubmitting(false);
      }
    },
    [email, isSubmitting]
  );

  if (sentMessage) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{sentMessage}</p>
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
    <form className="space-y-4" aria-label="Formularz resetu hasła" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-muted-foreground">
        Podaj adres e-mail powiązany z Twoim kontem. Jeśli konto istnieje, wyślemy instrukcję ustawienia nowego hasła.
      </p>

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
          aria-invalid={fieldError ? "true" : "false"}
          aria-describedby={fieldError ? "reset-email-error" : undefined}
        />
        {fieldError && (
          <p id="reset-email-error" className="text-xs text-destructive">
            {fieldError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Wysyłanie..." : "Wyślij link"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Pamiętasz hasło?{" "}
        <a href="/auth/login" className="font-medium text-primary hover:text-primary/90">
          Wróć do logowania
        </a>
      </p>

      <ErrorSummary message={error} />
    </form>
  );
};

export default ResetPasswordRequestForm;
