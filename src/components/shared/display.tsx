import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SIGNAL_META } from "@/lib/signals";
import { cn, scoreTone } from "@/lib/utils";

export function SignalBadge({ type, compact = false }: { type: string; compact?: boolean }) {
  const meta = SIGNAL_META[type as keyof typeof SIGNAL_META] ?? SIGNAL_META.HIRING;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        meta.border,
        meta.bg,
        meta.text,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.hex }} />
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}

export function ScoreBar({
  label,
  score,
  max = 100,
  hint,
  className,
}: {
  label: string;
  score: number;
  max?: number;
  hint?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, (score / max) * 100));
  const color = score / max >= 0.75 ? "bg-signal-lime" : score / max >= 0.5 ? "bg-signal-mint" : score / max >= 0.3 ? "bg-signal-amber" : "bg-white/25";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-[11px] tabular-nums", scoreTone(score))}>{score}<span className="text-muted-foreground/50">/{max}</span></span>
      </div>
      <div className="score-track">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${percent}%` }} />
      </div>
      {hint && <p className="text-[10px] leading-relaxed text-muted-foreground/55">{hint}</p>}
    </div>
  );
}

export function ScoreRing({
  score,
  label,
  size = 92,
  sublabel,
}: {
  score: number;
  label: string;
  size?: number;
  sublabel?: string;
}) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 75 ? "#b8f26a" : score >= 55 ? "#5eead4" : score >= 35 ? "#fbbf24" : "#8b98a8";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}55)`, transition: "stroke-dashoffset 900ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[20px] font-medium leading-none tabular-nums" style={{ color }}>{score}</span>
          <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-medium text-foreground/80">{label}</p>
        {sublabel && <p className="mt-0.5 text-[9px] text-muted-foreground/55">{sublabel}</p>}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "lime" | "violet" | "amber";
  href?: string;
}) {
  const tones = {
    default: "text-foreground",
    lime: "text-signal-lime",
    violet: "text-[#c4b5fd]",
    amber: "text-signal-amber",
  };
  const content = (
    <div className="panel panel-hover group h-full p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="label-mono">{label}</p>
        {icon && <span className="text-muted-foreground/45 transition-colors group-hover:text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn("mt-3 text-[28px] font-medium leading-none tracking-tight tabular-nums", tones[tone])}>{value}</p>
      {detail && <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">{detail}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
}

export function Unverified({ children = "Unverified" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/55">
      ~ {children}
    </span>
  );
}

export function CompanyAvatar({ name, size = 38 }: { name: string; size?: number }) {
  const colors = ["#b8f26a", "#5eead4", "#a78bfa", "#fbbf24", "#fb7185", "#7dd3fc"];
  const index = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border font-mono font-medium"
      style={{
        width: size,
        height: size,
        borderColor: `${colors[index]}33`,
        backgroundColor: `${colors[index]}0f`,
        color: colors[index],
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-signal-lime">
        {icon}
      </div>
      <h3 className="text-[17px] font-medium">{title}</h3>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-signal-lime"
    >
      {children}
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}
