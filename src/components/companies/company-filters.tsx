"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterOption = { value: string; label: string };

export function CompanyFilters({
  industries,
  signalOptions,
  total,
}: {
  industries: FilterOption[];
  signalOptions: FilterOption[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    const next = params.toString();
    startTransition(() => router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  };

  const active =
    Boolean(searchParams.get("q")) ||
    Boolean(searchParams.get("status")) ||
    Boolean(searchParams.get("signal")) ||
    Boolean(searchParams.get("industry"));

  return (
    <div className="panel p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            update("q", query.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, domain, industry or location…"
            className="h-9 pl-8 pr-16 text-[12px]"
            aria-label="Search prospects"
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query !== (searchParams.get("q") ?? "") && (
              <Button type="submit" size="sm" className="h-6 px-2 text-[10px]">Go</Button>
            )}
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />}
          </div>
        </form>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <Select value={searchParams.get("sort") ?? "priority"} onValueChange={(value) => update("sort", value)}>
            <SelectTrigger className="h-9 w-full text-[11px] lg:w-[142px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority score</SelectItem>
              <SelectItem value="signal">Signal score</SelectItem>
              <SelectItem value="icp">ICP fit</SelectItem>
              <SelectItem value="recent">Most recent signal</SelectItem>
              <SelectItem value="name">Company name</SelectItem>
            </SelectContent>
          </Select>
          <Select value={searchParams.get("status") ?? "active"} onValueChange={(value) => update("status", value)}>
            <SelectTrigger className="h-9 w-full text-[11px] lg:w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active pipeline</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="SAVED">Saved</SelectItem>
              <SelectItem value="CONTACTED">Contacted</SelectItem>
              <SelectItem value="DISQUALIFIED">Disqualified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={searchParams.get("signal") ?? "all"} onValueChange={(value) => update("signal", value)}>
            <SelectTrigger className="h-9 w-full text-[11px] lg:w-[150px]"><SelectValue placeholder="Signal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any signal</SelectItem>
              {signalOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={searchParams.get("industry") ?? "all"} onValueChange={(value) => update("industry", value)}>
            <SelectTrigger className="h-9 w-full text-[11px] lg:w-[150px]"><SelectValue placeholder="Industry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any industry</SelectItem>
              {industries.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
          <SlidersHorizontal className="h-3 w-3" /> {total} prospect{total === 1 ? "" : "s"}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            className={cn("inline-flex items-center gap-1 rounded border border-white/[0.08] px-2 py-0.5 font-mono text-[9px] text-muted-foreground/60 transition-colors hover:text-foreground")}
          >
            Clear filters <X className="h-2.5 w-2.5" />
          </button>
        )}
        <span className="ml-auto hidden text-[10px] text-muted-foreground/40 sm:block">
          Priority = weighted ICP-fit + signal index. Not a probability of purchase.
        </span>
      </div>
    </div>
  );
}
