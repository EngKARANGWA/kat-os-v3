import type { NextConfig } from "next";

// Every /api/* request is forwarded to the Python (Flask) API, so the browser only ever
// talks to one address and the login cookie works without any extra setup.
// API_URL is read when the app is built/started: http://127.0.0.1:5000 locally, http://api:5000 in Docker.
const API_URL = process.env.API_URL || "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
