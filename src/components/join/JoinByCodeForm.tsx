import type { ChangeEvent, FC } from "react";

import { useJoinByCode } from "../hooks/useJoinByCode";

interface JoinByCodeFormProps {
  initialCode?: string;
}

const JoinByCodeForm: FC<JoinByCodeFormProps> = ({ initialCode }) => {
  const { viewModel, setCode, submit } = useJoinByCode({
    initialCode,
    onSuccess(response) {
      const listId = response.list_id;
      if (!listId) {
        // Bezpieczny fallback – nie powinniśmy tu trafić przy poprawnym API.
        window.location.reload();
        return;
      }

      // eslint-disable-next-line react-compiler/react-compiler
      window.location.href = `/lists/${encodeURIComponent(listId)}`;
    },
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCode(event.target.value ?? "");
  };

  const handleSubmit = async (event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    await submit();
  };

  const isDisabled = viewModel.isSubmitting || !viewModel.form.code.trim();
  const errorMessage = viewModel.errorMessage;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Dołączanie do listy kodem">
      <div className="space-y-2">
        <label htmlFor="join-code" className="block text-xs font-medium text-foreground">
          Kod zaproszenia
        </label>
        <input
          id="join-code"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          maxLength={6}
          value={viewModel.form.code}
          onChange={handleChange}
          aria-invalid={errorMessage ? "true" : "false"}
          aria-describedby={errorMessage ? "join-code-error" : undefined}
          className={`w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.3em] shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            errorMessage ? "border-destructive" : "border-input"
          }`}
          placeholder="ABC123"
        />
        <p className="text-[11px] text-muted-foreground">
          Kod składa się z 6 liter lub cyfr. Kod jest ważny 24 godziny.
        </p>
        {errorMessage && (
          <p id="join-code-error" className="text-xs text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isDisabled}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {viewModel.isSubmitting ? "Dołączanie..." : "Dołącz do listy"}
      </button>

      <p className="text-[11px] text-muted-foreground">
        Aby dołączyć do listy, musisz być zalogowany. Jeśli otworzyłeś ten link z zaproszeniem jako niezalogowany, po
        zalogowaniu wrócisz automatycznie do tego ekranu.
      </p>
    </form>
  );
};

export default JoinByCodeForm;
