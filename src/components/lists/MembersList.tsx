import type { FC } from "react";

import type { ListMemberDto, MembershipRole } from "../../types";
import MemberRow from "./MemberRow";

interface MembersListProps {
  members: ListMemberDto[];
  currentUserId: string;
  myRole: MembershipRole;
  onRemoveMember(userId: string): void;
  onLeaveList(): void;
  isRemovingUserId?: string | null;
}

const MembersList: FC<MembersListProps> = ({
  members,
  currentUserId,
  myRole,
  onRemoveMember,
  onLeaveList,
  isRemovingUserId = null,
}) => {
  return (
    <section aria-labelledby="members-heading">
      <h2 id="members-heading" className="mb-2 text-sm font-semibold tracking-tight text-foreground">
        Uczestnicy
      </h2>
      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Brak uczestników
        </p>
      ) : (
        <ul className="rounded-xl border border-border bg-card" aria-label="Lista uczestników">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isCurrentUser={member.user_id === currentUserId}
              myRole={myRole}
              onRemoveMember={onRemoveMember}
              onLeaveList={onLeaveList}
              isRemoving={isRemovingUserId === member.user_id}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default MembersList;
