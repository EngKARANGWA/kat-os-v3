// `npm run dev`: starts the Python API (port 5000) and the Next.js website (port 3000) together.
// Ctrl+C stops both. To start only the website, use `npm run dev:web`.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const python = [".venv/Scripts/python.exe", ".venv/bin/python"].find((p) => existsSync(p)) ?? "python";
if (python === "python") console.warn("[dev] No .venv found, using the system python. If the API fails, run: python -m venv .venv && pip install -r requirements.txt");

const children = [
  spawn(python, ["api/app.py"], { stdio: "inherit" }),
  spawn("npx", ["next", "dev"], { stdio: "inherit", shell: true }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exit(code);
}
for (const c of children)
  c.on("exit", (code) => {
    if (!stopping) console.error(`[dev] ${c === children[0] ? "API" : "website"} stopped (exit ${code}); stopping the other one too.`);
    stop(code ?? 0);
  });
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
