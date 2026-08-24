import { CadenceWordmark } from "@/components/CadenceMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { fmtHours, todayISO } from "@/lib/planning";
import { CalendarCheck2, Flame, Library, LogOut, Users } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";

const NAV = [
  { to: "/dashboard", label: "Today", icon: CalendarCheck2, end: true },
  { to: "/dashboard/plans", label: "Plans", icon: Library, end: false },
  { to: "/dashboard/pod", label: "Pod", icon: Users, end: false },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const todayKey = todayISO();
  const stats = useQuery(api.tasks.getStats, { todayKey });
  const syncRollover = useMutation(api.tasks.syncRollover);

  // Carry unfinished work forward the moment the app opens — visibly.
  void syncRollover({ todayKey }).catch(() => undefined);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <CadenceWordmark markSize={26} />
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/dashboard" ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Button
                key={to}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(to)}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            );
          })}
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </nav>
      </header>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-6 lg:flex">
        <button
          onClick={() => navigate("/")}
          className="mb-8 self-start rounded-xl transition-transform hover:-rotate-1"
          aria-label="Cadence home"
        >
          <CadenceWordmark />
        </button>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const active = end ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Button
                key={to}
                variant={active ? "secondary" : "ghost"}
                className={`justify-start gap-3 rounded-xl px-3 ${active ? "font-semibold text-secondary-foreground" : "text-muted-foreground"}`}
                onClick={() => navigate(to)}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          {stats && stats.streak > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-secondary/70 px-3 py-2.5">
              <Flame className="size-4 shrink-0 text-chart-1" />
              <div className="text-xs leading-tight">
                <span className="font-semibold">{stats.streak}-day streak</span>
                <p className="text-muted-foreground">{fmtHours(stats.totalHoursCompleted)} logged in total</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-2xl border border-border/70 px-3 py-2.5">
            <div className="min-w-0 text-xs leading-tight">
              <p className="truncate font-medium">{user?.name ?? user?.email ?? "You"}</p>
              <p className="truncate text-muted-foreground">Signed in</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
