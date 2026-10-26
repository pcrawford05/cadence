import SignIn from "./SignIn";
import { Reveal, Tagline } from "./Motion";
import { DueDeck, Mark, Morning, Recap, Rhythm } from "./Stories";

const STEPS = [
  {
    title: "Give everyone a rhythm",
    body: "Every two weeks for a mentor, once a year for an old classmate, or only when it's relevant. Six colors, readable at a glance.",
    visual: <Rhythm />,
  },
  {
    title: "Get a short list each morning",
    body: "A morning push tells you who is due. The badge on the app icon counts what is left, so you know when you are done.",
    visual: <Morning />,
  },
  {
    title: "Let Recap keep the log",
    body: "Cadence reads your calendar and the mail you sent, then asks before logging a conversation. One tap resets the clock.",
    visual: <Recap />,
  },
];

const FEATURES = [
  { title: "Sort LinkedIn five a day", body: "Import your connections once. The Inbox hands you five a day, so 500 people never feel like homework." },
  { title: "Faces, not rows", body: "Paste or drop a photo onto anyone. The ring around each face shows their rhythm on every screen." },
  { title: "Ask your AI who is due", body: "Cadence speaks MCP, so Claude can list who is due, log a coffee chat, or add someone you just met." },
  { title: "Private by default", body: "Everyone you add is visible only to you. Gmail access reads headers only, never the messages." },
];

/** Signed-out home: what Cadence does, shown with the real UI acting out its job. */
export default function Landing({ error }: { error?: string }) {
  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full py-1.5 pl-3 pr-1.5">
          <a href="#top" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <Mark className="h-7 w-7" /> Cadence
          </a>
          <a href="#start" className="btn-ghost h-9 px-4 font-semibold">Sign in</a>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 pb-20 pt-12 sm:pt-20 lg:grid-cols-2 lg:gap-16 lg:pb-28">
          <div className="text-center lg:text-left">
            <p className="lp-rise chip mx-auto w-fit lg:mx-0" style={{ ["--d" as string]: 0 }}>A personal CRM for coffee chats, recruiters and founders</p>
            <h1 className="lp-rise mx-auto mt-5 max-w-2xl text-balance font-display text-5xl font-semibold tracking-tight sm:text-6xl lg:mx-0" style={{ ["--d" as string]: 1 }}>
              Stay close to the people who matter.
            </h1>
            <p className="lp-rise mx-auto mt-5 max-w-xl text-pretty text-lg text-muted lg:mx-0" style={{ ["--d" as string]: 2 }}>
              Cadence tells you who to reach out to today. Give each person a rhythm, and it keeps the schedule,
              reads your calendar and sent mail, and logs the conversations for you.
            </p>
            <div className="lp-rise mt-8" style={{ ["--d" as string]: 3 }}>
              <SignIn error={error} />
              <p className="mt-4 flex items-center justify-center gap-2.5 text-balance text-left text-sm text-muted lg:justify-start">
                <img src="/peyton.jpg" alt="Peyton Crawford" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-card" />
                <span>Invite only for now. Ask Peyton to add your Google account.</span>
              </p>
            </div>
          </div>
          <div className="lp-rise" style={{ ["--d" as string]: 5 }}>
            <DueDeck />
          </div>
        </section>

        <section className="py-20 text-center sm:py-32">
          <Tagline lines={["Your network doesn't fade all at once.", "It fades one missed coffee at a time.", "Cadence catches the next one."]} />
        </section>

        <section aria-labelledby="how" className="py-12 sm:py-20">
          <Reveal className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">How it works</p>
            <h2 id="how" className="mt-2 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">Three habits, kept for you</h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 80} className="flex flex-col rounded-3xl border border-line bg-card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">{i + 1}</span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-pretty text-muted">{s.body}</p>
                <div className="mt-6 flex-1 content-end">{s.visual}</div>
              </Reveal>
            ))}
          </div>
        </section>

        <section aria-label="More" className="grid gap-4 py-12 sm:grid-cols-2 sm:py-20 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60} className="rounded-3xl border border-line bg-card/70 p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-pretty text-sm text-muted">{f.body}</p>
            </Reveal>
          ))}
        </section>

        <section id="start" className="scroll-mt-24 py-16 sm:py-24">
          <Reveal className="rounded-[2rem] border border-line bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
            <Mark className="mx-auto h-14 w-14" />
            <h2 className="mx-auto mt-6 max-w-xl text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Start with the five people you keep meaning to text.
            </h2>
            <SignIn className="mt-8" />
            <p className="mt-3 text-sm text-muted">Invite only. Your contacts stay private to your login.</p>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-10 text-sm text-muted sm:px-6">
        <span className="flex items-center gap-2"><Mark className="h-5 w-5" /> Cadence</span>
        <span className="flex items-center gap-2"><img src="/peyton.jpg" alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> Built by Peyton for a small circle. Not for sale.</span>
      </footer>
    </div>
  );
}
