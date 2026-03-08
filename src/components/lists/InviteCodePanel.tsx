import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";

import type { InviteCodeSummaryDto } from "../../types";

interface InviteCodePanelProps {
  listId: string;
}

interface InvitesResponseBody {
  data: InviteCodeSummaryDto[];
}

const InviteCodePanel: FC<InviteCodePanelProps> = ({ listId }) => {
  const [activeInvite, setActiveInvite] = useState<InviteCodeSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const resetCopyState = () => {
    setCopiedCode(false);
    setCopiedLink(false);
  };

  const buildJoinUrl = (code: string): string => {
    if (typeof window === "undefined") {
      return `/join?code=${encodeURIComponent(code)}`;
    }
    const origin = window.location.origin.replace(/\/$/, "");
    return `${origin}/join?code=${encodeURIComponent(code)}`;
  };

  const loadInvites = useCallback(async () => {
    if (!listId) return;

    setIsLoading(true);
    setIsError(false);
    setErrorMessage(undefined);
    resetCopyState();

    try {
      const response = await fetch(`/api/lists/${listId}/invites?active_only=true`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/login?redirect=${redirect}`;
        return;
      }

      if (response.status === 403) {
        setIsError(true);
        setErrorMessage("Nie masz uprawnień do zarządzania zaproszeniami dla tej listy.");
        setIsLoading(false);
        return;
      }

      if (response.status === 404) {
        setIsError(true);
        setErrorMessage("Lista nie istnieje lub nie masz do niej dostępu.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        setIsError(true);
        setErrorMessage("Nie udało się pobrać kodów zaproszeń. Spróbuj ponownie.");
        setIsLoading(false);
        return;
      }

      const body = (await response.json()) as InvitesResponseBody;
      const firstActive = body.data?.[0] ?? null;
      setActiveInvite(firstActive);
      setIsLoading(false);
    } catch {
      setIsError(true);
      setErrorMessage("Wystąpił błąd połączenia podczas pobierania zaproszeń. Spróbuj ponownie.");
      setIsLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleGenerateInvite = async () => {
    if (!listId || isGenerating) return;

    setIsGenerating(true);
    setIsError(false);
    setErrorMessage(undefined);
    resetCopyState();

    try {
      const response = await fetch(`/api/lists/${listId}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/login?redirect=${redirect}`;
        return;
      }

      if (response.status === 403) {
        setIsError(true);
        setErrorMessage("Tylko właściciel listy może generować nowe kody zaproszeń.");
        setIsGenerating(false);
        return;
      }

      if (response.status === 404) {
        setIsError(true);
        setErrorMessage("Lista nie istnieje lub nie masz do niej dostępu.");
        setIsGenerating(false);
        return;
      }

      if (response.status === 400) {
        try {
          const body = (await response.json()) as { error?: string } | null;
          setIsError(true);
          setErrorMessage(
            body?.error ?? "Nie udało się wygenerować nowego kodu zaproszenia. Spróbuj ponownie za kilka minut."
          );
        } catch {
          setIsError(true);
          setErrorMessage("Nie udało się wygenerować nowego kodu zaproszenia. Spróbuj ponownie później.");
        }
        setIsGenerating(false);
        return;
      }

      if (!response.ok) {
        setIsError(true);
        setErrorMessage("Wystąpił błąd podczas generowania kodu zaproszenia. Spróbuj ponownie.");
        setIsGenerating(false);
        return;
      }

      // Po udanym wygenerowaniu po prostu przeładuj aktywne kody, aby odświeżyć panel.
      await loadInvites();
    } catch {
      setIsError(true);
      setErrorMessage("Wystąpił błąd połączenia. Sprawdź sieć i spróbuj ponownie.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!activeInvite?.code) return;
    resetCopyState();
    try {
      await navigator.clipboard.writeText(activeInvite.code);
      setCopiedCode(true);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleCopyLink = async () => {
    if (!activeInvite?.code) return;
    resetCopyState();
    try {
      const url = buildJoinUrl(activeInvite.code);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
    } catch {
      setCopiedLink(false);
    }
  };

  const expiresLabel =
    activeInvite?.expires_at != null ? new Date(activeInvite.expires_at).toLocaleString() : undefined;

  return (
    <section aria-label="Zaproszenia do listy" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Zaproszenia</h2>
        <button
          type="button"
          onClick={handleGenerateInvite}
          disabled={isGenerating}
          className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? "Generowanie..." : "Generuj kod"}
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
          Ładowanie aktualnego kodu zaproszenia...
        </div>
      ) : isError ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive"
          role="alert"
        >
          {errorMessage ?? "Nie udało się załadować zaproszeń. Spróbuj ponownie później."}
        </div>
      ) : !activeInvite ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4 text-xs text-muted-foreground">
          Brak aktywnego kodu zaproszenia. Kliknij „Generuj kod”, aby utworzyć nowy kod i zaprosić bliskich do
          współdzielenia listy.
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary/80">
                Aktywny kod zaproszenia
              </p>
              <p className="mt-1 text-[13px] text-foreground">Udostępnij ten kod, aby zaprosić kogoś do tej listy.</p>
            </div>
            <div className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
              Wygasa: {expiresLabel ?? "nieznana data"}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex min-w-[96px] justify-center rounded-lg bg-muted px-3 py-1.5 font-mono text-lg font-semibold tracking-[0.3em] text-foreground"
                aria-label="Kod zaproszenia"
              >
                {activeInvite.code}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center justify-center rounded-full border border-input bg-background px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                {copiedCode ? "Skopiowano kod" : "Kopiuj kod"}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center rounded-full border border-input bg-background px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                {copiedLink ? "Skopiowano link" : "Kopiuj link"}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Osoba z tym kodem wejdzie na stronę <span className="font-mono text-xs text-foreground">/join</span>,
            zaloguje się i dołączy jako <span className="font-medium text-foreground">edytor</span>. Kod jest
            jednorazowy i wygasa automatycznie.
          </p>
        </div>
      )}
    </section>
  );
};

export default InviteCodePanel;
