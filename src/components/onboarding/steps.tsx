"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BODY_PARTS,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  SEXES,
  SKILL_GOALS,
  WEEKDAYS,
} from "@/lib/constants";
import {
  BODY_PART_LABELS,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
  SKILL_LABELS,
} from "@/lib/labels";
import { PARQ_QUESTIONS, parqFlagged, type FieldErrors, type StepId } from "@/lib/schemas/onboarding";
import { ChoiceCards, FieldError, MultiChoice, NumberField, Segmented } from "./fields";
import type { OnboardingDraft } from "./draft";

export type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  errors: FieldErrors;
};

function BodyStep({ draft, update, errors }: StepProps) {
  const metric = draft.unitSystem === "metric";
  return (
    <div className="space-y-6">
      <Segmented
        id="unitSystem"
        legend="Units"
        value={draft.unitSystem}
        onChange={(unitSystem) => update({ unitSystem, heightCm: "", heightFt: "", heightIn: "", weight: "" })}
        options={[
          { value: "metric", label: "Metric (cm, kg)" },
          { value: "imperial", label: "Imperial (ft, lb)" },
        ]}
      />
      <NumberField id="age" label="Age" suffix="years" value={draft.age} onChange={(age) => update({ age })} error={errors.age} />
      <ChoiceCards
        id="sex"
        legend="Sex"
        columns={2}
        value={draft.sex}
        onChange={(sex) => update({ sex })}
        error={errors.sex}
        options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
      />
      {metric ? (
        <NumberField
          id="heightCm"
          label="Height"
          suffix="cm"
          value={draft.heightCm}
          onChange={(heightCm) => update({ heightCm })}
          error={errors.heightCm}
        />
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Height</legend>
          <div className="flex gap-4">
            <NumberField
              id="heightCm"
              label="Feet"
              suffix="ft"
              value={draft.heightFt}
              onChange={(heightFt) => update({ heightFt })}
            />
            <NumberField
              id="heightIn"
              label="Inches"
              suffix="in"
              value={draft.heightIn}
              onChange={(heightIn) => update({ heightIn })}
            />
          </div>
          <FieldError id="heightCm" message={errors.heightCm} />
        </fieldset>
      )}
      <NumberField
        id="weightKg"
        label="Body weight"
        suffix={metric ? "kg" : "lb"}
        value={draft.weight}
        onChange={(weight) => update({ weight })}
        error={errors.weightKg}
      />
    </div>
  );
}

function GoalStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <ChoiceCards
        id="goal"
        legend="What's your main goal?"
        value={draft.goal}
        onChange={(goal) => update({ goal })}
        error={errors.goal}
        options={GOALS.map((g) => ({ value: g, ...GOAL_LABELS[g] }))}
      />
      {draft.goal === "skills" && (
        <MultiChoice
          id="skillGoals"
          legend="Which skills?"
          columns={2}
          values={draft.skillGoals}
          onChange={(skillGoals) => update({ skillGoals })}
          error={errors.skillGoals}
          options={SKILL_GOALS.map((s) => ({ value: s, label: SKILL_LABELS[s] }))}
        />
      )}
    </div>
  );
}

function ExperienceStep({ draft, update, errors }: StepProps) {
  return (
    <ChoiceCards
      id="experience"
      legend="How much training experience do you have?"
      value={draft.experience}
      onChange={(experience) => update({ experience })}
      error={errors.experience}
      options={EXPERIENCE_LEVELS.map((e) => ({ value: e, ...EXPERIENCE_LABELS[e] }))}
    />
  );
}

function BaselineStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <Alert>
        <Info aria-hidden />
        <AlertTitle>How to test</AlertTitle>
        <AlertDescription>
          Warm up first. Do each test once with good form and rest 2–3 minutes between them. Zero is a perfectly
          good answer. If you&rsquo;d rather not test now, enter your best guess.
        </AlertDescription>
      </Alert>
      <NumberField
        id="pushUps"
        label="Max push-ups"
        hint="Full push-ups in one set, chest close to the floor"
        suffix="reps"
        value={draft.pushUps}
        onChange={(pushUps) => update({ pushUps })}
        error={errors.pushUps}
      />
      <NumberField
        id="pullUps"
        label="Max pull-ups"
        hint="Strict, from a dead hang to chin over the bar. 0 is fine."
        suffix="reps"
        value={draft.pullUps}
        onChange={(pullUps) => update({ pullUps })}
        error={errors.pullUps}
      />
      <NumberField
        id="squats"
        label="Max bodyweight squats"
        hint="Hips to knee height or lower, without stopping"
        suffix="reps"
        value={draft.squats}
        onChange={(squats) => update({ squats })}
        error={errors.squats}
      />
      <NumberField
        id="plankSeconds"
        label="Plank hold"
        hint="Forearm plank with a straight body"
        suffix="seconds"
        value={draft.plankSeconds}
        onChange={(plankSeconds) => update({ plankSeconds })}
        error={errors.plankSeconds}
      />
      <NumberField
        id="deadHangSeconds"
        label="Dead hang"
        hint="Hanging from a bar with straight arms. Enter 0 if you have no bar."
        suffix="seconds"
        value={draft.deadHangSeconds}
        onChange={(deadHangSeconds) => update({ deadHangSeconds })}
        error={errors.deadHangSeconds}
      />
    </div>
  );
}

