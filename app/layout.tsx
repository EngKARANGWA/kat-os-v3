import type { Metadata } from "next";
import { FlashProvider } from "@/components/Flash";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "KAT OS",
  description: "Kigali Apple Tech Operations System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <FlashProvider>{children}</FlashProvider>
      </body>
    </html>
  );
}
