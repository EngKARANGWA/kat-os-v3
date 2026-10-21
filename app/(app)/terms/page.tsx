"use client";

import { Check } from "lucide-react";
import { Async, PageHeader, Panel, useFilters } from "@/components/kat";
import { useApi } from "@/lib/api";

export default function TermsPage() {
  const { data, error } = useApi<{ terms: Record<string, string[]> }>("/meta");
  const policies = Object.entries(data?.terms ?? {}).map(([name, items]) => ({ name, items }));
  const { rows, bar, filtering } = useFilters(policies, { placeholder: "Search repair types and terms…", search: (p) => [p.name, ...p.items] }, "terms");

  return (
    <>
      <PageHeader title="Repair Policy Library" description="These terms are attached to each ticket according to its problem category." />
      <Async data={data} error={error}>
        {() => (
          <>
            {bar}
            {filtering && rows.length === 0 && <p className="text-sm text-muted-foreground">No terms match your search.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {rows.map(({ name, items }) => (
                <Panel key={name} title={name}>
                  <ul className="flex flex-col gap-2 text-sm">
                    {items.map((x) => (
                      <li key={x} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          </>
        )}
      </Async>
    </>
  );
}