function EquipmentStep({ draft, update, errors }: StepProps) {
  const needsBar =
    !draft.equipment.includes("pull_up_bar") &&
    (draft.goal === "first_pull_up" ||
      (draft.goal === "skills" && draft.skillGoals.some((s) => s === "muscle_up" || s === "front_lever")));

  return (
    <div className="space-y-4">
      <MultiChoice
        id="equipment"
        legend="What equipment can you use?"
        hint="Leave everything unticked if you have no equipment. Every plan works with just the floor, a wall and a chair."
        values={draft.equipment}
        onChange={(equipment) => update({ equipment })}
        error={errors.equipment}
        options={EQUIPMENT.map((e) => ({ value: e, ...EQUIPMENT_LABELS[e] }))}
      />
      {needsBar && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>Your goal needs a pull-up bar</AlertTitle>
          <AlertDescription>
            Without one, your plan will build pulling strength with rows and core work, but you won&rsquo;t be able to
            practise the movement itself. A doorway bar is inexpensive.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

const MINUTE_OPTIONS = [20, 30, 45, 60, 75, 90];

function ScheduleStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <Segmented
        id="daysPerWeek"
        legend="Training days per week"
        value={draft.daysPerWeek}
        onChange={(daysPerWeek) => update({ daysPerWeek })}
        error={errors.daysPerWeek}
        options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
      />
      <Segmented
        id="minutesPerSession"
        legend="Minutes per session"
        value={draft.minutesPerSession}
        onChange={(minutesPerSession) => update({ minutesPerSession })}
        error={errors.minutesPerSession}
        options={MINUTE_OPTIONS.map((n) => ({ value: n, label: `${n}` }))}
      />
      <MultiChoice
        id="preferredDays"
        legend="Preferred days (optional)"
        hint={`Pick ${draft.daysPerWeek} days, or leave empty and we'll space your sessions out for you.`}
        columns={7}
        values={draft.preferredDays}
        onChange={(preferredDays) => update({ preferredDays })}
        error={errors.preferredDays}
        options={WEEKDAYS.map((label, i) => ({ value: i, label }))}
      />
    </div>
  );
}

function InjuriesStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <MultiChoice
        id="injuryAreas"
        legend="Any current injuries or pain? (optional)"
        hint="We'll avoid exercises that load these areas."
        columns={2}
        values={draft.injuryAreas}
        onChange={(injuryAreas) => update({ injuryAreas })}
        error={errors.injuryAreas}
        options={BODY_PARTS.map((b) => ({ value: b, label: BODY_PART_LABELS[b] }))}
      />
      <div className="space-y-2">
        <Label htmlFor="injuryNotes">Anything else we should know? (optional)</Label>
        <p id="injuryNotes-hint" className="text-sm text-muted-foreground">
          For example &ldquo;left knee hurts on deep squats&rdquo;. Don&rsquo;t include your name or other personal
          details.
        </p>
        <Textarea
          id="injuryNotes"
          maxLength={500}
          value={draft.injuryNotes}
          onChange={(e) => update({ injuryNotes: e.target.value })}
          aria-invalid={errors.injuryNotes ? true : undefined}
          aria-describedby={errors.injuryNotes ? "injuryNotes-hint injuryNotes-error" : "injuryNotes-hint"}
        />
        <p className="text-right text-xs text-muted-foreground">{draft.injuryNotes.length}/500</p>
        <FieldError id="injuryNotes" message={errors.injuryNotes} />
      </div>
    </div>
  );
}

function HealthStep({ draft, update, errors }: StepProps) {
  const flagged = parqFlagged(draft.parq);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        A quick safety screen before you start exercising. Answer honestly; it only changes how cautious your plan
        is.
      </p>
      <ol className="space-y-4">
        {PARQ_QUESTIONS.map((q, i) => {
          const value = draft.parq[q.id];
          return (
            <li key={q.id}>
              <Segmented
                // The first question doubles as the focus target for errors.
                id={i === 0 ? "parq" : `parq-${q.id}`}
                legend={`${i + 1}. ${q.text}`}
                value={value === undefined ? "" : value ? "yes" : "no"}
                onChange={(answer) => update({ parq: { ...draft.parq, [q.id]: answer === "yes" } })}
                options={[
                  { value: "no", label: "No" },
                  { value: "yes", label: "Yes" },
                ]}
              />
            </li>
          );
        })}
      </ol>
      <FieldError id="parq" message={errors.parq && "Please answer every question"} />

      {flagged && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>Please talk to a doctor before you start</AlertTitle>
          <AlertDescription>
            <p>
              Because you answered &ldquo;yes&rdquo; to at least one question, we recommend checking with a doctor or
              qualified health professional before starting a new exercise programme.
            </p>
            <p>
              You can still continue. We&rsquo;ll give you a conservative plan with easier exercises, lower volume and
              more rest. Stop immediately if you feel chest pain, dizziness or sharp pain.
            </p>
            <div className="mt-2 flex items-start gap-3">
              <Checkbox
                id="parqAcknowledged"
                checked={draft.parqAcknowledged}
                onCheckedChange={(checked) => update({ parqAcknowledged: checked === true })}
                aria-invalid={errors.parqAcknowledged ? true : undefined}
                aria-describedby={errors.parqAcknowledged ? "parqAcknowledged-error" : undefined}
                className="mt-0.5 border-current"
              />
              <Label htmlFor="parqAcknowledged" className="leading-snug font-normal">
                I understand. I&rsquo;ll consult a doctor and want a conservative plan for now.
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <FieldError id="parqAcknowledged" message={errors.parqAcknowledged} />
      <p className="text-xs text-muted-foreground">CaliCoach provides general fitness guidance, not medical advice.</p>
    </div>
  );
}

export const STEP_COMPONENTS: Record<StepId, (props: StepProps) => React.ReactNode> = {
  body: BodyStep,
  goal: GoalStep,
  experience: ExperienceStep,
  baseline: BaselineStep,
  equipment: EquipmentStep,
  schedule: ScheduleStep,
  injuries: InjuriesStep,
  health: HealthStep,
};
