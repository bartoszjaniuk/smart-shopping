import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(swUrl, registration) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info("[PWA] Service Worker registered", swUrl, registration);
        }
      },
      onRegisterError(error) {
        // eslint-disable-next-line no-console
        console.error("[PWA] Service Worker registration failed", error);
      },
    });

    return () => {
      void updateSW();
    };
  }, []);

  return null;
}
