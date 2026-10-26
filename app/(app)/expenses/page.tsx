"use client";

import { Plus } from "lucide-react";
import { ApiForm, Async, DataTable, Field, PageHeader, Panel, SelectField, SubmitButton, useFilters } from "@/components/kat";
import { RequirePermission } from "@/components/Session";
import { api, useApi } from "@/lib/api";
import { fmtDateTime, money } from "@/lib/format";

type Expense = { id: number; category: string; amount: number; description: string | null; created_by: string | null; created_at: string };

function Expenses() {
  const { data, error, reload } = useApi<{ expenses: Expense[]; categories: string[] }>("/expenses");
  const { rows, bar, filtering } = useFilters(
    data?.expenses ?? [],
    {
      placeholder: "Search description, category, staff…",
      search: (e) => [e.description, e.category, e.created_by, e.amount],
      filters: [
        { kind: "select", key: "category", label: "Categories", value: (e) => e.category, options: data?.categories },
        { kind: "select", key: "by", label: "Staff", value: (e) => e.created_by },
        { kind: "dates", key: "date", label: "Date", value: (e) => e.created_at },
      ],
    },
    "expenses",
  );
  const total = rows.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Async data={data} error={error}>
      {(d) => (
        <>
          <Panel title="Record Expense" className="mb-6">
            <ApiForm layout="inline" action={(v) => api("/expenses", { body: v })} reset onSuccess={reload} success="Expense recorded.">
              <SelectField label="Category" name="category" options={d.categories} />
              <Field label="Amount RWF" type="number" min={0} name="amount" required />
              <Field label="Description" name="description" />
              <SubmitButton icon={<Plus />}>Record Expense</SubmitButton>
            </ApiForm>
          </Panel>
          <Panel
            title="History"
            action={
              <span className="text-sm text-muted-foreground">
                {filtering ? "Total shown" : "Total"}: <b data-testid="expense-total" className="text-foreground">{money(total)} RWF</b>
              </span>
            }
          >
            {bar}
            <DataTable
              rows={rows}
              rowKey={(e) => e.id}
              empty={filtering ? "No expenses match these filters." : "No expenses recorded yet."}
              columns={[
                { header: "Date", cell: (e) => fmtDateTime(e.created_at) },
                { header: "Category", cell: (e) => e.category },
                { header: "Description", cell: (e) => e.description },
                { header: "Amount", cell: (e) => <span className="font-medium tabular-nums">{money(e.amount)} RWF</span> },
                { header: "Recorded by", cell: (e) => e.created_by },
              ]}
            />
          </Panel>
        </>
      )}
    </Async>
  );
}

export default function ExpensesPage() {
  return (
    <>
      <PageHeader title="Expenses" description="Only for staff with the Expenses permission. Included in today's profit/loss on the dashboard." />
      <RequirePermission permission="expenses">
        <Expenses />
      </RequirePermission>
    </>
  );
}
