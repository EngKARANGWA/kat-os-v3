"use client";

import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type Kind = "success" | "error";

/**
 * Like Flask's flash(): show a short pop-up message (shadcn/ui Sonner toast).
 * Toasts stay visible while the app moves to another page, so they can be shown just before navigating.
 */
export function useFlash() {
  return flash;
}

function flash(text: string, kind: Kind = "success") {
  if (kind === "error") toast.error(text);
  else toast.success(text);
}

export function FlashProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
