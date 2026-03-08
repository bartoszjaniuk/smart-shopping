import { useState } from "react";

import type { JoinByInviteCommand, JoinByInviteResponseDto, JoinViewFormValues, JoinViewViewModel } from "../../types";

export interface UseJoinByCodeOptions {
  initialCode?: string;
  /** Optional toast callback for success/error messages. */
  toast?(message: string, type: "success" | "error"): void;
  onSuccess?(response: JoinByInviteResponseDto): void;
}

export interface UseJoinByCodeResult {
  viewModel: JoinViewViewModel;
  setCode(code: string): void;
  submit(): Promise<void>;
}

const CODE_REGEX = /^[A-Z0-9]{6}$/;

const normalizeCode = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return normalized || undefined;
};

const normalizeInput = (value: string): string => {
  return normalizeCode(value) ?? "";
};

const validateCode = (rawCode: string): string | null => {
  const value = rawCode.trim().toUpperCase();

  if (!value) {
    return "Kod jest wymagany.";
  }

  if (value.length !== 6) {
    return "Kod powinien składać się z 6 liter lub cyfr.";
  }

  if (!CODE_REGEX.test(value)) {
    return "Kod powinien składać się z 6 liter lub cyfr.";
  }

  return null;
};

async function joinByCode(command: JoinByInviteCommand): Promise<JoinByInviteResponseDto> {
  console.log("[useJoinByCode] Sending join request", { code: command.code });
  const response = await fetch("/api/invites/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    console.error("[useJoinByCode] Non-OK response from /api/invites/join", {
      status: response.status,
      statusText: response.statusText,
    });
    let error: string | undefined;
    try {
      const data = (await response.json()) as { error?: string } | null;
      error = data?.error;
    } catch {
      // ignore parse error and use generic message below
    }

    if (response.status === 400 || response.status === 404) {
      throw new Error(error ?? "Ten kod jest nieprawidłowy lub wygasł. Poproś właściciela listy o nowy kod.");
    }

    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }

    throw new Error(error ?? "Coś poszło nie tak. Spróbuj ponownie za chwilę.");
  }

  const json = (await response.json()) as JoinByInviteResponseDto;
  console.log("[useJoinByCode] join request succeeded", { listId: json.list_id, listName: json.list_name });
  return json;
}

export function useJoinByCode(options: UseJoinByCodeOptions = {}): UseJoinByCodeResult {
  const { toast } = options;
  const [form, setForm] = useState<JoinViewFormValues>({
    code: normalizeInput(options.initialCode ?? ""),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const setCode = (next: string) => {
    setForm((prev) => ({
      ...prev,
      code: normalizeInput(next),
    }));
    if (errorMessage) {
      setErrorMessage(undefined);
      setIsError(false);
    }
  };

  const submit = async () => {
    const validationError = validateCode(form.code);
    if (validationError) {
      setErrorMessage(validationError);
      setIsError(true);
      return;
    }

    const normalizedCode = form.code.trim().toUpperCase();

    setIsSubmitting(true);
    setIsError(false);
    setErrorMessage(undefined);

    try {
      console.log("[useJoinByCode] submit started", { normalizedCode });
      const result = await joinByCode({ code: normalizedCode });
      setIsSuccess(true);
      toast?.(`Dołączono do listy „${result.list_name}”`, "success");
      options.onSuccess?.(result);
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        const url = new URL(window.location.href);
        const urlCode = url.searchParams.get("code") ?? normalizedCode;
        const redirectTarget = `/join?code=${encodeURIComponent(urlCode)}`;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(redirectTarget)}`;
        return;
      }

      if (err instanceof Error && err.message) {
        setErrorMessage(err.message);
        setIsError(true);
        if (err.message !== "Kod jest wymagany.") {
          toast?.(err.message, "error");
        }
        return;
      }

      setErrorMessage("Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.");
      setIsError(true);
      toast?.("Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    viewModel: {
      form,
      isSubmitting,
      isSuccess,
      isError,
      errorMessage,
      initialCode: options.initialCode,
    },
    setCode,
    submit,
  };
}
