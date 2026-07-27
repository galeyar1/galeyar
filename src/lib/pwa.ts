/**
 * iOS/Safari can't use the standard `beforeinstallprompt` API Chromium
 * browsers expose — there is no programmatic install trigger, only the
 * manual Share -> Add to Home Screen flow. These helpers exist purely to
 * decide WHEN to show a guide for that manual flow, never to trigger an
 * install directly.
 */

/** True on iPhone/iPad Safari (and other iOS browsers, which all share WebKit + this UA pattern). iPadOS 13+ reports as "Macintosh" with touch support, so that's checked too. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpadOsDesktopUa = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return isAppleDevice || isIpadOsDesktopUa;
}

/** True once already installed/launched from the Home Screen — the guide should never show here. */
export function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}
