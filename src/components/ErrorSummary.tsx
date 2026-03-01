import type { FC } from "react";

interface ErrorSummaryProps {
  message?: string | null;
  className?: string;
}

const ErrorSummary: FC<ErrorSummaryProps> = ({ message, className }) => {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={
        "mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive " +
        (className ?? "")
      }
    >
      {message}
    </div>
  );
};

export default ErrorSummary;
