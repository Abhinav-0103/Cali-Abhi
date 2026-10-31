"use client";

import { useEffect } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent;
  }
}

export const INSTALL_READY_EVENT = "calicoach:install-ready";

/** Registers the service worker (production only) and keeps the browser's install prompt for later. */
export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__installPrompt = e as InstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_READY_EVENT));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`, { scope: "/" }).catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

const WARM_KEY = "calicoach:sw-warmed-at";
const WARM_EVERY_MS = 30 * 60 * 1000;

/** Asks the service worker to cache the app pages for offline use (signed-in, online, at most every 30 min). */
export async function warmOfflineCache(force = false) {
  if (!("serviceWorker" in navigator) || !navigator.onLine) return;
  try {
    const last = Number(localStorage.getItem(WARM_KEY) ?? 0);
    if (!force && Date.now() - last < WARM_EVERY_MS) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "warm" });
    localStorage.setItem(WARM_KEY, String(Date.now()));
  } catch {
    // Storage blocked or no worker: offline pages just won't be pre-cached.
  }
}

/** Removes cached pages (they contain personal data). Used on sign-out and account deletion. */
export async function clearOfflinePages() {
  try {
    localStorage.removeItem(WARM_KEY);
    for (const key of await caches.keys()) if (key.startsWith("pages-")) await caches.delete(key);
  } catch {
    // Cache Storage unavailable: nothing to clear.
  }
}
