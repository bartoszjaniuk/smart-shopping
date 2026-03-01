import type { FC } from "react";

import type { RealtimeStatus } from "../../types";

interface RealtimeStatusIndicatorProps {
  status: RealtimeStatus;
}

const RealtimeStatusIndicator: FC<RealtimeStatusIndicatorProps> = ({ status }) => {
  const dotClassName =
    status === "online"
      ? "bg-emerald-500"
      : status === "offline"
        ? "bg-red-500"
        : status === "unavailable"
          ? "bg-orange-500"
          : "bg-blue-500";

  const label =
    status === "online"
      ? "Online – zmiany są synchronizowane na bieżąco."
      : status === "offline"
        ? "Offline – pracujesz na ostatnio zapisanych danych."
        : status === "unavailable"
          ? "Synchronizacja na żywo niedostępna. Lista odświeża się ręcznie."
          : status === "syncing"
            ? "Synchronizacja…"
            : "Łączenie z serwerem...";

  return (
    <div aria-label="Status połączenia" className="flex items-center gap-2 text-xs text-muted-foreground">
      <span aria-hidden="true" className={`inline-flex h-2.5 w-2.5 rounded-full animate-pulse ${dotClassName}`} />
      <span>{label}</span>
    </div>
  );
};

export default RealtimeStatusIndicator;
