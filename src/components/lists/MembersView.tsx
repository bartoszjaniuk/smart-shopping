import type { FC } from "react";
import { useState, useCallback } from "react";

import { useMembersView } from "../hooks/useMembersView";
import ConfirmLeaveListModal from "./ConfirmLeaveListModal";
import MembersList from "./MembersList";
import InviteCodePanel from "./InviteCodePanel";

interface MembersViewProps {
  listId: string;
}

const MembersView: FC<MembersViewProps> = ({ listId }) => {
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const {
    members,
    currentUserId,
    myRole,
    isLoadingList,
    isLoadingMembers,
    isError,
    errorMessage,
    isRemovingUserId,
    removeMember,
    leaveList,
  } = useMembersView(listId);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveModal(false);
    void leaveList();
  }, [leaveList]);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveModal(false);
  }, []);

  if (isLoadingList || isLoadingMembers) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Trwa ładowanie uczestników listy...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">{errorMessage ?? "Nie udało się załadować danych."}</p>
        <a
          href="/lists"
          className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          Wróć do list
        </a>
      </div>
    );
  }

  return (
    <section aria-label="Członkowie listy" className="space-y-6">
      <MembersList
        members={members}
        currentUserId={currentUserId}
        myRole={myRole}
        onRemoveMember={removeMember}
        onLeaveList={() => setShowLeaveModal(true)}
        isRemovingUserId={isRemovingUserId}
      />

      {myRole === "owner" && <InviteCodePanel listId={listId} />}

      <ConfirmLeaveListModal open={showLeaveModal} onConfirm={handleLeaveConfirm} onCancel={handleLeaveCancel} />
    </section>
  );
};

export default MembersView;
