"use client";

import { useEffect, useRef } from "react";

// A USB / Bluetooth barcode scanner acts like a keyboard: it "types" the whole code a few milliseconds
// per character (with the odd hiccup), usually followed by Enter. People average 80 ms or more per key.
export const SCANNER_MAX_AVG_MS = 30;
export const SCANNER_MAX_GAP_MS = 100;
export const SCANNER_MIN_LENGTH = 4;
export const SCANNER_IDLE_MS = 150;

/**
 * For a text box: call `onInput(value)` from its onChange. When the text arrived as a scanner burst and
 * no Enter follows, `onScan(code)` runs shortly after the last character (for scanners set up without Enter).
 */
export function useScannerBurst(onScan: (code: string) => void) {
  const state = useRef({ first: 0, last: 0, slowGap: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const scanRef = useRef(onScan);
  useEffect(() => {
    scanRef.current = onScan;
  });
  useEffect(() => () => clearTimeout(state.current.timer), []);

  return {
    onInput(value: string) {
      const now = performance.now();
      const b = state.current;
      if (value.length <= 1) {
        b.first = now;
        b.slowGap = false;
      } else if (now - b.last > SCANNER_MAX_GAP_MS) b.slowGap = true;
      b.last = now;
      clearTimeout(b.timer);
      const avg = value.length > 1 ? (now - b.first) / (value.length - 1) : Infinity;
      if (!b.slowGap && avg <= SCANNER_MAX_AVG_MS && value.trim().length >= SCANNER_MIN_LENGTH)
        b.timer = setTimeout(() => scanRef.current(value.trim()), SCANNER_IDLE_MS);
    },
    /** Call when Enter already handled the code, so it is not handled twice. */
    cancel() {
      clearTimeout(state.current.timer);
    },
  };
}

const isEditable = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("input, textarea, select, [contenteditable=true]");

/**
 * Catches a barcode scanned while no text box has the cursor (e.g. after clicking on the page),
 * so the scan is not lost. Normal typing is ignored: only fast scanner bursts count.
 */
export function useScannerAnywhere(onCode: (code: string) => void, enabled = true) {
  const codeRef = useRef(onCode);
  useEffect(() => {
    codeRef.current = onCode;
  });

  useEffect(() => {
    if (!enabled) return;
    let chars = "";
    let first = 0;
    let last = 0;
    let slowGap = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      chars = "";
      clearTimeout(timer);
    };
    const finish = () => {
      const avg = chars.length > 1 ? (last - first) / (chars.length - 1) : Infinity;
      const code = chars.trim();
      reset();
      if (!slowGap && avg <= SCANNER_MAX_AVG_MS && code.length >= SCANNER_MIN_LENGTH) {
        codeRef.current(code);
        return true;
      }
      return false;
    };
    const onKey = (e: KeyboardEvent) => {
      // A text box or an open pop-up handles its own keys.
      if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("[role=dialog], [role=alertdialog]")) return reset();
      const now = performance.now();
      if (e.key === "Enter") {
        if (chars && finish()) e.preventDefault();
        return;
      }
      if (e.key.length !== 1) return;
      if (!chars) {
        first = now;
        slowGap = false;
      } else if (now - last > SCANNER_MAX_GAP_MS) slowGap = true;
      else e.stopPropagation(); // mid-scan: a "/" in the code must not trigger the search shortcut
      chars += e.key;
      last = now;
      clearTimeout(timer);
      timer = setTimeout(finish, SCANNER_IDLE_MS); // scanners set up without Enter
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(timer);
    };
  }, [enabled]);
}
