"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { completeOnboarding } from "@/app/(app)/onboarding/actions";
import { ONBOARDING_STEPS, validateFields, type FieldErrors, type OnboardingField } from "@/lib/schemas/onboarding";
import { DRAFT_STORAGE_KEY as STORAGE_KEY, EMPTY_DRAFT, localIsoDate, toOnboardingInput, type OnboardingDraft } from "./draft";
import { STEP_COMPONENTS } from "./steps";

type Saved = { draft: OnboardingDraft; step: number };

function loadSaved(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Saved | null;
    if (saved?.draft) {
      return { draft: { ...EMPTY_DRAFT, ...saved.draft }, step: Math.min(Math.max(saved.step, 0), ONBOARDING_STEPS.length - 1) };
    }
  } catch {
    // Ignore corrupt or unavailable storage.
  }
  return { draft: EMPTY_DRAFT, step: 0 };
}

function clientEnv() {
  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, today: localIsoDate() };
}

function focusField(field: OnboardingField) {
  document.getElementById(field)?.focus();
}

const subscribe = () => () => {};

export function OnboardingWizard() {
  // The draft lives in localStorage, which only exists in the browser.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <Wizard />;
}

function Wizard() {
  const [{ draft, step }, setState] = useState(loadSaved);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const current = ONBOARDING_STEPS[step];
  const StepComponent = STEP_COMPONENTS[current.id];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step }));
    } catch {
      // Storage full or blocked: the wizard still works, just without resume.
    }
  }, [draft, step]);

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  function update(patch: Partial<OnboardingDraft>) {
    setState((s) => ({ ...s, draft: { ...s.draft, ...patch } }));
    // Clear errors for fields the user just changed.
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as OnboardingField];
      if ("weight" in patch) delete next.weightKg;
      if ("heightFt" in patch || "heightIn" in patch) delete next.heightCm;
      if ("parq" in patch) delete next.parq;
      return next;
    });
  }

  function goTo(nextStep: number) {
    setErrors({});
    setFormError("");
    setState((s) => ({ ...s, step: nextStep }));
  }

  function next() {
    const input = toOnboardingInput(draft, clientEnv());
    const stepErrors = validateFields(input, current.fields);
    const invalid = current.fields.filter((f) => stepErrors[f]);
    if (invalid.length > 0) {
      setErrors(stepErrors);
      // Focus after the error messages render.
      requestAnimationFrame(() => focusField(invalid[0]));
      return;
    }
    if (!isLast) {
      goTo(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await completeOnboarding(input);
      // On success the action redirects, so we only get here on failure.
      if (result.fieldErrors) {
        const failedStep = ONBOARDING_STEPS.findIndex((s) =>
          s.fields.some((f) => result.fieldErrors?.[f as OnboardingField]),
        );
        if (failedStep >= 0 && failedStep !== step) setState((s) => ({ ...s, step: failedStep }));
        setErrors(result.fieldErrors);
      }
      setFormError(result.message);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {ONBOARDING_STEPS.length}
          </span>
          <span>About 2 minutes</span>
        </div>
        <Progress
          value={((step + 1) / ONBOARDING_STEPS.length) * 100}
          aria-label={`Onboarding progress: step ${step + 1} of ${ONBOARDING_STEPS.length}`}
        />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        className="space-y-8"
      >
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {current.title}
        </h1>

        <StepComponent draft={draft} update={update} errors={errors} />

        {formError && (
          <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => goTo(step - 1)} disabled={pending}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {isLast ? (pending ? "Saving…" : "Finish") : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
