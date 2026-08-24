import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { todayISO } from "@/lib/planning";
import { useMutation } from "convex/react";
import { Loader2, Sparkles } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export function NewPlanDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const [rawInput, setRawInput] = React.useState("");
  const [hoursPerDay, setHoursPerDay] = React.useState("2");
  const [targetDays, setTargetDays] = React.useState("30");
  const [pending, setPending] = React.useState(false);

  const createPlan = useMutation(api.plans.createPlan);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rawInput.trim().length < 2) return;
    setPending(true);
    try {
      // Cadence's deterministic pacing engine does the sequencing —
      // fundamentals first, sized to the hours you actually have.
      const result = await createPlan({
        rawInput,
        hoursPerDay: Number(hoursPerDay),
        targetDays: Math.max(1, Math.min(366, Number(targetDays) || 30)),
        startDayKey: todayISO(),
      });

      toast.success(
        `Planned ${result.scheduledDays} day${result.scheduledDays === 1 ? "" : "s"} of study`,
        {
          description: "Sequenced fundamentals-first by the pacing engine.",
        },
      );
      setRawInput("");
      setIsOpen(false);
      navigate(`/dashboard/plans/${result.planId}`);
    } catch (err) {
      toast.error("Couldn't build that plan", {
        description: err instanceof Error ? err.message : "Try rephrasing your input.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start a new plan</DialogTitle>
          <DialogDescription>
            Paste a syllabus, a course outline, or simply say what you want to learn.
            Cadence will sequence it fundamentals-first and size each day to your hours.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="syllabus">Syllabus or subject</Label>
            <Textarea
              id="syllabus"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={"e.g.\nI want to learn Rust\n\n—or—\nWeek 1: Introduction to cells\nWeek 2: Photosynthesis…"}
              rows={7}
              required
              minLength={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hours">Hours per day</Label>
              <Select value={hoursPerDay} onValueChange={setHoursPerDay}>
                <SelectTrigger id="hours">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["0.5", "1", "1.5", "2", "3", "4", "6"].map((h) => (
                    <SelectItem key={h} value={h}>
                      {h} h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="days">Finish within (days)</Label>
              <Input
                id="days"
                type="number"
                min={3}
                max={366}
                value={targetDays}
                onChange={(e) => setTargetDays(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            If your material needs more days than you asked for, we&apos;ll say so —
            never quietly squeeze it in.
          </p>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || rawInput.trim().length < 2}
              className="gap-2 rounded-full shadow-pop-sm"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Building your pace…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Build my schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
