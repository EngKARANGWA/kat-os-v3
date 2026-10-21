"use client";

// Short scanner beeps so staff can scan without looking at the screen: high = OK, low = problem.
let ctx: AudioContext | null = null;

export function beep(kind: "ok" | "error") {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === "ok" ? 1320 : 220;
    osc.type = kind === "ok" ? "sine" : "square";
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + (kind === "ok" ? 0.08 : 0.3));
  } catch {
    /* no sound available — the on-screen message still shows */
  }
  navigator.vibrate?.(kind === "ok" ? 40 : [80, 60, 80]);
}
