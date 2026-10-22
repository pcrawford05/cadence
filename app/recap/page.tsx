import { getRecap, getRepo } from "@/lib/session";
import { aiEnabled } from "@/lib/ai";
import { isDemo } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";
import RecapClient, { type RecapItem } from "@/components/RecapClient";

export const dynamic = "force-dynamic";

export default async function RecapPage() {
  const repo = await getRepo();
  const store = await getRecap();
  const [proposals, contacts, settings] = await Promise.all([store.listProposals(), repo.listContactsBare(), repo.getSettings()]);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const needed = [...new Set(proposals.map((p) => p.contact_id).filter(Boolean) as string[])].map((id) => byId.get(id)!).filter(Boolean);
  const signed = new Map((await repo.withPhotos(needed)).map((c) => [c.id, c]));

  const items: RecapItem[] = proposals.map((p) => {
    const c = p.contact_id ? signed.get(p.contact_id) : null;
    return {
      id: p.id, status: p.status, date: p.occurred_at.slice(0, 10), kind: p.kind, source: p.source,
      summary: p.summary ?? "", evidence: p.evidence, confidence: p.confidence ?? 0.5,
      person: c
        ? { kind: "existing", id: c.id, name: c.name, sub: [c.position, c.company].filter(Boolean).join(" at "), photo: c.photo_url, type: c.type }
        : { kind: "new", name: p.new_contact?.name ?? "Someone", email: p.new_contact?.email ?? null, company: p.new_contact?.company ?? "", position: p.new_contact?.position ?? "", notes: p.new_contact?.notes ?? null },
    };
  });

  return (
    <>
      <PageHeader title="Recap" sub="Who did you meet in the last 3 days, and what did you talk about?" />
      <RecapClient items={items} googleConnected={isDemo() || !!settings.google_email} ai={aiEnabled() || isDemo()} lastSync={settings.google_last_sync} />
    </>
  );
}
