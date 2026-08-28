// Cadence app bootstrap — trails mounted globally below.
import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { CursorTrails } from "@/components/CursorTrails";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

// Register service worker for PWA offline caching
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const basePath = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker.register(`${basePath}sw.js`).catch(() => undefined);
  });
}
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "katex/dist/katex.min.css";
import "./index.css";

// Lazy load route components for better code splitting.
// Each import retries ONCE via a full page reload if the chunk fetch fails —
// a fresh deploy replaces hashed chunk names, so an open tab's cached
// index.html can reference chunks that no longer exist. Reloading picks up
// the new index.html; the sessionStorage guard prevents reload loops.
const CHUNK_RELOAD_KEY = "cadence:chunk-reload";
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function lazyRoute(load: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    load()
      .then((mod) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return mod;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
        }
        throw err;
      }),
  );
}

const Landing = lazyRoute(() => import("./pages/Landing.tsx"));
const AuthPage = lazyRoute(() => import("./pages/Auth.tsx"));
const Dashboard = lazyRoute(() => import("./pages/Dashboard.tsx"));
const TodayView = lazyRoute(() => import("./components/app/TodayView.tsx"));
const PlansView = lazyRoute(() => import("./components/app/PlansView.tsx"));
const PlanDetailView = lazyRoute(() =>
  import("./components/app/PlanDetailView.tsx"),
);
const PodView = lazyRoute(() => import("./components/app/PodView.tsx"));
const AnswerHistory = lazyRoute(() => import("./components/app/AnswerHistoryView.tsx"));
const NotFound = lazyRoute(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      {/* Cursor trails on EVERY route — mounted outside the router so it
          persists across navigation without ever re-initializing. */}
      <CursorTrails className="pointer-events-none fixed inset-0 z-30" />
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || undefined}>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              >
                <Route index element={<TodayView />} />
                <Route path="plans" element={<PlansView />} />
                <Route path="plans/:planId" element={<PlanDetailView />} />
                <Route path="pod" element={<PodView />} />
                <Route path="answers" element={<AnswerHistory />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
