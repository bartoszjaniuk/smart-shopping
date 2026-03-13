import type { FC } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const editItemSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Nazwa produktu jest wymagana").max(50, "Nazwa może mieć maks. 50 znaków")),
});

type EditItemFormValues = z.infer<typeof editItemSchema>;

interface EditItemSheetProps {
  open: boolean;
  itemId: string | null;
  initialName: string;
  onSave(name: string): void | Promise<void>;
  onClose(): void;
}

const EditItemSheet: FC<EditItemSheetProps> = ({ open, initialName, onSave, onClose }) => {
  const form = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema),
    defaultValues: { name: initialName },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (open && initialName !== undefined) {
      reset({ name: initialName });
    }
  }, [open, initialName, reset]);

  if (!open) {
    return null;
  }

  const handleFormSubmit = (event: React.BaseSyntheticEvent) => {
    event.preventDefault();
    void handleSubmit(async (values) => {
      await onSave(values.name.trim());
      onClose();
    })();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:px-4 md:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-item-sheet-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-sm"
        aria-label="Zamknij"
      />
      <div className="relative flex h-full w-full max-h-dvh flex-col rounded-t-md border border-b-0 bg-card px-5 py-5 text-card-foreground shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-md md:border-b md:overflow-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-item-sheet-title" className="text-base font-semibold tracking-tight">
              Edytuj produkt
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Zmień nazwę produktu. Kategoria może być edytowana w kolejnych wersjach.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Zamknij edycję produktu"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto md:min-h-0">
          <form onSubmit={handleFormSubmit} className="space-y-4" aria-label="Edycja produktu">
            <div className="space-y-2">
              <label htmlFor="edit-item-name" className="block text-sm font-medium text-foreground">
                Nazwa produktu
              </label>
              <input
                id="edit-item-name"
                type="text"
                {...register("name")}
                autoComplete="off"
                placeholder="Np. Mleko 2%"
                aria-invalid={errors.name ? "true" : "false"}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {errors.name?.message && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Zapisywanie..." : "Zapisz"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditItemSheet;
