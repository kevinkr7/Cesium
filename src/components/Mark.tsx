/** Reactive CS monogram: two atoms that bond on hover. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`group/mark inline-flex items-center gap-1.5 font-display text-[15px] font-bold tracking-tight ${className}`}
    >
      <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden className="overflow-visible">
        <circle
          cx="5"
          cy="7"
          r="4"
          className="fill-none stroke-foreground transition-transform duration-300 group-hover/mark:translate-x-1"
          strokeWidth="1.2"
        />
        <line
          x1="9"
          y1="7"
          x2="17"
          y2="7"
          className="stroke-signal transition-opacity duration-300 opacity-0 group-hover/mark:opacity-100"
          strokeWidth="1.2"
        />
        <circle
          cx="21"
          cy="7"
          r="3"
          className="fill-signal transition-transform duration-300 group-hover/mark:-translate-x-1"
        />
      </svg>
      CS
    </span>
  );
}
