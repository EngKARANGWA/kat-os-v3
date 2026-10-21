"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "./Button";

/** Search bar that searches when the user presses Enter or the button (works with barcode scanners too). */
export function SearchBox({ placeholder, button = "Search", onSearch, autoFocus }: { placeholder: string; button?: string; onSearch: (q: string) => void; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mb-6 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus={autoFocus} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-10 bg-card pl-9" />
      </div>
      <Button type="submit" variant="outline" className="h-10">
        {button}
      </Button>
    </form>
  );
}
