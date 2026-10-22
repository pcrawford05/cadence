import { cache } from "react";
import { redirect } from "next/navigation";
import { DemoRepo, Repo, SupabaseRepo } from "./repo";
import { isDemo, serverClient } from "./supabase";

/**
 * Verifies the session JWT locally (asymmetric signing keys, cached JWKS), so no Auth server
 * round trip per request. Wrapped in React cache() so a page and its components share one check.
 */
const session = cache(async () => {
  if (isDemo()) return { db: null, user: { id: "demo-user", email: "demo@example.com" } };
  const db = await serverClient();
  const { data } = await db.auth.getClaims();
  const c = data?.claims;
  return { db, user: c?.sub ? { id: c.sub as string, email: (c.email as string) ?? "" } : null };
});

export async function currentUser(): Promise<{ id: string; email: string } | null> {
  return (await session()).user;
}

/** Repo for the signed-in user; redirects to /login when signed out. */
export const getRepo = cache(async (): Promise<Repo> => {
  if (isDemo()) return new DemoRepo();
  const { db, user } = await session();
  if (!user || !db) redirect("/login");
  return new SupabaseRepo(db, user.id);
});

/** Recap storage (signals + proposals) for the signed-in user. */
export async function getRecap() {
  const { DemoRecap, SupabaseRecap } = await import("./recap");
  if (isDemo()) return new DemoRecap();
  const { db, user } = await session();
  if (!user || !db) redirect("/login");
  return new SupabaseRecap(db, user.id);
}

/** Same as getRepo but returns null instead of redirecting (for API routes). */
export async function getRepoOrNull(): Promise<Repo | null> {
  if (isDemo()) return new DemoRepo();
  const { db, user } = await session();
  return user && db ? new SupabaseRepo(db, user.id) : null;
}
