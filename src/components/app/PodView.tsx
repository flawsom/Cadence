import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/convex/_generated/api";
import { fmtHours, prettyDate, todayISO } from "@/lib/planning";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Copy, MessageSquareHeart } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

type Pod = Exclude<FunctionReturnType<typeof api.pods.myPod>, null>;


export default function PodView() {
  const todayKey = todayISO();
  const pod = useQuery(api.pods.myPod, { todayKey });

  if (pod === undefined) {
    return <div className="mx-auto max-w-4xl animate-pulse text-sm text-muted-foreground">Finding your people…</div>;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your pod</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          One or two friends running their own plans beside you. You see each other show up —
          there&apos;s no leaderboard, just witnesses.
        </p>
      </header>

      {pod ? <PodDashboard pod={pod} /> : <NoPod />}
    </div>
  );
}

function NoPod() {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<"create" | "join" | null>(null);
  const createPod = useMutation(api.pods.createPod);
  const joinPod = useMutation(api.pods.joinPod);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      await createPod({ name: name || "Study pod" });
      toast.success("Pod created — share the code with a friend");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create pod");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    try {
      const result = await joinPod({ code });
      toast.success(`Joined “${result.name}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join pod");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-6"
      >
        <div>
          <h2 className="font-display text-lg font-semibold">Start a pod</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name it something you&apos;d say out loud, then pass the code to whoever&apos;s in.
          </p>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rust & Reason"
          maxLength={60}
        />
        <Button type="submit" disabled={busy !== null} className="rounded-full shadow-pop-sm">
          {busy === "create" ? "Creating…" : "Create pod"}
        </Button>
      </form>

      <form
        onSubmit={handleJoin}
        className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-6"
      >
        <div>
          <h2 className="font-display text-lg font-semibold">Join one</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Got a six-character code? Type it in and pull up a chair.
          </p>
        </div>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          required
          className="font-mono uppercase tracking-[0.3em]"
        />
        <Button type="submit" variant="outline" disabled={busy !== null} className="rounded-full">
          {busy === "join" ? "Joining…" : "Join pod"}
        </Button>
      </form>
    </div>
  );
}

function PodDashboard({ pod }: { pod: Pod }) {
  const leavePod = useMutation(api.pods.leavePod);

  return (
    <>
      <InviteBar name={pod.name} code={pod.code} />
      <CheckInComposer />
      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-semibold">
          Today in {pod.name} · {pod.todayCheckins} checked in
        </h2>
        {pod.members.map((m) => {
          const pct = m.totalCount > 0 ? Math.round((m.doneCount / m.totalCount) * 100) : 0;
          return (
            <div key={m.userId} className="rounded-3xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {m.name}
                  {m.isYou && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      You
                    </span>
                  )}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmtHours(m.doneHours)} of {fmtHours(m.plannedHours)} · {m.doneCount}/{m.totalCount} done
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-chart-2 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                <MessageSquareHeart className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                {m.checkinNote ? (
                  <span>&ldquo;{m.checkinNote}&rdquo;</span>
                ) : (
                  <span className="italic">No check-in yet today.</span>
                )}
              </p>
            </div>
          );
        })}
        <div className="mt-1 flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Members appear by join date — never ranked. Showing up is the whole game.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                Leave pod
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {pod.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;ll stop seeing each other&apos;s daily progress, and your
                  check-ins stay behind. Your own plans are untouched — you can
                  always rejoin with the code later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void leavePod().catch((err: unknown) =>
                      toast.error(err instanceof Error ? err.message : "Couldn't leave pod"),
                    );
                  }}
                >
                  Leave pod
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </>
  );
}

function InviteBar({ name, code }: { name: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-secondary/60 px-5 py-4">
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Invite code</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full bg-background font-mono tracking-[0.25em]"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
        aria-label={`Copy invite code ${code}`}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {code}
      </Button>
    </div>
  );
}

function CheckInComposer() {
  const todayKey = todayISO();
  const pod = useQuery(api.pods.myPod, { todayKey });
  const checkIn = useMutation(api.pods.checkIn);
  const mine = pod?.members.find((m) => m.isYou);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await checkIn({ note, todayKey });
      if (note.trim()) toast.success("Checked in for the day");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5">
      <label htmlFor="checkin" className="text-sm font-medium">
        How did it go today?
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="checkin"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          placeholder={
            mine?.checkinNote
              ? `Today's note: “${mine.checkinNote.slice(0, 60)}”`
              : "Finished chapter 4 — borrow checker finally clicked."
          }
          className="flex-1"
        />
        <Button onClick={() => void save()} disabled={saving} className="rounded-full shadow-pop-sm">
          {mine?.checkinNote ? "Update check-in" : "Check in"}
        </Button>
      </div>
    </div>
  );
}
