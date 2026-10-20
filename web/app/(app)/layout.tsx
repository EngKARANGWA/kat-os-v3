"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { SessionContext } from "@/components/Session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    api<{ user: User }>("/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (!me)
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" /> Loading KAT OS…
      </div>
    );

  return (
    <SessionContext.Provider value={me}>
      <Sidebar manager={me.is_manager} />
      <div className="min-h-screen lg:pl-64">
        <TopBar me={me} onLogout={logout} />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </SessionContext.Provider>
  );
}
