import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { ListDto, ListDetailDto, ListFormMode, ListFormValues, PlanType } from "../../types";
import { DEFAULT_LIST_COLOR } from "../../types";
import { listFormSchema } from "../../lib/schemas/listForm";

interface UseListFormOptions {
  mode: ListFormMode;
  initialValues?: ListFormValues;
  plan?: PlanType;
  listId?: string;
  onSuccessCreate?(list: ListDto | ListDetailDto): void;
  onSuccessUpdate?(list: ListDetailDto): void;
}

export function useListForm(options: UseListFormOptions) {
  const form = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
    defaultValues: {
      name: options.initialValues?.name ?? "",
      color: options.initialValues?.color ?? DEFAULT_LIST_COLOR,
    },
  });

  const [serverError, setServerError] = useState<string | undefined>();
  const [hasReachedListLimit, setHasReachedListLimit] = useState(false);

  const applyValidationErrors = async (response: Response) => {
    try {
      const data = (await response.json()) as { error?: string; details?: string } | null;
      const details = data?.details;

      if (details) {
        const parts = details.split(";").map((part) => part.trim());
        for (const part of parts) {
          if (!part) continue;
          const [field, message] = part.split(":").map((segment) => segment.trim());
          if (field === "name" && message) {
            form.setError("name", { type: "server", message });
          } else if (field === "color" && message) {
            form.setError("color", { type: "server", message });
          }
        }
        if (!form.formState.errors.name && !form.formState.errors.color && data?.error) {
          setServerError(data.error);
        }
      } else if (data?.error) {
        setServerError(data.error);
      } else {
        setServerError("Wystąpił błąd walidacji danych. Sprawdź formularz i spróbuj ponownie.");
      }
    } catch {
      setServerError("Wystąpił błąd walidacji danych. Sprawdź formularz i spróbuj ponownie.");
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(undefined);
    setHasReachedListLimit(false);

    const payload = {
      name: values.name.trim(),
      color: values.color ?? DEFAULT_LIST_COLOR,
    };

    try {
      if (options.mode === "create") {
        const response = await fetch("/api/lists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 403) {
          setHasReachedListLimit(true);
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          setServerError(
            data?.error ?? "Osiągnięto limit list w planie Basic. Aby utworzyć kolejne listy, przejdź na plan Premium."
          );
          return;
        }

        if (response.status === 400) {
          await applyValidationErrors(response);
          return;
        }

        if (!response.ok) {
          setServerError("Nie udało się utworzyć listy. Spróbuj ponownie.");
          return;
        }

        const list = (await response.json()) as ListDto;
        options.onSuccessCreate?.(list);
        form.reset(
          {
            name: "",
            color: DEFAULT_LIST_COLOR,
          },
          { keepIsSubmitted: false, keepTouched: false }
        );
        return;
      }

      if (!options.listId) {
        setServerError("Brak identyfikatora listy. Odśwież stronę i spróbuj ponownie.");
        return;
      }

      const response = await fetch(`/api/lists/${options.listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: payload.name,
          color: payload.color,
        }),
      });

      if (response.status === 403) {
        setServerError("Nie masz uprawnień do edycji tej listy.");
        return;
      }

      if (response.status === 404) {
        setServerError("Lista nie istnieje lub nie masz do niej dostępu.");
        return;
      }

      if (response.status === 400) {
        await applyValidationErrors(response);
        return;
      }

      if (!response.ok) {
        setServerError("Nie udało się zapisać zmian. Spróbuj ponownie.");
        return;
      }

      const updated = (await response.json()) as ListDetailDto;
      options.onSuccessUpdate?.(updated);
    } catch {
      setServerError("Wystąpił nieoczekiwany błąd. Sprawdź połączenie i spróbuj ponownie.");
    }
  });

  return {
    form,
    handleSubmit,
    serverError,
    hasReachedListLimit,
  };
}
