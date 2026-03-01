import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type { AddItemFormValues } from "../../types";

const addItemSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Nazwa produktu jest wymagana").max(50, "Nazwa może mieć maks. 50 znaków")),
});

export interface UseAddItemFormOptions {
  onSubmitName(name: string): Promise<void> | void;
}

export function useAddItemForm(options: UseAddItemFormOptions) {
  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: "",
    },
  });

  const [serverError, setServerError] = useState<string | undefined>();

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(undefined);

    const trimmedName = values.name.trim();
    if (!trimmedName) {
      form.setError("name", { type: "manual", message: "Nazwa produktu jest wymagana" });
      return;
    }

    try {
      await options.onSubmitName(trimmedName);
      form.reset(
        {
          name: "",
        },
        {
          keepIsSubmitted: false,
          keepTouched: false,
        }
      );
    } catch (err) {
      if (err instanceof Error && err.message) {
        setServerError(err.message);
        return;
      }
      setServerError("Nie udało się dodać produktu. Spróbuj ponownie.");
    }
  });

  return {
    form,
    handleSubmit,
    serverError,
  };
}
