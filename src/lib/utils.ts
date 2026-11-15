import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "Date unavailable";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", opts ?? { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function relativeTime(value: Date | string | null | undefined) {
  if (!value) return "date unavailable";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "date unavailable";
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.max(0, Math.floor(diff / 3_600_000));
    if (hours <= 0) return "just now";
    return `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function truncate(text: string, max = 160) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function absoluteUrl(path = "/") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return new URL(path, base).toString();
}

export function scoreTone(score: number) {
  if (score >= 75) return "text-signal-lime";
  if (score >= 55) return "text-signal-mint";
  if (score >= 35) return "text-signal-amber";
  return "text-muted-foreground";
}
