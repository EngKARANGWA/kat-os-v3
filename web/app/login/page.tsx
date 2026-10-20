"use client";

import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { ApiForm, Field, SubmitButton } from "@/components/kat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-sidebar via-sidebar to-brand p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-light to-brand font-bold text-white">KAT</div>
          <CardTitle className="text-2xl font-semibold">KAT OS</CardTitle>
          <CardDescription>Kigali Apple Tech Operations System</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiForm action={(v) => api("/auth/login", { body: v })} onSuccess={() => router.replace("/")}>
            <Field label="Username" name="username" required autoComplete="username" />
            <Field label="Password" type="password" name="password" required autoComplete="current-password" />
            <SubmitButton full icon={<LogIn />} className="w-full">
              Sign in
            </SubmitButton>
          </ApiForm>
        </CardContent>
      </Card>
    </main>
  );
}
