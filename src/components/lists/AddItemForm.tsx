import type { FC, SubmitEvent } from "react";
import { useEffect, useRef } from "react";

import ErrorSummary from "../ErrorSummary";
import { useAddItemForm } from "../hooks/useAddItemForm";

interface AddItemFormProps {
  disabled?: boolean;
  onAddItem(name: string): Promise<void> | void;
}

const AddItemForm: FC<AddItemFormProps> = ({ disabled, onAddItem }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { form, handleSubmit, serverError } = useAddItemForm({
    async onSubmitName(name: string) {
      await onAddItem(name);
    },
  });

  const {
    register,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (isSubmitSuccessful && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSubmitSuccessful]);

  const handleFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    handleSubmit();
  };

  const isDisabled = disabled || isSubmitting;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-2" aria-label="Dodawanie produktu do listy">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="flex-1">
          <input
            {...register("name")}
            ref={(node) => {
              register("name").ref(node);
              inputRef.current = node;
            }}
            type="text"
            autoComplete="off"
            placeholder={isDisabled ? "Lista tylko do odczytu" : "Dodaj produkt, np. Mleko 2%"}
            aria-invalid={errors.name ? "true" : "false"}
            disabled={isDisabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isDisabled}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:px-4 md:py-2"
        >
          {isSubmitting ? "Dodawanie..." : "Dodaj"}
        </button>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">Enter = dodaj, maks. 50 znaków.</p>
        {errors.name?.message && (
          <p className="text-xs text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>
      <ErrorSummary message={serverError} className="text-xs" />
    </form>
  );
};

export default AddItemForm;
