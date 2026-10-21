import type { NextConfig } from "next";

// /api/* is the Python (Flask) API in api/app.py.
// - On Vercel it runs as a Python function and vercel.json sends /api/* to it, so no rewrite is needed here.
// - Locally and in Docker, Next.js forwards /api/* to the Flask server, so the browser only talks to one address
//   and the login cookie just works. API_URL: http://127.0.0.1:5000 locally, http://api:5000 in Docker.
const API_URL = process.env.API_URL || "http://127.0.0.1:5000";
const onVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  output: onVercel ? undefined : "standalone",
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return onVercel ? [] : [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
