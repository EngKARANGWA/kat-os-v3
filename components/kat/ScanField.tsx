"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Camera, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScannerBurst } from "@/lib/scanner";
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
 * A text field for codes (SKU, IMEI, serial), made for a USB / Bluetooth barcode scanner:
 * click the field (it shows "Scanner ready") and scan. The scanner types the code; Enter (or the end of the scan)
 * moves to the next field instead of submitting the half-filled form. Typing works too, and the small camera
 * button is a backup for phones without a scanner.
 */
export function ScanField({ label, name, required, autoFocus, placeholder = "Scan with the barcode scanner, or type", hint, defaultValue, value, onCodeChange }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [focused, setFocused] = useState(false);

  const focusNextField = () => {
    const form = inputRef.current?.form;
    if (!form) return;
    const fields = Array.from(form.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea"));
    fields[fields.indexOf(inputRef.current!) + 1]?.focus();
  };
  // A scanner set up without Enter: move on once the burst of characters ends.
  const burst = useScannerBurst(() => focusNextField());

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
  // When the camera has closed: go to the next field after a scan, or back to this field if it was cancelled.
  const onScannerClosed = () => (detected.current ? focusNextField() : inputRef.current?.focus());

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={id}
            name={name}
            required={required}
            autoFocus={autoFocus}
            {...(value !== undefined ? { value } : { defaultValue })}
            autoComplete="off"
            placeholder={placeholder}
            className="h-10 pr-28 pl-9 font-mono"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              burst.onInput(e.target.value);
              onCodeChange?.(e.target.value.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                burst.cancel();
                focusNextField();
              }
            }}
          />
          {focused && (
            <span className="pointer-events-none absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Scanner ready
            </span>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground" onClick={() => onScannerOpenChange(true)} aria-label={`Scan ${label} with camera`} title="No scanner? Use the camera">
          <Camera />
        </Button>
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      <BarcodeScanner open={scanning} onOpenChange={onScannerOpenChange} onDetected={onDetected} onClosed={onScannerClosed} />
    </div>
  );
}
