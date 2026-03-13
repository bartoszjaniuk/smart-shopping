import type { FC } from "react";

import type { ProfileDto } from "../../types";
import ProfileForm from "./ProfileForm";
import PlanCard from "./PlanCard";

export interface AccountLayoutProps {
  profile: ProfileDto | null;
  email: string | null;
  onProfileUpdated?: () => void;
  onOpenPremiumModal?: () => void;
  isLoading?: boolean;
  /** Optional toast for ProfileForm success/error. */
  toast?: (message: string, type: "success" | "error") => void;
}

const AccountLayout: FC<AccountLayoutProps> = ({
  profile,
  email,
  onProfileUpdated,
  onOpenPremiumModal,
  isLoading,
  toast,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Trwa ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Podsumowanie: e-mail, plan, język */}
      {(email || profile) && (
        <div className="rounded-md border border-input bg-muted/30 p-4 text-sm">
          {email && (
            <p className="font-medium text-foreground">
              E-mail: <span className="text-muted-foreground">{email}</span>
            </p>
          )}
          {profile && (
            <>
              <p className="mt-1 font-medium text-foreground">
                Plan: <span className="text-muted-foreground">{profile.plan === "premium" ? "Premium" : "Basic"}</span>
              </p>
              <p className="mt-1 font-medium text-foreground">
                Język:{" "}
                <span className="text-muted-foreground">
                  {profile.preferred_locale === "en"
                    ? "English"
                    : profile.preferred_locale === "pl"
                      ? "Polski"
                      : (profile.preferred_locale ?? "—")}
                </span>
              </p>
            </>
          )}
        </div>
      )}

      {/* Sekcja: Profil */}
      <section aria-labelledby="account-profile-heading">
        <h2 id="account-profile-heading" className="mb-3 text-sm font-semibold tracking-tight text-foreground">
          Profil
        </h2>
        <div className="rounded-md border border-input bg-card p-4 text-card-foreground shadow-sm">
          <ProfileForm initialLocale={profile?.preferred_locale ?? null} onSuccess={onProfileUpdated} toast={toast} />
        </div>
      </section>

      {/* Sekcja: Plan */}
      <section aria-labelledby="account-plan-heading" id="plan">
        <h2 id="account-plan-heading" className="mb-3 text-sm font-semibold tracking-tight text-foreground">
          Plan
        </h2>
        <PlanCard plan={profile?.plan ?? "basic"} onOpenPremiumModal={onOpenPremiumModal} />
      </section>

      {/* Sekcja: Bezpieczeństwo – placeholder na ChangePasswordForm i DeleteAccountSection */}
      <section aria-labelledby="account-security-heading">
        <h2 id="account-security-heading" className="mb-3 text-sm font-semibold tracking-tight text-foreground">
          Bezpieczeństwo
        </h2>
        <div className="rounded-md border border-input bg-card p-4 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">
            Zmiana hasła i usunięcie konta będą dostępne w kolejnym kroku implementacji.
          </p>
        </div>
      </section>
    </div>
  );
};

export default AccountLayout;
