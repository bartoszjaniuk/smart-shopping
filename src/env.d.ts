/// <reference types="astro/client" />
/// <reference types="@vite-pwa/astro/client" />

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db/database.types.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      user?: { id: string; email?: string };
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  /** Optional; used only server-side for POST /api/auth/delete-account (Admin API). */
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  /** URL projektu Supabase – używane w przeglądarce (Realtime, auth). Ta sama wartość co SUPABASE_URL. */
  readonly PUBLIC_SUPABASE_URL: string;
  /** Klucz anon – używany w przeglądarce. Ta sama wartość co SUPABASE_KEY (anon). */
  readonly PUBLIC_SUPABASE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:pwa-register" {
  interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
