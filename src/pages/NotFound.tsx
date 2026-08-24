import { CadenceMark } from "@/components/CadenceMark";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="texture-dots flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 16, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md text-center"
      >
        <CadenceMark size={56} className="mx-auto -rotate-3 rounded-2xl shadow-pop" />
        <p className="mt-8 font-display text-7xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">
          This page got rolled forward… somewhere.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          The link is off or the page never existed. Nothing of yours is lost —
          your plans are exactly where you left them.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="gap-2 rounded-full shadow-pop">
            <Link to="/dashboard">
              Go to today <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link to="/">
              <Compass className="size-4" /> Back home
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
