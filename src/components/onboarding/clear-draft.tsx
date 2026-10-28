"use client";

import { useEffect } from "react";
import { DRAFT_STORAGE_KEY } from "./draft";

/** Removes the saved onboarding answers (incl. health data) once onboarding is done. */
export function ClearOnboardingDraft() {
  useEffect(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
