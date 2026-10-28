"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Camera, Plus, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScannerBurst } from "@/lib/scanner";

export type ScanInputHandle = {
  focus: () => void;
  /** Adds whatever is typed in the box (if anything) and empties it. Resolves when the code has been handled. */
  commit: () => Promise<void>;
};

type Props = {
  /** Called with each code: typed + Enter / Add, a USB scanner, or a scanner that sends no Enter. */
  onCode: (code: string) => Promise<void> | void;
  onCamera: () => void;
  disabled?: boolean;
  placeholder: string;
  /** Tells the parent whether something is typed but not added yet. */
  onPendingChange?: (pending: boolean) => void;
};

/**
 * The scan box used by Check In / Check Out. Adds a code when:
 *  - Enter is pressed (what most USB scanners send after the code), or the Add button is clicked, or
 *  - a scanner that sends no Enter has finished typing (fast burst, then a short pause).
 * The box empties and keeps the cursor after every code, ready for the next one.
 */
export const ScanInput = forwardRef<ScanInputHandle, Props>(function ScanInput({ onCode, onCamera, disabled, placeholder, onPendingChange }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const setText = (v: string) => {
    setValue(v);
    onPendingChange?.(v.trim() !== "");
  };

  async function commit() {
    burst.cancel();
    const code = (inputRef.current?.value ?? value).trim();
    setText("");
    inputRef.current?.focus();
    if (code) await onCode(code);
  }

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus(), commit }));

  const burst = useScannerBurst(() => commit()); // scanner without Enter
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    burst.onInput(e.target.value);
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <div className="relative flex-1">
        <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          aria-label="Scan code"
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          autoFocus
          autoComplete="off"
          placeholder={placeholder}
          className="h-11 pr-28 pl-9 font-mono"
        />
        {focused && !disabled && (
          <span className="pointer-events-none absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Scanner ready
          </span>
        )}
      </div>
      <Button type="submit" className="h-11" disabled={disabled || !value.trim()} aria-label="Add code">
        <Plus />
        Add
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" disabled={disabled} onClick={onCamera} aria-label="Camera" title="No scanner? Use the camera">
        <Camera />
      </Button>
    </form>
  );
});
