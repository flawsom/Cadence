import katex from "katex";
import { useMemo } from "react";

/**
 * Renders a topic title, turning $…$ LaTeX segments into real math
 * (e.g. 'Dirac delta function $\delta(t)$'). Plain text passes through
 * untouched, so non-math titles cost nothing.
 */
const LATEX_RE = /\$([^$]+)\$/g;

export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = useMemo(() => {
    const segments: { tex?: string; text: string }[] = [];
    let last = 0;
    for (const m of text.matchAll(LATEX_RE)) {
      const idx = m.index ?? 0;
      if (idx > last) segments.push({ text: text.slice(last, idx) });
      segments.push({ tex: m[1], text: "" });
      last = idx + m[0].length;
    }
    if (last < text.length) segments.push({ text: text.slice(last) });
    return segments;
  }, [text]);

  return (
    <span className={className}>
      {parts.map((seg, i) =>
        seg.tex ? (
          <span
            key={i}
            // KaTeX output is generated locally from the title's own math
            // segment with throwOnError disabled — safe to inject.
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(seg.tex, {
                throwOnError: false,
                output: "html",
              }),
            }}
          />
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
