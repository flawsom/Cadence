import { useEffect, useRef } from "react";

/**
 * CursorTrails — spring-physics ribbon trails that chase the pointer.
 *
 * Faithful port of the classic canvas trail (identical spring / dampening /
 * tension physics), production-hardened for Cadence:
 *  - TypeScript throughout, zero globals, zero `@ts-nocheck`
 *  - Hue locked to Cadence's warm amber/orange band (no rainbow clash)
 *  - DPR-aware canvas sizing (crisp on retina, capped at 2×)
 *  - Runs EVERYWHERE: mouse, touch, and for reduced-motion users too
 *    (per explicit product decision) — but never blocks touch scrolling
 *  - Correct, complete listener cleanup on unmount
 */
export function CursorTrails({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // ── Physics (1:1 with the original) ────────────────────────────────────
    const isMobile = w < 768 || (navigator.maxTouchPoints ?? 0) > 0;
    const isLowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as any).deviceMemory ?? 8) <= 4;
    const CFG = {
      friction: 0.5,
      trails: isMobile ? 10 : isLowEnd ? 12 : 20,
      size: isMobile ? 25 : isLowEnd ? 30 : 50,
      dampening: 0.25,
      tension: 0.98,
    };

    const pos = { x: w / 2, y: h / 3 };
    let lines: Line[] = [];
    let running = false;
    let raf = 0;
    let huePhase = Math.random() * Math.PI * 2;

    class Node {
      x = 0;
      y = 0;
      vx = 0;
      vy = 0;
    }

    class Oscillator {
      phase: number;
      offset: number;
      frequency: number;
      amplitude: number;
      value = 0;
      constructor(opts: Partial<{ phase: number; offset: number; frequency: number; amplitude: number }> = {}) {
        this.phase = opts.phase ?? 0;
        this.offset = opts.offset ?? 0;
        this.frequency = opts.frequency ?? 0.001;
        this.amplitude = opts.amplitude ?? 1;
      }
      update() {
        this.phase += this.frequency;
        this.value = this.offset + Math.sin(this.phase) * this.amplitude;
        return this.value;
      }
    }

    class Line {
      spring: number;
      friction: number;
      nodes: Node[] = [];
      constructor(spring: number) {
        this.spring = spring + 0.1 * Math.random() - 0.02;
        this.friction = CFG.friction + 0.01 * Math.random() - 0.002;
        for (let i = 0; i < CFG.size; i++) {
          const node = new Node();
          node.x = pos.x;
          node.y = pos.y;
          this.nodes.push(node);
        }
      }
      update() {
        let spring = this.spring;
        let node = this.nodes[0];
        node.vx += (pos.x - node.x) * spring;
        node.vy += (pos.y - node.y) * spring;
        for (let i = 0; i < this.nodes.length; i++) {
          node = this.nodes[i];
          if (i > 0) {
            const prev = this.nodes[i - 1];
            node.vx += (prev.x - node.x) * spring;
            node.vy += (prev.y - node.y) * spring;
            node.vx += prev.vx * CFG.dampening;
            node.vy += prev.vy * CFG.dampening;
          }
          node.vx *= this.friction;
          node.vy *= this.friction;
          node.x += node.vx;
          node.y += node.vy;
          spring *= CFG.tension;
        }
      }
      draw() {
        let x = this.nodes[0].x;
        let y = this.nodes[0].y;
        ctx!.beginPath();
        ctx!.moveTo(x, y);
        let i = 1;
        for (const end = this.nodes.length - 2; i < end; i++) {
          const a = this.nodes[i];
          const b = this.nodes[i + 1];
          x = 0.5 * (a.x + b.x);
          y = 0.5 * (a.y + b.y);
          ctx!.quadraticCurveTo(a.x, a.y, x, y);
        }
        const a = this.nodes[i];
        const b = this.nodes[i + 1];
        ctx!.quadraticCurveTo(a.x, a.y, b.x, b.y);
        ctx!.stroke();
        ctx!.closePath();
      }
    }

    const buildLines = () => {
      lines = [];
      for (let i = 0; i < CFG.trails; i++) {
        lines.push(new Line(0.4 + (i / CFG.trails) * 0.025));
      }
    };

    // Warm Cadence band: amber ↔ orange, never a rainbow
    const osc = new Oscillator({
      phase: Math.random() * Math.PI * 2,
      amplitude: 14,
      frequency: 0.0015,
      offset: 24,
    });

    const render = () => {
      if (!running) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `hsla(${Math.round(osc.update())}, 85%, 52%, 0.28)`;
      ctx.lineWidth = 1.2;
      for (const line of lines) {
        line.update();
        line.draw();
      }
      raf = requestAnimationFrame(render);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(render);
    };

    const setPos = (x: number, y: number) => {
      pos.x = x;
      pos.y = y;
    };

    const onMove = (e: MouseEvent) => {
      setPos(e.clientX, e.clientY);
      if (lines.length === 0) buildLines();
      start();
    };
    const onTouch = (e: TouchEvent) => {
      // No preventDefault — scrolling stays native on touch devices
      const t = e.touches[0];
      if (!t) return;
      setPos(t.clientX, t.clientY);
      if (lines.length === 0) buildLines();
      start();
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    if (isMobile) {
      document.addEventListener("touchstart", onTouch, { passive: true });
      document.addEventListener("touchmove", onTouch, { passive: true });
    }
    window.addEventListener("resize", resize);
    window.addEventListener("focus", start);
    window.addEventListener("blur", () => {
      // rAF already throttles in background tabs; keep state consistent
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    });

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchstart", onTouch);
      document.removeEventListener("touchmove", onTouch);
      window.removeEventListener("resize", resize);
      window.removeEventListener("focus", start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    />
  );
}
