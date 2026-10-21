"use client";
import { useEffect } from "react";

/**
 * If the app was open during a deploy, its buttons point at the previous version's server code.
 * Detect that and reload once to pick up the new version, instead of showing a crash.
 */
const STALE = /Server Action .* was not found|Failed to find Server Action|ChunkLoadError|Loading chunk .* failed/i;

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = STALE.test(error?.message ?? "");
  useEffect(() => {
    if (!stale) return;
    try {
      const last = Number(sessionStorage.getItem("cadence:reloaded") ?? 0);
      if (Date.now() - last < 15000) return; // avoid a reload loop
      sessionStorage.setItem("cadence:reloaded", String(Date.now()));
    } catch { /* storage blocked: still reload */ }
    window.location.reload();
  }, [stale]);

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-2xl">{stale ? "Updating to the latest version…" : "Something went wrong"}</p>
      {!stale && (
        <>
          <p className="mt-2 text-sm text-muted">Try again, and if it keeps happening, send feedback with F.</p>
          <button onClick={reset} className="btn-primary mt-5">Try again</button>
        </>
      )}
    </div>
  );
}
