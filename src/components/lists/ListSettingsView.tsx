import type { FC } from "react";
import { useEffect, useState } from "react";

import type { ListDetailDto } from "../../types";
import { DEFAULT_LIST_COLOR } from "../../types";
import ListForm from "./ListForm";

interface ListSettingsViewProps {
  listId: string;
  onOpenDeleteListModal?: () => void;
}

type LoadState = "idle" | "loading" | "success" | "not-found" | "forbidden" | "error";

const ListSettingsView: FC<ListSettingsViewProps> = ({ listId, onOpenDeleteListModal }) => {
  const [state, setState] = useState<LoadState>("idle");
  const [list, setList] = useState<ListDetailDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setState("loading");
      setErrorMessage(undefined);
      setSuccessMessage(undefined);

      try {
        const response = await fetch(`/api/lists/${listId}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 404) {
          if (!isMounted) return;
          setState("not-found");
          setErrorMessage("Lista nie istnieje lub nie masz do niej dostępu.");
          return;
        }

        if (response.status === 403) {
          if (!isMounted) return;
          setState("forbidden");
          setErrorMessage("Nie masz uprawnień do edycji tej listy.");
          return;
        }

        if (!response.ok) {
          if (!isMounted) return;
          setState("error");
          setErrorMessage("Nie udało się załadować listy. Spróbuj ponownie.");
          return;
        }

        const data = (await response.json()) as ListDetailDto;
        if (!isMounted) return;

        if (data.my_role !== "owner") {
          setState("forbidden");
          setErrorMessage("Nie masz uprawnień do edycji tej listy.");
          return;
        }

        setList(data);
        setState("success");
      } catch {
        if (!isMounted) return;
        setState("error");
        setErrorMessage("Wystąpił nieoczekiwany błąd podczas ładowania listy.");
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [listId]);

  const handleSuccessUpdate = (updated: ListDetailDto) => {
    setList(updated);
    setSuccessMessage("Zmiany zostały zapisane.");
    setTimeout(() => {
      setSuccessMessage(undefined);
    }, 2500);
  };

  if (state === "loading" || state === "idle") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Trwa ładowanie ustawień listy...</p>
      </div>
    );
  }

  if (state === "not-found" || state === "forbidden" || state === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          {errorMessage ?? "Nie udało się załadować ustawień listy."}
        </p>
        <a
          href="/lists"
          className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          Wróć do list
        </a>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <section aria-label="Ustawienia listy" className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Ustawienia listy</h2>
        <p className="text-sm text-muted-foreground">
          Zmień nazwę listy i jej kolor. Tylko właściciel może edytować te ustawienia.
        </p>
        <p className="text-xs text-muted-foreground">
          Aktualna lista: <span className="font-medium">{list.name}</span>
        </p>
        {successMessage && <p className="text-xs font-medium text-emerald-700">{successMessage}</p>}
      </header>

      <ListForm
        mode="edit"
        listId={list.id}
        initialValues={{
          name: list.name,
          color: list.color ?? DEFAULT_LIST_COLOR,
        }}
        onSuccessUpdate={handleSuccessUpdate}
      />

      <section
        aria-label="Strefa niebezpieczna"
        className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      >
        <h3 className="text-sm font-semibold text-destructive">Strefa niebezpieczna</h3>
        <p className="text-xs text-destructive">
          Usunięcie listy spowoduje trwałe usunięcie wszystkich produktów i zaproszeń powiązanych z tą listą. Tej
          operacji nie można cofnąć.
        </p>
        <button
          type="button"
          onClick={onOpenDeleteListModal}
          className="inline-flex items-center justify-center rounded-full border border-destructive bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive/20"
        >
          Usuń listę
        </button>
      </section>
    </section>
  );
};

export default ListSettingsView;
