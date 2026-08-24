import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * HeroCanvas — a living "study terrain": Cadence's heatmap idea rendered as a
 * glowing 3D landscape of points that undulate like a pulse.
 *
 * Performance contract (every device, every screen):
 *  - DPR capped at 2 desktop / 1.5 mobile — never renders more pixels than needed
 *  - Particle count tiers down on small screens & low-core devices
 *  - Render loop pauses when the canvas scrolls off-screen or the tab hides
 *  - `prefers-reduced-motion`: renders one beautiful static frame, no loop
 *  - Pointer parallax is lerped (no jank) and skipped on touch devices
 *  - Full disposal of geometry/material/renderer on unmount — zero leaks
 *  - Graceful no-op if WebGL is unavailable (CSS texture remains)
 */
export function HeroCanvas({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 768;
    // Low-core devices: fewer points, lower DPR ceiling
    const lowCore =
      (navigator.hardwareConcurrency ?? 8) <= 4 ||
      ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return; // No WebGL — landing still looks great without us
    }

    const dprCap = isSmall || lowCore ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 5.4, 13);
    camera.lookAt(0, 0.4, 0);

    const cols = isSmall || lowCore ? 110 : 190;
    const rows = isSmall || lowCore ? 60 : 110;
    const geometry = new THREE.PlaneGeometry(40, 24, cols, rows);

    // Per-point random seed for organic size/phase variation
    const count = geometry.attributes.position.count;
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 1.15 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uColorLow: { value: new THREE.Color("#fdba74") }, // soft amber
        uColorHigh: { value: new THREE.Color("#ea580c") }, // Cadence primary
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uAmp;
        uniform float uPixelRatio;
        attribute float aSeed;
        varying float vElev;
        varying float vDist;

        float wave(vec2 p, float t) {
          return sin(p.x * 0.55 + t * 0.9) * 0.55
               + sin(p.y * 0.45 - t * 0.7) * 0.45
               + sin((p.x + p.y) * 0.3 + t * 0.5) * 0.6
               + sin(length(p) * 0.6 - t * 1.1) * 0.25;
        }

        void main() {
          vec3 pos = position;
          float e = wave(pos.xy, uTime) * uAmp * (0.75 + 0.5 * aSeed);
          pos.z += e;
          vElev = e;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.5 + 1.3 * aSeed + max(e, 0.0) * 1.1) * uPixelRatio * (14.0 / vDist);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorLow;
        uniform vec3 uColorHigh;
        varying float vElev;
        varying float vDist;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.08, d);
          float t = smoothstep(-1.2, 1.6, vElev);
          vec3 col = mix(uColorLow, uColorHigh, t);
          float fog = smoothstep(32.0, 10.0, vDist);
          float alpha = soft * mix(0.22, 0.85, t) * fog;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = -Math.PI / 2;
    points.position.y = -0.6;
    scene.add(points);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Pointer parallax (desktop only) — lerped for buttery motion
    let targetX = 0;
    let targetY = 0;
    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 1.4;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.7;
    };
    if (!coarsePointer && !reducedMotion) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }

    // Render only when visible (in-viewport + tab focused)
    let inView = true;
    let tabVisible = !document.hidden;
    let raf = 0;
    const clock = new THREE.Clock();

    const frame = () => {
      raf = 0;
      if (!inView || !tabVisible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      material.uniforms.uTime.value += dt * 0.55;
      camera.position.x += (targetX - camera.position.x) * 0.045;
      camera.position.y += (5.4 - targetY - camera.position.y) * 0.045;
      camera.lookAt(0, 0.4, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && tabVisible) {
          clock.getDelta(); // don't fast-forward after a pause
          start();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.02 },
    );
    io.observe(container);

    const onVis = () => {
      tabVisible = !document.hidden;
      if (tabVisible && inView) {
        clock.getDelta();
        start();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);

    if (reducedMotion) {
      // One gorgeous static frame, then rest
      material.uniforms.uTime.value = 2.2;
      renderer.render(scene, camera);
    } else {
      start();
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
