import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-7 animate-fade-up", className)}>
      {backHref && (
        <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="label-mono mb-2">{eyebrow}</p>}
          <h1 className="balance text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[32px]">{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
