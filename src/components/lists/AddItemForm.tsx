import type { FC, SubmitEvent } from "react";
import { useRef } from "react";

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
      // Po sukcesie wracamy focusem do inputu, aby przyspieszyć pracę w sklepie.
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
  });

  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  const handleFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    void handleSubmit();
  };

  const isDisabled = disabled || isSubmitting;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-2" aria-label="Dodawanie produktu do listy">
      <div className="flex gap-2">
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
          className="flex-1 rounded-full border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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
