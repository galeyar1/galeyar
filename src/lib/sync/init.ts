import { triggerSync } from "@/lib/sync/engine";

const POLL_INTERVAL_MS = 60_000;
let initialized = false;

/**
 * Registers the sync triggers. Called once from a client component mounted
 * in the root layout. Background Sync API isn't available on iOS Safari, so
 * alongside the `online` event we also re-check on tab focus and on a
 * gentle interval while the app is open.
 */
export function initSyncListeners(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("online", () => void triggerSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void triggerSync();
  });
  window.setInterval(() => {
    if (navigator.onLine) void triggerSync();
  }, POLL_INTERVAL_MS);

  void triggerSync();
}
