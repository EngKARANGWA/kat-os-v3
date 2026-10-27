"use client";

import { useId } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Period = { preset: Preset; from: string; to: string };
type Preset = "today" | "yesterday" | "week" | "month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

/** Today's date in Kigali as YYYY-MM-DD (the shop's day, whatever the computer's clock zone). */
export function kigaliToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
}

function shift(day: string, days: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The days a preset covers, ending today (the week starts on Monday). */
export function periodFor(preset: Exclude<Preset, "custom">): Period {
  const today = kigaliToday();
  if (preset === "yesterday") return { preset, from: shift(today, -1), to: shift(today, -1) };
  if (preset === "week")
    return {
      preset,
      from: shift(today, -((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7)),
      to: today,
    };
  if (preset === "month") return { preset, from: today.slice(0, 8) + "01", to: today };
  return { preset, from: today, to: today };
}

const fmt = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** Human text for the chosen days, e.g. "Today · 26 Oct 2026" or "1 Oct 2026 – 26 Oct 2026". */
export function periodLabel(p: Period) {
  const days = p.from === p.to ? fmt(p.from) : `${fmt(p.from)} – ${fmt(p.to)}`;
  const name = PRESETS.find((x) => x.key === p.preset)?.label;
  return p.preset === "custom" ? days : `${name} · ${days}`;
}

/** Today / Yesterday / This week / This month buttons, plus From–To dates for any other days. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const fromId = useId();
  const toId = useId();
  const today = kigaliToday();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div role="group" aria-label="Period" className="inline-flex flex-wrap rounded-lg border bg-card p-1">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={value.preset === p.key}
            className={cn("h-8", value.preset === p.key && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
            onClick={() => onChange(p.key === "custom" ? { ...value, preset: "custom" } : periodFor(p.key))}
          >
            {p.key === "custom" && <CalendarDays />}
            {p.label}
          </Button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={fromId} className="text-xs">
              From
            </Label>
            <Input
              id={fromId}
              type="date"
              className="h-9 w-40"
              value={value.from}
              max={today}
              onChange={(e) =>
                e.target.value &&
                onChange({
                  ...value,
                  from: e.target.value,
                  to: value.to < e.target.value ? e.target.value : value.to,
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={toId} className="text-xs">
              To
            </Label>
            <Input
              id={toId}
              type="date"
              className="h-9 w-40"
              value={value.to}
              min={value.from}
              max={today}
              onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
