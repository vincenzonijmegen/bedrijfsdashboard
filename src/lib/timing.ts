// src/lib/timing.ts
export function startTimer(label: string) {
  if (process.env.DIAG !== "1") return { end: () => {} };
  const t0 = process.hrtime.bigint();
  return {
    end(extra?: Record<string, unknown>) {
      const t1 = process.hrtime.bigint();
      const ms = Number(t1 - t0) / 1_000_000;
      console.log(JSON.stringify({ tag: "TIMING", label, ms: +ms.toFixed(1), ...extra }));
    },
  };
}
