"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Select, type Option } from "./Form";

type Value = string | number | null | undefined;

export type FilterDef<T> =
  /** Dropdown. Leave out `options` to build the list from the values in the data. */
  | { kind: "select"; key: string; label: string; value: (row: T) => Value; options?: Option[] }
  /** On/off chip, e.g. "Overdue". */
  | { kind: "toggle"; key: string; label: string; test: (row: T) => boolean }
  /** From / to dates (YYYY-MM-DD…) */
  | { kind: "dates"; key: string; label: string; value: (row: T) => Value };

export type FilterConfig<T> = {
  /** Text the search box looks through, e.g. (r) => [r.ticket_code, r.client_name]. */
  search?: (row: T) => Value[];
  placeholder?: string;
  filters?: FilterDef<T>[];
};

type State = Record<string, string>;

const norm = (v: Value) => String(v ?? "").toLowerCase();
const compact = (s: string) => s.replace(/[\s\-()]/g, "");

/** Every word must appear somewhere; spaces/dashes are ignored so "0788 882" finds "0788882". */
function matchesSearch(fields: Value[], q: string) {
  const hay = fields.map(norm).join(" ");
  const hayCompact = compact(hay);
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word) || hayCompact.includes(compact(word)));
}

function loadState(storageKey: string): State {
  try {
    return JSON.parse(sessionStorage.getItem(`kat-filters:${storageKey}`) || "{}");
  } catch {
    return {};
  }
}

/**
 * Search + filters for a list. Returns the matching rows and the filter bar to show above the table.
 * Choices are remembered (per browser tab) when the user opens a record and comes back.
 *
 *   const { rows, bar } = useFilters(data?.repairs ?? [], { search: (r) => [r.ticket_code], filters: [...] }, "repairs");
 */
export function useFilters<T>(all: T[], config: FilterConfig<T>, storageKey: string) {
  const [state, setState] = useState<State>(() => (typeof window === "undefined" ? {} : loadState(storageKey)));

  // A link like /inventory?find=SCR-13P (from "Search everything") starts the page with that search.
  useEffect(() => {
    const url = new URL(window.location.href);
    const find = url.searchParams.get("find");
    if (find) {
      setState({ q: find });
      url.searchParams.delete("find");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(`kat-filters:${storageKey}`, JSON.stringify(state));
    } catch {
      /* private mode etc. — filters just won't be remembered */
    }
  }, [state, storageKey]);

  const set = (key: string, value: string) => setState((s) => ({ ...s, [key]: value }));
  const filters = config.filters ?? [];

  const rows = useMemo(() => {
    const q = (state.q ?? "").trim();
    return all.filter((row) => {
      if (q && config.search && !matchesSearch(config.search(row), q)) return false;
      for (const f of filters) {
        if (f.kind === "select" && state[f.key] && String(f.value(row) ?? "") !== state[f.key]) return false;
        if (f.kind === "toggle" && state[f.key] === "1" && !f.test(row)) return false;
        if (f.kind === "dates") {
          const day = String(f.value(row) ?? "").slice(0, 10);
          if (state[`${f.key}_from`] && (!day || day < state[`${f.key}_from`])) return false;
          if (state[`${f.key}_to`] && (!day || day > state[`${f.key}_to`])) return false;
        }
      }
      return true;
    });
    // config/filters are re-created every render by the caller; the data and choices are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, state]);

  const active = Object.values(state).some(Boolean);

  const bar = (
    <div className="mb-4 flex flex-col gap-3" role="search">
      <div className="flex flex-wrap items-center gap-2">
        {config.search && (
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={state.q ?? ""}
              onChange={(e) => set("q", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder={config.placeholder ?? "Search…"}
              aria-label="Search"
              className="h-10 bg-card pl-9"
            />
          </div>
        )}
        {filters.map((f) => {
          if (f.kind === "select") {
            const options =
              f.options ??
              Array.from(new Set(all.map((r) => f.value(r)).filter((v) => v !== null && v !== undefined && v !== "")))
                .map(String)
                .sort((a, b) => a.localeCompare(b));
            return (
              <Select
                key={f.key}
                aria-label={f.label}
                className={cn("w-auto min-w-40", state[f.key] && "[&_select]:border-primary [&_select]:bg-secondary")}
                value={state[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={`All ${f.label.toLowerCase()}`}
                options={options}
              />
            );
          }
          if (f.kind === "toggle")
            return (
              <Button
                key={f.key}
                type="button"
                variant={state[f.key] === "1" ? "default" : "outline"}
                aria-pressed={state[f.key] === "1"}
                className="h-10"
                onClick={() => set(f.key, state[f.key] === "1" ? "" : "1")}
              >
                {f.label}
              </Button>
            );
          return (
            <div key={f.key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="whitespace-nowrap">{f.label}</span>
              <Input type="date" aria-label={`${f.label} from`} className="h-10 w-38 bg-card" value={state[`${f.key}_from`] ?? ""} onChange={(e) => set(`${f.key}_from`, e.target.value)} />
              <span>–</span>
              <Input type="date" aria-label={`${f.label} to`} className="h-10 w-38 bg-card" value={state[`${f.key}_to`] ?? ""} onChange={(e) => set(`${f.key}_to`, e.target.value)} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
        <span data-testid="filter-count">
          {active ? `Showing ${rows.length} of ${all.length}` : `${all.length} ${all.length === 1 ? "record" : "records"}`}
        </span>
        {active && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setState({})}>
            <X />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );

  return { rows, bar, filtering: active };
}
