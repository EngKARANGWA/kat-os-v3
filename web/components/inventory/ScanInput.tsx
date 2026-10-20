"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

// A USB scanner "types" a whole code a few milliseconds per character (with the odd hiccup);
// people average 80 ms or more per key. So: fast on average, and no long pause in between.
const SCANNER_MAX_AVG_MS = 30;
const SCANNER_MAX_GAP_MS = 100;
const SCANNER_MIN_LENGTH = 4;
const SCANNER_IDLE_MS = 150;

/**
 * The scan box used by Check In / Check Out. Adds a code when:
 *  - Enter is pressed (what most USB scanners send after the code), or the Add button is clicked, or
 *  - a scanner that sends no Enter has finished typing (fast burst, then a short pause).
 * The box empties and keeps the cursor after every code, ready for the next one.
 */
export const ScanInput = forwardRef<ScanInputHandle, Props>(function ScanInput({ onCode, onCamera, disabled, placeholder, onPendingChange }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const burst = useRef({ first: 0, last: 0, slowGap: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });

  const setText = (v: string) => {
    setValue(v);
    onPendingChange?.(v.trim() !== "");
  };

  async function commit() {
    clearTimeout(burst.current.timer);
    const code = (inputRef.current?.value ?? value).trim();
    setText("");
    inputRef.current?.focus();
    if (code) await onCode(code);
  }

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus(), commit }));

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const now = performance.now();
    const b = burst.current;
    const v = e.target.value;
    // Measure the typing speed of this code (from its first character).
    if (v.length <= 1) {
      b.first = now;
      b.slowGap = false;
    } else if (now - b.last > SCANNER_MAX_GAP_MS) b.slowGap = true;
    b.last = now;
    setText(v);
    clearTimeout(b.timer);
    const avg = v.length > 1 ? (now - b.first) / (v.length - 1) : Infinity;
    if (!b.slowGap && avg <= SCANNER_MAX_AVG_MS && v.trim().length >= SCANNER_MIN_LENGTH) b.timer = setTimeout(commit, SCANNER_IDLE_MS); // scanner without Enter
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <Input
        ref={inputRef}
        aria-label="Scan code"
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus
        autoComplete="off"
        placeholder={placeholder}
        className="h-11 font-mono"
      />
      <Button type="submit" className="h-11" disabled={disabled || !value.trim()} aria-label="Add code">
        <Plus />
        Add
      </Button>
      <Button type="button" variant="outline" className="h-11" disabled={disabled} onClick={onCamera}>
        <ScanLine />
        Camera
      </Button>
    </form>
  );
});
