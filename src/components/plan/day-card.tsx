import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WEEKDAYS } from "@/lib/constants";
import { formatTarget, type PlanViewDay } from "@/lib/plan/queries";

function formatRest(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min rest` : `${seconds} s rest`;
}

export function DayCard({ day }: { day: PlanViewDay }) {
  const warmup = day.exercises.filter((e) => e.block === "warmup");
  const main = day.exercises.filter((e) => e.block === "main");
  const cooldown = day.exercises.filter((e) => e.block === "cooldown");

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Day {day.dayNumber} · {WEEKDAYS[day.weekday]}
        </CardDescription>
        <CardTitle>{day.title}</CardTitle>
        {day.focus && <CardDescription>{day.focus}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          <span className="font-medium">Warm-up: </span>
          <span className="text-muted-foreground">{warmup.map((e) => e.name).join(", ")}</span>
        </p>
        <ol className="space-y-3">
          {main.map((e) => (
            <li key={e.id} className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{e.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {e.sets} × {formatTarget(e)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRest(e.restSeconds)}
                {e.notes && <> · {e.notes}</>}
              </p>
            </li>
          ))}
        </ol>
        <p>
          <span className="font-medium">Cool-down: </span>
          <span className="text-muted-foreground">{cooldown.map((e) => e.name).join(", ")}</span>
        </p>
      </CardContent>
    </Card>
  );
}
