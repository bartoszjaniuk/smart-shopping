import type { FC } from "react";
import { useState, useCallback, useEffect } from "react";

import { useAccountView } from "../hooks/useAccountView";
import { useLogout } from "../hooks/useLogout";
import AccountLayout from "./AccountLayout";
import PremiumFakeDoorModal from "./PremiumFakeDoorModal";

const AccountView: FC = () => {
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);

  const { logout, isLoggingOut } = useLogout();
  const { profile, email, isLoading, isError, errorMessage, refetchProfile } = useAccountView();

  const handleOpenPremiumModal = useCallback(() => {
    setIsPremiumModalOpen(true);
  }, []);

  const handleClosePremiumModal = useCallback(() => {
    setIsPremiumModalOpen(false);
  }, []);

  const handleProfileUpdated = useCallback(() => {
    refetchProfile();
  }, [refetchProfile]);

  // Przewinięcie do sekcji #plan przy wejściu z hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#plan" && !isLoading && profile) {
      const el = document.getElementById("plan");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isLoading, profile]);

  const renderContent = () => {
    if (isLoading && !profile) {
      return <p className="text-sm text-muted-foreground">Trwa ładowanie profilu…</p>;
    }
    if (isError && !profile) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{errorMessage ?? "Nie udało się załadować profilu."}</p>
          <button
            type="button"
            onClick={() => refetchProfile()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Odśwież
          </button>
        </div>
      );
    }
    return (
      <AccountLayout
        profile={profile}
        email={email}
        onProfileUpdated={handleProfileUpdated}
        onOpenPremiumModal={handleOpenPremiumModal}
        isLoading={isLoading}
      />
    );
  };

  return (
    <>
      <div className="space-y-4">{renderContent()}</div>

      <div className="my-6 flex flex-wrap items-center justify-start gap-2">
        <button
          type="button"
          onClick={() => void logout()}
          disabled={isLoggingOut}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
          aria-label="Wyloguj"
        >
          {isLoggingOut ? "Wylogowywanie…" : "Wyloguj"}
        </button>
      </div>

      <PremiumFakeDoorModal open={isPremiumModalOpen} onClose={handleClosePremiumModal} />
    </>
  );
};

export default AccountView;
