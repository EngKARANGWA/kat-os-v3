"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Call the Flask API. Throws ApiError with the server's message on failure. */
export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method || (options.body === undefined ? "GET" : "POST");
  const send = () =>
    fetch(`/api${path}`, {
      method,
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  let res = await send();
  // 503 = the API lost its database connection and has already reconnected. Retry once when it is safe
  // (reads and sign-in); saves are not repeated automatically so nothing can be recorded twice.
  if (res.status === 503 && (method === "GET" || path === "/auth/login")) {
    await new Promise((r) => setTimeout(r, 400));
    res = await send();
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login" && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data as T;
}

/** Load data from the API on mount (and whenever `path` changes). Call `reload()` after saving. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

/** Turn a submitted <form> into a plain object (all values are strings; unchecked checkboxes are absent). */
export function formValues(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}
