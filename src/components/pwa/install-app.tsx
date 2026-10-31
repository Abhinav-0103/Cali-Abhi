"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INSTALL_READY_EVENT } from "./pwa-register";

const noop = () => () => {};

function useDeviceInfo() {
  return useSyncExternalStore(
    noop,
    () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      return standalone ? "installed" : ios ? "ios" : "other";
    },
    () => "other",
  );
}

/** "Install app" for browsers with an install prompt; Add-to-Home-Screen steps for iOS. */
export function InstallApp() {
  const device = useDeviceInfo();
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    const update = () => setCanPrompt(Boolean(window.__installPrompt));
    update();
    window.addEventListener(INSTALL_READY_EVENT, update);
    return () => window.removeEventListener(INSTALL_READY_EVENT, update);
  }, []);

  if (device === "installed") return <p className="text-sm text-muted-foreground">CaliCoach is installed on this device.</p>;

  if (device === "ios") {
    return (
      <p className="text-sm text-muted-foreground">
        In Safari, tap the <span className="font-medium text-foreground">Share</span> button, then{" "}
        <span className="font-medium text-foreground">Add to Home Screen</span>.
      </p>
    );
  }

  if (!canPrompt) {
    return (
      <p className="text-sm text-muted-foreground">
        Use your browser&rsquo;s menu and choose <span className="font-medium text-foreground">Install app</span> or{" "}
        <span className="font-medium text-foreground">Add to Home screen</span>.
      </p>
    );
  }

  return (
    <Button
      onClick={async () => {
        const prompt = window.__installPrompt;
        if (!prompt) return;
        await prompt.prompt();
        await prompt.userChoice;
        window.__installPrompt = undefined;
        setCanPrompt(false);
      }}
    >
      <Download aria-hidden /> Install app
    </Button>
  );
}
