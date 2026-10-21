import { Inbox } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: string;
};

/** Table (shadcn/ui) built from column definitions: <DataTable columns={[...]} rows={items} rowKey={(i) => i.id} /> */
export function DataTable<T>({ columns, rows, rowKey, empty = "Nothing here yet." }: DataTableProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c, i) => (
            <TableHead key={i} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((c, i) => (
                <TableCell key={i} className={c.className}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-2 size-6 opacity-50" />
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
