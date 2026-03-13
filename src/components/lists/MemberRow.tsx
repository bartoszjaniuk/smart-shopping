import type { FC } from "react";

import type { ListMemberDto, MembershipRole } from "../../types";

interface MemberRowProps {
  member: ListMemberDto;
  isCurrentUser: boolean;
  myRole: MembershipRole;
  onRemoveMember(userId: string): void;
  onLeaveList(): void;
  isRemoving?: boolean;
}

const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Właściciel",
  editor: "Edytor",
};

const MemberRow: FC<MemberRowProps> = ({
  member,
  isCurrentUser,
  myRole,
  onRemoveMember,
  onLeaveList,
  isRemoving = false,
}) => {
  const displayName = member.email?.trim() || "Użytkownik";
  const canRemoveOther = myRole === "owner" && !isCurrentUser;
  const canLeave = isCurrentUser;

  const handleRemove = () => {
    if (isRemoving) return;
    onRemoveMember(member.user_id);
  };

  const handleLeave = () => {
    if (isRemoving) return;
    onLeaveList();
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-3 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="truncate text-sm font-medium text-foreground" title={displayName}>
          {displayName}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            aria-label={`Rola: ${ROLE_LABELS[member.role]}`}
          >
            {ROLE_LABELS[member.role]}
          </span>
          {isCurrentUser && (
            <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Ty
            </span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canRemoveOther && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            aria-label="Usuń użytkownika z listy"
            className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-destructive/50 bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Usuń
          </button>
        )}
        {canLeave && (
          <button
            type="button"
            onClick={handleLeave}
            disabled={isRemoving}
            aria-label="Opuść listę"
            className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Opuść listę
          </button>
        )}
      </div>
    </li>
  );
};

export default MemberRow;
