import Landing from "@/components/landing/Landing";

/** Old sign-in URL, and where a failed Google sign-in lands with ?error=. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <Landing error={error} />;
}
