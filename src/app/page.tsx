import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Building2,
  Database,
  Github,
  GitFork,
  Radar,
  Rss,
  Scale,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react";
import { RadarMark } from "@/components/brand/radar-mark";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Target,
    title: "Describe what you sell",
    body: "Write a sentence about your product. The ICP interpreter turns it into industries, size bands, geographies, buyer roles and the signals that actually matter.",
    detail: "Editable before a single search runs",
  },
  {
    icon: Rss,
    title: "Scan permitted sources",
    body: "RSS, public job feeds, company websites, URLs you add and an optional web-search provider. No LinkedIn scraping, no auth bypass, no robots evasion.",
    detail: "Every claim keeps its source URL",
  },
  {
    icon: Radar,
    title: "Rank evidence, not vibes",
    body: "ICP-fit, buying-signal and priority scores stay separate. Weights are configurable and every component is visible, so you can argue with the maths.",
    detail: "Scores are fit signals, never purchase probability",
  },
  {
    icon: GitFork,
    title: "Map the shortest intro",
    body: "Import the contacts you already know. Breadth-first search finds the shortest path from you to a buyer, labelled by relationship type and strength.",
    detail: "No invented relationships",
  },
];

const modules = [
  {
    icon: Building2,
    title: "Ranked prospect board",
    body: "Companies sorted by priority with verified size, location, signal count and the evidence behind each claim.",
  },
  {
    icon: Bookmark,
    title: "Action centre",
    body: "Save, mark contacted, disqualify, take notes, copy source links and export a clean CSV for your CRM.",
  },
  {
    icon: Workflow,
    title: "Referral graph",
    body: "CSV import and manual relationships rendered in React Flow, with shortest-path suggestions and intro-request drafts.",
  },
  {
    icon: Scale,
    title: "Configurable scoring",
    body: "Tune weights per workspace, rescore in one click and see exactly which components moved a prospect up or down.",
  },
  {
    icon: ShieldCheck,
    title: "Sanitised reports",
    body: "Share a read-only report with signal evidence and scores. Contacts, notes and graph data never leave the workspace.",
  },
  {
    icon: Database,
    title: "Honest data modes",
    body: "Synthetic demo data is always labelled DEMO. If no connectors are configured, the app says so instead of pretending it scanned the web.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] grid-fade" />
      <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(184,242,106,0.09),transparent_62%)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-foreground">
          <RadarMark size={26} className="text-signal-lime" />
          <span className="text-[13px] font-semibold tracking-[-0.01em]">Buying Signal Radar</span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <a
            href="https://github.com/Savarnya1403/buying-signal-radar"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Github className="h-3.5 w-3.5" />
            Source
          </a>
          <Button asChild size="sm" variant="ghost" className="text-[12px]">
            <Link href="/dashboard">Open app</Link>
          </Button>
          <Button asChild size="sm" className="text-[12px]">
            <Link href="/discover">
              Start discovering
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.025] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-lime opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-lime" />
            </span>
            Open-source GTM engineering
          </span>

          <h1 className="mt-7 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-gradient sm:text-6xl">
            Discover who might need you, why now, and who could introduce you.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Buying Signal Radar turns one sentence about your product into an editable ICP, scans permitted public
            sources for evidence-backed buying signals, ranks the companies worth a conversation, and finds the
            shortest warm path to the buyer.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/discover">
                Build my ICP
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard">
                Explore demo workspace
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
            No signup · Demo data clearly labelled · Postgres-backed
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-4xl">
          <div className="panel relative overflow-hidden p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(184,242,106,0.06),transparent_55%)]" />
            <div className="relative grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
              <div>
                <p className="label-mono">Input</p>
                <p className="mt-2 rounded-lg border border-white/[0.07] bg-[#070a0e] p-3 text-[13px] leading-relaxed text-foreground/90">
                  “We sell a revenue-operations workspace for European fintechs. Teams of 100–800 people, usually
                  after a Series A or B, when they start hiring sales leaders and opening new offices.”
                </p>
                <p className="label-mono mt-5">Extracted ICP</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "Fintech",
                    "100–800 employees",
                    "UK · DACH · Nordics",
                    "RevOps / VP Sales",
                    "Hiring",
                    "Funding",
                    "Geographic expansion",
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-muted-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-[#080c10] p-4">
                <div className="flex items-center justify-between">
                  <span className="label-mono">Priority</span>
                  <span className="rounded border border-[#a78bfa]/25 bg-[#a78bfa]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#c4b5fd]">
                    Sample
                  </span>
                </div>
                <p className="mt-3 text-[15px] font-medium text-foreground">Kestrel Finance</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">London, UK · 240 employees · Fintech</p>

                <div className="mt-4 space-y-2.5">
                  {[
                    { label: "ICP fit", value: 86, tone: "#b8f26a" },
                    { label: "Buying signal", value: 74, tone: "#7dd3fc" },
                    { label: "Priority", value: 81, tone: "#fbbf24" },
                  ].map((score) => (
                    <div key={score.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-muted-foreground">{score.label}</span>
                        <span className="font-mono text-[10px] tabular-nums text-foreground/80">{score.value}</span>
                      </div>
                      <div className="score-track mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${score.value}%`, backgroundColor: score.tone }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
                  <p className="flex items-start gap-2 text-[10.5px] leading-snug text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#fbbf24]" />
                    Raised $24M Series B to expand treasury tooling
                  </p>
                  <p className="flex items-start gap-2 text-[10.5px] leading-snug text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#7dd3fc]" />
                    Hiring a VP Sales in London
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
                  <GitFork className="h-3 w-3 text-signal-lime" />
                  <span className="text-[10px] text-muted-foreground">
                    You → Alex → <span className="text-foreground/80">Priya Shah</span> · 1 intro
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/[0.05] bg-[#06080b]/60">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="label-mono text-center">The loop</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            From sentence to shortlist in four steps
          </h2>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="panel panel-hover flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-signal-lime">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/90">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-[13.5px] font-medium text-foreground">{step.title}</h3>
                <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-muted-foreground">{step.body}</p>
                <p className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground/90">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-mono">Inside the workspace</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Built for the follow-through</h2>
          </div>
          <p className="max-w-md text-[12px] leading-relaxed text-muted-foreground">
            Finding a signal is the easy part. The workspace keeps the evidence, the reasoning and the next action
            together so a shortlist becomes a conversation.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div key={module.title} className="panel panel-hover p-5">
              <module.icon className="h-4 w-4 text-signal-lime/80" />
              <h3 className="mt-3 text-[13px] font-medium text-foreground">{module.title}</h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{module.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-white/[0.05] bg-[#06080b]/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="label-mono">Data ethics by default</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">Collect less. Prove more.</h2>
            <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
              Every connector respects <span className="text-foreground/85">robots.txt</span>, blocks private network
              ranges, and records the exact URL, date and snippet behind a signal. There is no LinkedIn scraping, no
              login bypass and no IP rotation. When a source is unavailable, the UI tells you.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["SSRF-safe fetching", "Private IPs and redirects blocked"],
              ["robots.txt aware", "Per-host checks before parsing"],
              ["Provenance on every claim", "Source, date, snippet, confidence"],
              ["Privacy by default", "Reports exclude contacts and notes"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5">
                <p className="text-[11.5px] font-medium text-foreground">{title}</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 text-center sm:px-8">
        <RadarMark size={40} className="mx-auto text-signal-lime/70" />
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Point it at your market.
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-[12.5px] leading-relaxed text-muted-foreground">
          Start with the demo dataset to see the full loop, then swap in live sources when you are ready.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/discover">
              Describe your product
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Open the dashboard</Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <RadarMark size={16} className="text-signal-lime/70" />
            Buying Signal Radar · MIT licensed
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/discover" className="transition-colors hover:text-foreground">
              Discover
            </Link>
            <Link href="/sources" className="transition-colors hover:text-foreground">
              Signal sources
            </Link>
            <a
              href="https://github.com/Savarnya1403/buying-signal-radar"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              GitHub <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
