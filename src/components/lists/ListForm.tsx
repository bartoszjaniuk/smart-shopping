import type { FC, FormEvent } from "react";

import ErrorSummary from "../ErrorSummary";
import PastelColorPicker from "./PastelColorPicker";
import { PASTEL_LIST_COLORS } from "../../lib/constants/listColors";
import type { ListFormProps } from "../../types";
import { useListForm } from "../hooks/useListForm";

const ListForm: FC<ListFormProps> = (props) => {
  const { mode, initialValues, plan, listId, onSuccessCreate, onSuccessUpdate, onCancel } = props;

  const { form, handleSubmit, serverError, hasReachedListLimit } = useListForm({
    mode,
    initialValues,
    plan,
    listId,
    onSuccessCreate,
    onSuccessUpdate,
  });

  const {
    register,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    watch,
  } = form;

  const currentColor = watch("color");

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };

  const title = mode === "create" ? "Nowa lista" : "Ustawienia listy";
  const primaryLabel = mode === "create" ? "Utwórz listę" : "Zapisz zmiany";

  const isPrimaryDisabled = isSubmitting || (mode === "edit" && !isDirty);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6" aria-label={title}>
      <div className="space-y-2">
        <label htmlFor="list-name" className="block text-sm font-medium text-foreground">
          Nazwa listy
        </label>
        <input
          id="list-name"
          type="text"
          {...register("name")}
          autoComplete="off"
          placeholder="Np. Zakupy na weekend"
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-muted-foreground">Maks. 100 znaków.</p>
        {errors.name?.message && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Kolor listy</p>
        <p className="text-xs text-muted-foreground">
          Wybierz pastelowy kolor, który pomoże szybko odróżnić listę na dashboardzie.
        </p>

        <PastelColorPicker
          value={currentColor}
          options={PASTEL_LIST_COLORS}
          disabled={isSubmitting}
          onChange={(value) => {
            setValue("color", value, { shouldDirty: true, shouldTouch: true });
          }}
        />

        {errors.color?.message && <p className="text-xs text-destructive">{errors.color.message}</p>}

        {hasReachedListLimit && (
          <p className="text-xs font-medium text-amber-700">
            Osiągnąłeś limit list w planie Basic. Aby utworzyć kolejne listy, rozważ przejście na plan Premium.
          </p>
        )}
      </div>

      <ErrorSummary message={serverError} />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPrimaryDisabled}
          className="inline-flex min-w-[140px] items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Zapisywanie..." : primaryLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Anuluj
          </button>
        )}
      </div>
    </form>
  );
};

export default ListForm;
