import { useAuth } from "@/hooks/use-auth";
import { CadenceMark, CadenceWordmark } from "@/components/CadenceMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { todayISO } from "@/lib/planning";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Code2,
  Flame,
  Hourglass,
  Layers,
  Repeat2,
  RotateCcw,
  Server,
  Sparkles,
  Users,
} from "lucide-react";
import * as React from "react";
import { Link } from "react-router";

const AUTH_NEW_PLAN = `/auth?returnTo=${encodeURIComponent("/dashboard/plans?new=1")}`;

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();

  const startHref =
    !isLoading && isAuthenticated ? "/dashboard" : AUTH_NEW_PLAN;
  const startLabel = !isLoading && isAuthenticated ? "Open dashboard" : "Start your plan";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav startHref={startHref} startLabel={startLabel} />
      <Hero startHref={startHref} startLabel={startLabel} />
      <HowItWorks />
      <Features />
      <PodsBand />
      <SelfHostStrip />
      <FinalCta startHref={startHref} startLabel={startLabel} />
      <Footer />
    </div>
  );
}

function Nav({ startHref, startLabel }: { startHref: string; startLabel: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Cadence home" className="rounded-lg transition-transform hover:-rotate-1">
          <CadenceWordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#features" className="transition-colors hover:text-foreground">Why Cadence</a>
          <a href="#pods" className="transition-colors hover:text-foreground">Pods</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full shadow-pop-sm">
            <Link to={startHref}>
              {startLabel} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({ startHref, startLabel }: { startHref: string; startLabel: string }) {
  return (
    <section className="texture-dots relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
            <Code2 className="size-3.5" /> Open-source &amp; self-hostable
          </Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Any syllabus.
            <br />
            <span className="squiggle">
              A pace you can keep.
              <svg viewBox="0 0 220 12" fill="none" preserveAspectRatio="none" aria-hidden>
                <path
                  d="M3 9c30-7 60-7 88-3s62 5 126-4"
                  stroke="var(--primary)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Cadence turns a course outline — or just a vague intention to learn something —
            into a day-by-day plan sized to the hours you actually have. Miss a day?
            Tomorrow picks it back up. Learn something? It comes back around before you
            forget it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2 rounded-full shadow-pop">
              <Link to={startHref}>
                <Sparkles className="size-4" /> {startLabel}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <a href="#how">
                See how it works <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free while self-hosted · No credit card, no leaderboard, no guilt
          </p>
        </motion.div>

        <DemoCard />
      </div>
    </section>
  );
}

interface DemoTask {
  id: string;
  label: string;
  hours: string;
  done: boolean;
  review?: boolean;
}

const DEMO_TASKS: DemoTask[] = [
  { id: "t1", label: "Ownership & borrowing", hours: "45m", done: true },
  { id: "t2", label: "Structs and enums (part 2 of 2)", hours: "1h", done: false },
  { id: "t3", label: "Review: error handling", hours: "20m", done: false, review: true },
];

const INITIAL_CHECKED = DEMO_TASKS.reduce<Record<string, boolean>>((acc, t) => {
  acc[t.id] = t.done;
  return acc;
}, {});

function DemoCard() {
  const [checked, setChecked] = React.useState<Record<string, boolean>>(INITIAL_CHECKED);
  const doneCount = DEMO_TASKS.filter((t) => checked[t.id]).length;
  const pct = Math.round((doneCount / DEMO_TASKS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-md"
    >
      {/* Floating stickers */}
      <motion.span
        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: -6 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 14 }}
        className="absolute -left-4 -top-5 z-10 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-pop-sm"
      >
        <Hourglass className="mr-1 inline size-3.5 text-primary" /> Never overloaded
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
        animate={{ opacity: 1, scale: 1, rotate: 5 }}
        transition={{ delay: 0.65, type: "spring", stiffness: 260, damping: 14 }}
        className="absolute -right-3 -bottom-4 z-10 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-pop-sm"
      >
        <RotateCcw className="mr-1 inline size-3.5 text-chart-2" /> Rolls forward, never dropped
      </motion.span>

      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-pop sm:p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Tuesday · Rust in 30 days
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold">A Tuesday, sized to your evening</h3>
          </div>
          <Flame className="size-5 text-primary/70" />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {DEMO_TASKS.map((task) => {
            const isDone = !!checked[task.id];
            return (
              <label
                key={task.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 px-3.5 py-3 transition-all hover:border-primary/40"
              >
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(c) => setChecked((prev) => ({ ...prev, [task.id]: c === true }))}
                  aria-label={`Toggle ${task.label}`}
                />
                <span className={`flex-1 text-sm font-medium ${isDone ? "text-muted-foreground line-through decoration-primary/40" : ""}`}>
                  {task.label}
                </span>
                {task.review && (
                  <Badge variant="outline" className="border-chart-2/50 text-[10px] uppercase tracking-wide text-chart-2">
                    Review
                  </Badge>
                )}
                <span className="text-xs tabular-nums text-muted-foreground">{task.hours}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {doneCount === DEMO_TASKS.length
              ? "Day complete. Go live your life."
              : `${doneCount}/${DEMO_TASKS.length} done · 1h 45m planned, 2h available`}
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/80">
          Go ahead — tick something off. That's the whole app.
        </p>
      </div>
    </motion.div>
  );
}

// ── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "1",
    title: "Paste it — or just say it",
    body: "A course outline, a certification blueprint, a photo of notes typed out, or two words like \u201clearn Rust.\u201d Cadence finds the topics either way.",
  },
  {
    n: "2",
    title: "Set your honest hours",
    body: "Tell Cadence what a real day looks like for you. It sequences fundamentals first and refuses to schedule more than you have — even quietly.",
  },
  {
    n: "3",
    title: "Show up and tick things off",
    body: "Each morning there's a short list waiting. Finish it and you're done; miss one and tomorrow absorbs it. Streaks reward showing up, not perfection.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/60 bg-sidebar/50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps between you and a plan"
          sub="No calendar wrangling. No spreadsheet. No 40-hour week fantasy."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative rounded-3xl border border-border/70 bg-card p-6"
            >
              <span className="font-display text-4xl font-semibold text-primary/25">{step.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Layers,
    color: "text-chart-2",
    title: "Fundamentals first, always",
    body: "Topics are sequenced foundations to advanced by meaning — not chopped up in document order like every other planner does.",
  },
  {
    icon: Hourglass,
    color: "text-primary",
    title: "Your day has a ceiling. We respect it.",
    body: "Running two subjects in parallel doesn't double your hours. Cadence budgets across everything so no single day quietly becomes a monster.",
  },
  {
    icon: RotateCcw,
    color: "text-chart-4",
    title: "Nothing silently disappears",
    body: "Unfinished work rolls to the next day, flagged and visible. Falling behind is information, not a failure the app hides from you.",
  },
  {
    icon: Repeat2,
    color: "text-chart-2",
    title: "Memory needs reminders",
    body: "Finished topics come back on a spaced schedule — a quick look-back after a day, then three, then seven — so learning sticks instead of evaporating.",
  },
  {
    icon: Users,
    color: "text-primary",
    title: "Pods: gentle accountability",
    body: "Run plans alongside a friend or two. You can see each other show up and leave check-in notes — deliberately without rankings or streak-shaming.",
  },
  {
    icon: Flame,
    color: "text-chart-3",
    title: "Progress you can feel good about",
    body: "Heatmaps, totals, and honest streaks that forgive a missed day. Motivation built for humans, not for screenshots.",
  },
];

function Features() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Why Cadence"
          title="Built on four ideas other tools only do halfway"
          sub="Schedulers that don't know curricula. Flashcard apps that can't plan. Trackers that gamify guilt. Cadence chains all of it together."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="group rounded-3xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop-sm"
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-muted transition-transform group-hover:-rotate-6">
                <f.icon className={`size-5 ${f.color}`} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold leading-snug">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pods band ───────────────────────────────────────────────────────────────

function PodsBand() {
  return (
    <section id="pods" className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-primary/20 bg-secondary/70">
        <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge variant="outline" className="gap-1.5 rounded-full border-primary/40 px-3 py-1.5 text-xs font-semibold">
              <Users className="size-3.5" /> Learning pods
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Study beside someone. Not against them.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start a pod, share a six-character code, and run entirely separate plans at
              entirely separate paces. You'll see who showed up today and what they're
              working through — and they'll see you. There is no leaderboard. The point
              is witnesses, not winners.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "See each pod-mate's daily progress at a glance",
                "One-line check-ins: how did it actually go?",
                "Members listed by join date — never ranked",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mini pod preview */}
          <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Today in Rust &amp; Reason · 2 checked in
            </p>
            {[
              { name: "Priya", note: "Borrow checker finally clicked.", pct: 100 },
              { name: "Sam", note: "Only got through half — long shift.", pct: 50 },
            ].map((m) => (
              <div key={m.name} className="rounded-2xl border border-border/60 px-4 py-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{m.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{m.pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-chart-2" style={{ width: `${m.pct}%` }} />
                </div>
                <p className="mt-2 text-xs italic text-muted-foreground">&ldquo;{m.note}&rdquo;</p>
              </div>
            ))}
            <p className="text-center text-[11px] text-muted-foreground/80">
              Both days count. That's the rule.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Self-host strip ─────────────────────────────────────────────────────────

function SelfHostStrip() {
  return (
    <section className="border-y border-border/60 bg-sidebar/50 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-card shadow-pop-sm">
          <Server className="size-5 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Your data, your machine
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Cadence is open-source and self-hostable. Every number you see comes from your
          own work — no mock dashboards, no dark patterns, no lock-in. Run it wherever
          you like and change whatever you don't.
        </p>
      </div>
    </section>
  );
}

// ── Final CTA + footer ──────────────────────────────────────────────────────

function FinalCta({ startHref, startLabel }: { startHref: string; startLabel: string }) {
  return (
    <section className="texture-dots py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl px-4 text-center sm:px-6"
      >
        <CadenceMark size={52} className="mx-auto rotate-3 rounded-2xl shadow-pop" />
        <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          The best day to start was weeks ago.
          <br />
          The second best is a plan away.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
          Name what you want to learn. Cadence will handle the order, the pacing,
          and the remembering.
        </p>
        <Button asChild size="lg" className="mt-8 gap-2 rounded-full shadow-pop">
          <Link to={startHref}>
            <Sparkles className="size-4" /> {startLabel}
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <CadenceWordmark markSize={26} />
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#features" className="transition-colors hover:text-foreground">Why Cadence</a>
          <a href="#pods" className="transition-colors hover:text-foreground">Pods</a>
          <Link to="/auth" className="transition-colors hover:text-foreground">Sign in</Link>
        </nav>
        <p className="text-xs text-muted-foreground/70">
          Open-source · Self-hostable · Built to be argued with
        </p>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{sub}</p>}
    </div>
  );
}
