import { redirect } from "next/navigation";
import { DemoRepo, Repo, SupabaseRepo } from "./repo";
import { isDemo, serverClient } from "./supabase";

export async function currentUser(): Promise<{ id: string; email: string } | null> {
  if (isDemo()) return { id: "demo-user", email: "demo@example.com" };
  const db = await serverClient();
  const { data } = await db.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}

/** Repo for the signed-in user; redirects to /login when signed out. */
export async function getRepo(): Promise<Repo> {
  if (isDemo()) return new DemoRepo();
  const db = await serverClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  return new SupabaseRepo(db, data.user.id);
}

/** Same as getRepo but returns null instead of redirecting (for API routes). */
export async function getRepoOrNull(): Promise<Repo | null> {
  if (isDemo()) return new DemoRepo();
  const db = await serverClient();
  const { data } = await db.auth.getUser();
  return data.user ? new SupabaseRepo(db, data.user.id) : null;
}
