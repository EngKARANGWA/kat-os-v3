"use client";

import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Suggestion = { value: string; label?: string; hint?: string; group?: string };

type Props = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is picked (mouse or Enter). */
  onPick?: (s: Suggestion) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  full?: boolean;
  hint?: React.ReactNode;
};

/**
 * Search-style text field with a suggestion list (↑ ↓ Enter, or click). Free text is allowed too.
 * Suggestions are filtered by every word typed, in any order.
 */
export function SuggestInput({ label, name, value, onChange, onPick, suggestions, placeholder, required, autoFocus, full, hint }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = suggestions.filter((s) => words.every((w) => `${s.label ?? s.value} ${s.hint ?? ""}`.toLowerCase().includes(w))).slice(0, 8);
  const show = open && matches.length > 0 && !(matches.length === 1 && matches[0].value === value);

  function pick(s: Suggestion) {
    onChange(s.value);
    onPick?.(s);
    setOpen(false);
  }

  return (
    <div className={cn("relative flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          value={value}
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          placeholder={placeholder}
          className="h-10 pl-9"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "Escape") return setOpen(false);
            if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
            e.preventDefault();
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, matches.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else pick(matches[active]);
          }}
        />
      </div>
      {show && (
        <ul id={`${id}-list`} role="listbox" className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {matches.map((s, i) => (
            <li
              key={`${s.group ?? ""}${s.value}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer flex-col rounded-md px-2 py-1.5 text-sm", i === active && "bg-secondary")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.label ?? s.value}</span>
                {s.group && <span className="text-[11px] text-muted-foreground">{s.group}</span>}
              </span>
              {s.hint && <span className="font-mono text-xs text-muted-foreground">{s.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
