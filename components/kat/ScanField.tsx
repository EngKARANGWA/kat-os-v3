"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "./BarcodeScanner";

type Props = {
  label: string;
  name: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
  defaultValue?: string;
  /** Pass to control the field from the page (e.g. fill it when a device is picked); leave out otherwise. */
  value?: string;
  /** Called whenever the code changes (typed, scanned with a USB scanner, or read by the camera). */
  onCodeChange?: (code: string) => void;
};

/**
 * A text field for codes (SKU, IMEI, serial) that can be filled three ways:
 * typing, a USB/Bluetooth barcode scanner (it types the code and presses Enter), or the camera button.
 * Enter moves to the next field instead of submitting the half-filled form.
 */
export function ScanField({ label, name, required, autoFocus, placeholder, hint, defaultValue, value, onCodeChange }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  const focusNextField = () => {
    const form = inputRef.current?.form;
    if (!form) return;
    const fields = Array.from(form.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea"));
    fields[fields.indexOf(inputRef.current!) + 1]?.focus();
  };

  const detected = useRef(false);
  const onDetected = useCallback(
    (code: string) => {
      detected.current = true;
      if (inputRef.current && value === undefined) inputRef.current.value = code;
      onCodeChange?.(code);
    },
    [onCodeChange, value],
  );
  const onScannerOpenChange = useCallback((open: boolean) => {
    setScanning(open);
    if (open) detected.current = false;
  }, []);
  // When the scanner has closed: go to the next field after a scan, or back to this field if it was cancelled.
  const onScannerClosed = () => (detected.current ? focusNextField() : inputRef.current?.focus());

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          name={name}
          required={required}
          autoFocus={autoFocus}
          {...(value !== undefined ? { value } : { defaultValue })}
          autoComplete="off"
          placeholder={placeholder}
          className="h-10 pl-9 font-mono"
          onChange={(e) => onCodeChange?.(e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              focusNextField();
            }
          }}
        />
        </div>
        <Button type="button" variant="outline" className="h-10" onClick={() => onScannerOpenChange(true)} aria-label={`Scan ${label} with camera`}>
          <ScanLine />
          <span className="hidden sm:inline">Scan</span>
        </Button>
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      <BarcodeScanner open={scanning} onOpenChange={onScannerOpenChange} onDetected={onDetected} onClosed={onScannerClosed} />
    </div>
  );
}
