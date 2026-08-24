export function CadenceMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Cadence"
    >
      <defs>
        <linearGradient id="cadence-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0743B" />
          <stop offset="1" stopColor="#DE4E20" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#cadence-g)" />
      <g transform="rotate(-6 32 32)" fill="#FFF6EC">
        <rect x="14" y="26" width="7" height="14" rx="3.5" />
        <rect x="28.5" y="17" width="7" height="32" rx="3.5" />
        <rect x="43" y="23" width="7" height="20" rx="3.5" />
      </g>
    </svg>
  );
}

export function CadenceWordmark({
  className,
  markSize = 30,
}: {
  className?: string;
  markSize?: number;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <CadenceMark size={markSize} className="shrink-0 rounded-[10px] shadow-pop-sm" />
      <span
        className="font-display text-[1.35rem] font-semibold tracking-tight"
        style={{ fontFeatureSettings: '"SOFT" 40, "WONK" 1' }}
      >
        Cadence
      </span>
    </span>
  );
}
