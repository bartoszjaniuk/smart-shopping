import type { FC } from "react";
import { useState, useCallback } from "react";

const ALLOWED_LOCALES = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
] as const;

export interface ProfileFormProps {
  initialLocale: string | null;
  onSuccess?: () => void;
  /** Optional toast for success/error. */
  toast?: (message: string, type: "success" | "error") => void;
}

const ProfileForm: FC<ProfileFormProps> = ({ initialLocale, onSuccess, toast }) => {
  const [preferredLocale, setPreferredLocale] = useState<string>(initialLocale ?? "pl");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>(undefined);

  const handleSubmit = useCallback(
    async (e: React.BaseSyntheticEvent) => {
      e.preventDefault();
      const value = preferredLocale.trim();
      if (value.length > 5) {
        setServerError("Nieprawidłowa wartość języka.");
        toast?.("Nieprawidłowa wartość języka.", "error");
        return;
      }
      const allowed = ALLOWED_LOCALES.some((o) => o.value === value);
      if (!allowed) {
        setServerError("Wybierz język z listy (Polski lub English).");
        toast?.("Wybierz język z listy.", "error");
        return;
      }

      setIsSubmitting(true);
      setServerError(undefined);

      try {
        const response = await fetch("/api/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ preferred_locale: value }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const msg = (body.error as string) || (body.details as string) || "Nie udało się zapisać.";
          setServerError(msg);
          toast?.(msg, "error");
          setIsSubmitting(false);
          return;
        }

        toast?.("Zapisano.", "success");
        onSuccess?.();
      } catch {
        setServerError("Błąd połączenia. Spróbuj ponownie.");
        toast?.("Błąd połączenia. Spróbuj ponownie.", "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [preferredLocale, onSuccess, toast]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Edycja profilu">
      <div className="space-y-2">
        <label htmlFor="profile-locale" className="block text-sm font-medium text-foreground">
          Język
        </label>
        <select
          id="profile-locale"
          value={preferredLocale}
          onChange={(e) => setPreferredLocale(e.target.value)}
          disabled={isSubmitting}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          aria-describedby={serverError ? "profile-locale-error" : undefined}
        >
          {ALLOWED_LOCALES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {serverError && (
          <p id="profile-locale-error" className="text-xs text-destructive" role="alert">
            {serverError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        aria-label="Zapisz język"
      >
        {isSubmitting ? "Zapisywanie…" : "Zapisz"}
      </button>
    </form>
  );
};

export default ProfileForm;
