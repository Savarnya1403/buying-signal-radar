import { cn } from "@/lib/utils";

export function RadarMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity="0.18" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeOpacity="0.22" />
      <circle cx="16" cy="16" r="4.5" stroke="currentColor" strokeOpacity="0.3" />
      <path d="M16 2.5V16L25.5 21" stroke="currentColor" strokeOpacity="0.35" strokeLinecap="round" />
      <path
        d="M16 16L29.2 12.2A13.5 13.5 0 0 0 18.6 2.7L16 16Z"
        fill="url(#radar-sweep-grad)"
        fillOpacity="0.55"
      />
      <circle cx="22" cy="10" r="1.7" fill="currentColor" />
      <circle cx="10.5" cy="20.5" r="1.2" fill="currentColor" fillOpacity="0.8" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <defs>
        <linearGradient id="radar-sweep-grad" x1="16" y1="16" x2="28" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
    </svg>
  );
}
