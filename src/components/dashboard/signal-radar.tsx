"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SIGNAL_META } from "@/lib/signals";
import { cn } from "@/lib/utils";

export type RadarSignal = {
  id: string;
  type: string;
  company: string;
  companyId: string;
  title: string;
  daysAgo: number;
  confidence: number;
  demo: boolean;
};

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 31 + value.charCodeAt(index)) % 997;
  return total;
}

function radiusFor(days: number) {
  if (days <= 7) return 0.36 + (Math.max(0, days) / 7) * 0.12;
  if (days <= 30) return 0.52 + ((days - 7) / 23) * 0.24;
  return 0.8 + Math.min(0.12, ((days - 30) / 120) * 0.12);
}

export function SignalRadar({
  signals,
  demo,
  className,
}: {
  signals: RadarSignal[];
  demo?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const activeSignal = signals.find((signal) => signal.id === active) ?? null;

  const blips = useMemo(
    () =>
      signals.slice(0, 40).map((signal) => {
        const meta = SIGNAL_META[signal.type as keyof typeof SIGNAL_META] ?? SIGNAL_META.HIRING;
        const seed = hash(signal.id);
        const angle = (meta.angle + ((seed % 17) - 8)) * (Math.PI / 180);
        const radius = radiusFor(signal.daysAgo) * ((seed % 9) / 100 + 0.95);
        const x = 200 + Math.cos(angle) * radius * 168;
        const y = 200 + Math.sin(angle) * radius * 168;
        return {
          ...signal,
          meta,
          x,
          y,
          size: 2.4 + signal.confidence * 3.4,
          fresh: signal.daysAgo <= 2,
        };
      }),
    [signals],
  );

  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const signal of signals) counts.set(signal.type, (counts.get(signal.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [signals]);

  const last7 = signals.filter((signal) => signal.daysAgo <= 7).length;

  return (
    <div className={cn("panel relative overflow-hidden", className)}>
      <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="label-mono">Signal radar</p>
          <p className="mt-1 text-[12px] text-muted-foreground/70">
            {signals.length} signals · {last7} in the last 7 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          {demo ? (
            <span className="rounded border border-[#a78bfa]/25 bg-[#a78bfa]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#c4b5fd]">Demo</span>
          ) : (
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-signal-lime/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-lime opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-lime" />
              </span>
              Live scan
            </span>
          )}
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[430px] px-3 py-4">
        <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle,rgba(184,242,106,0.045),transparent_65%)]" />
        <svg viewBox="0 0 400 400" className="relative z-10 h-full w-full">
          <defs>
            <radialGradient id="radar-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#b8f26a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#b8f26a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sweep-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b8f26a" stopOpacity="0" />
              <stop offset="100%" stopColor="#b8f26a" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <circle cx="200" cy="200" r="168" fill="url(#radar-core)" />
          {[0.38, 0.68, 1].map((scale, index) => (
            <circle
              key={scale}
              cx="200"
              cy="200"
              r={168 * scale}
              fill="none"
              stroke="rgba(255,255,255,0.075)"
              strokeWidth={index === 2 ? 1 : 0.6}
              strokeDasharray={index === 1 ? "2 5" : undefined}
            />
          ))}
          {[0, 45, 90, 135].map((angle) => {
            const radians = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={200 - Math.cos(radians) * 168}
                y1={200 - Math.sin(radians) * 168}
                x2={200 + Math.cos(radians) * 168}
                y2={200 + Math.sin(radians) * 168}
                stroke="rgba(255,255,255,0.045)"
                strokeWidth="0.6"
              />
            );
          })}

          <g className="origin-center animate-radar-sweep" style={{ transformOrigin: "200px 200px" }}>
            <path d="M200 200 L368 200 A168 168 0 0 0 334 101 Z" fill="url(#sweep-gradient)" />
            <line x1="200" y1="200" x2="368" y2="200" stroke="#b8f26a" strokeOpacity="0.28" strokeWidth="0.8" />
          </g>

          <g>
            <text x="200" y="28" textAnchor="middle" className="fill-white/30 font-mono" fontSize="8" letterSpacing="1.5">7D</text>
            <text x="200" y="63" textAnchor="middle" className="fill-white/22 font-mono" fontSize="7.5" letterSpacing="1.5">30D</text>
            <text x="200" y="98" textAnchor="middle" className="fill-white/18 font-mono" fontSize="7" letterSpacing="1.5">90D</text>
          </g>

          {blips.map((blip) => {
            const isActive = active === blip.id;
            return (
              <g
                key={blip.id}
                className="cursor-pointer"
                onMouseEnter={() => setActive(blip.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(isActive ? null : blip.id)}
              >
                {blip.fresh && (
                  <circle cx={blip.x} cy={blip.y} r={blip.size + 3} fill="none" stroke={blip.meta.hex} strokeOpacity="0.3">
                    <animate attributeName="r" values={`${blip.size + 2};${blip.size + 9}`} dur="2.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.45;0" dur="2.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={blip.x}
                  cy={blip.y}
                  r={isActive ? blip.size + 2.5 : blip.size}
                  fill={blip.demo ? "transparent" : blip.meta.hex}
                  fillOpacity={blip.demo ? 0 : 0.9}
                  stroke={blip.meta.hex}
                  strokeWidth={blip.demo ? 1.2 : 1}
                  strokeDasharray={blip.demo ? "1.5 2" : undefined}
                  style={{ filter: `drop-shadow(0 0 ${isActive ? 7 : 3}px ${blip.meta.hex}80)`, transition: "r 150ms" }}
                />
                {isActive && <circle cx={blip.x} cy={blip.y} r={blip.size + 6} fill="none" stroke={blip.meta.hex} strokeOpacity="0.3" />}
              </g>
            );
          })}

          <circle cx="200" cy="200" r="2.2" fill="#b8f26a" fillOpacity="0.9" />
          <circle cx="200" cy="200" r="6" fill="none" stroke="#b8f26a" strokeOpacity="0.2" />
        </svg>

        {activeSignal && (
          <div
            className="pointer-events-none absolute z-20 w-[230px] -translate-x-1/2 rounded-lg border border-white/[0.12] bg-[#0c1117]/95 p-3 shadow-2xl backdrop-blur"
            style={{
              left: `${Math.min(78, Math.max(22, ((blips.find((blip) => blip.id === active)?.x ?? 200) / 400) * 100))}%`,
              top: `${Math.min(72, Math.max(18, ((blips.find((blip) => blip.id === active)?.y ?? 200) / 400) * 100 + 4))}%`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SIGNAL_META[activeSignal.type as keyof typeof SIGNAL_META]?.hex }} />
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                {SIGNAL_META[activeSignal.type as keyof typeof SIGNAL_META]?.label}
              </span>
              {activeSignal.demo && <span className="font-mono text-[8px] text-[#c4b5fd]">DEMO</span>}
            </div>
            <p className="mt-1 text-[11px] font-medium leading-snug text-foreground">{activeSignal.company}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{activeSignal.title}</p>
            <p className="mt-1.5 font-mono text-[9px] text-muted-foreground/50">
              {activeSignal.daysAgo === 0 ? "today" : `${activeSignal.daysAgo}d ago`} · {Math.round(activeSignal.confidence * 100)}% confidence
            </p>
            <Link href={`/companies/${activeSignal.companyId}`} className="mt-2 inline-block text-[10px] text-signal-lime hover:underline">
              Open intelligence →
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {legend.slice(0, 6).map(([type, count]) => {
            const meta = SIGNAL_META[type as keyof typeof SIGNAL_META];
            return (
              <span key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: meta.hex }} />
                {meta.shortLabel}
                <span className="font-mono text-muted-foreground/40">{count}</span>
              </span>
            );
          })}
          {legend.length === 0 && <span className="text-[10px] text-muted-foreground/50">No signals yet.</span>}
        </div>
      </div>
    </div>
  );
}
