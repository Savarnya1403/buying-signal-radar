"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  FileUp,
  Globe,
  Hash,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  Rss,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatDate, relativeTime } from "@/lib/utils";

type SourceRow = {
  id: string;
  type: string;
  name: string;
  url: string | null;
  config: unknown;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastFetched: number;
  runs: { id: string; status: string; startedAt: string; itemsFetched: number; signalsCreated: number; duplicates: number; error: string | null }[];
};

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; permission: string }> = {
  RSS: { label: "RSS / Atom", icon: <Rss className="h-3.5 w-3.5" />, permission: "Public syndication feeds" },
  URL: { label: "Specific URL", icon: <Globe className="h-3.5 w-3.5" />, permission: "A page you submit" },
  WEBSITE: { label: "Company website", icon: <Globe className="h-3.5 w-3.5" />, permission: "Company-owned public pages" },
  JOB_FEED: { label: "Public job feed", icon: <Hash className="h-3.5 w-3.5" />, permission: "Public job APIs / ATS" },
  WEB_SEARCH: { label: "Authorised search", icon: <Search className="h-3.5 w-3.5" />, permission: "Tavily or Brave API" },
  HN: { label: "Hacker News", icon: <Radar className="h-3.5 w-3.5" />, permission: "Public Algolia API" },
};

const STATUS: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "Healthy", className: "text-signal-lime" },
  PARTIAL: { label: "Partial", className: "text-signal-amber" },
  FAILED: { label: "Failed", className: "text-[#ff9cac]" },
  RUNNING: { label: "Running", className: "text-signal-sky" },
};

export function SourcesManager({
  sources,
  catalog,
  runs,
}: {
  sources: SourceRow[];
  catalog: { type: string; label: string; description: string; permission: string; available: boolean; example: string }[];
  runs: { id: string; status: string; trigger: string; startedAt: string; finishedAt: string | null; itemsFetched: number; signalsCreated: number; companiesCreated: number; duplicates: number; sourceName: string | null; error: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const refresh = () => startTransition(() => router.refresh());

  const toggle = async (source: SourceRow, enabled: boolean) => {
    setBusyId(source.id);
    try {
      const response = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error("Could not update that source.");
      toast.success(enabled ? "Source enabled." : "Source paused.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const test = async (source: SourceRow) => {
    setBusyId(source.id);
    try {
      const response = await fetch(`/api/sources/${source.id}/test`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Connection test failed.");
      const documents = body.result?.documents?.length ?? 0;
      const warnings: string[] = body.result?.warnings ?? [];
      toast.success(`${source.name}: ${documents} document${documents === 1 ? "" : "s"} retrievable${warnings.length ? ` · ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}.`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (source: SourceRow) => {
    if (!window.confirm(`Delete “${source.name}”? Signals already collected stay in your workspace.`)) return;
    setBusyId(source.id);
    try {
      const response = await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete that source.");
      toast.success("Source deleted. Existing signals were kept.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AddSourceDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          catalog={catalog}
          onDone={() => {
            setAddOpen(false);
            refresh();
          }}
        />
        <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)}><FileUp /> Connector catalogue</Button>
        <span className="ml-auto flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {sources.filter((source) => source.enabled).length}/{sources.length} enabled
        </span>
      </div>

      <div className="grid gap-3">
        {sources.map((source) => {
          const meta = TYPE_META[source.type] ?? TYPE_META.RSS;
          const status = source.lastStatus ? STATUS[source.lastStatus] : null;
          const config = (source.config ?? {}) as Record<string, unknown>;
          const detail =
            source.type === "RSS" ? String(config.feedUrl ?? source.url ?? "") :
            source.type === "URL" ? String(config.url ?? source.url ?? "") :
            source.type === "WEBSITE" ? String(config.website ?? source.url ?? "") :
            source.type === "HN" ? `Query: ${String(config.query ?? "show hn")}` :
            source.type === "JOB_FEED" ? `${String(config.provider ?? "job feed")} · ${String(config.query ?? config.tag ?? config.boardToken ?? config.feedUrl ?? "")}` :
            `Query: ${String(config.query ?? "")}`;

          return (
            <div key={source.id} className="panel p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-signal-mint/80">
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[13px] font-medium text-foreground/90">{source.name}</p>
                    <Badge variant="outline" className="font-mono text-[8px]">{meta.label.toUpperCase()}</Badge>
                    {!source.enabled && <Badge variant="outline" className="font-mono text-[8px]">PAUSED</Badge>}
                    {status && (
                      <span className={cn("flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider", status.className)}>
                        <span className="h-1 w-1 rounded-full bg-current" /> {status.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground/45">{detail}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/50">
                    <span>{meta.permission}</span>
                    <span className="text-muted-foreground/25">·</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-2.5 w-2.5" /> {source.lastRunAt ? relativeTime(source.lastRunAt) : "never run"}</span>
                    {source.lastFetched > 0 && <><span className="text-muted-foreground/25">·</span><span>{source.lastFetched} fetched last run</span></>}
                  </div>
                  {source.lastStatus === "FAILED" && source.lastError && (
                    <p className="mt-2 rounded border border-destructive/20 bg-destructive/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-[#ff9cac]/80">
                      {source.lastError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={source.enabled}
                    disabled={busyId === source.id}
                    onCheckedChange={(enabled) => toggle(source, enabled)}
                    aria-label={`Toggle ${source.name}`}
                  />
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => test(source)} disabled={busyId === source.id}>
                    {busyId === source.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} Test
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${source.name}`} onClick={() => remove(source)} disabled={busyId === source.id}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {source.runs.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-2.5 text-[9px] text-muted-foreground/40">
                  <span className="font-mono uppercase tracking-wider">Recent runs</span>
                  {source.runs.map((run) => (
                    <span key={run.id} className="flex items-center gap-1 rounded border border-white/[0.06] px-1.5 py-0.5">
                      <span className={cn("h-1 w-1 rounded-full", run.status === "SUCCESS" ? "bg-signal-lime" : run.status === "FAILED" ? "bg-[#fb7185]" : "bg-signal-amber")} />
                      {relativeTime(run.startedAt)} · {run.signalsCreated} signals
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {sources.length === 0 && (
          <div className="panel flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-signal-mint">
              <Rss className="h-5 w-5" />
            </div>
            <p className="mt-3 text-[15px] font-medium">No signal sources yet.</p>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground/60">
              Default sources are created when you confirm an ICP. You can also add a specific RSS feed, a public job board, Show HN or your own URL.
            </p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus /> Add a source</Button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="label-mono">Ingestion history</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/55">Every run records what was fetched, kept, deduped and rejected.</p>
          </div>
          <Badge variant="outline" className="font-mono text-[8px]">{runs.length} RUNS</Badge>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {runs.map((run) => (
            <div key={run.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", run.status === "SUCCESS" ? "bg-signal-lime" : run.status === "FAILED" ? "bg-[#fb7185]" : run.status === "PARTIAL" ? "bg-signal-amber" : "bg-signal-sky")} />
              <div className="min-w-0">
                <p className="truncate text-[11px] text-foreground/80">{run.sourceName ?? "Workspace-wide run"} <span className="text-muted-foreground/35">· {run.trigger}</span></p>
                <p className="truncate text-[9px] text-muted-foreground/45">
                  {formatDate(run.startedAt)} · fetched {run.itemsFetched} · signals {run.signalsCreated} · new companies {run.companiesCreated} · dupes {run.duplicates}
                  {run.error ? ` · ${run.error}` : ""}
                </p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">{relativeTime(run.startedAt)}</span>
            </div>
          ))}
          {runs.length === 0 && <p className="px-4 py-8 text-center text-[11px] text-muted-foreground/45">No ingestion runs recorded yet.</p>}
        </div>
      </div>

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connector catalogue</DialogTitle>
            <DialogDescription>Only permitted public sources. No LinkedIn scraping, auth bypass, robots evasion or IP rotation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.map((item) => (
              <div key={item.type} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-foreground/85">{item.label}</p>
                  <Badge variant={item.available ? "primary" : "outline"} className="font-mono text-[8px]">{item.available ? "READY" : "NEEDS KEY"}</Badge>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/55">{item.description}</p>
                <p className="mt-1.5 border-t border-white/[0.05] pt-1.5 text-[9px] leading-relaxed text-muted-foreground/40">{item.permission}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddSourceDialog({
  open,
  onOpenChange,
  catalog,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: { type: string; label: string; description: string; available: boolean; example: string }[];
  onDone: () => void;
}) {
  const [type, setType] = useState("RSS");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    feedUrl: "",
    query: "",
    provider: "remotive",
    boardToken: "",
    companyName: "",
    maxItems: 15,
  });

  const selected = catalog.find((item) => item.type === type);
  const available = selected?.available ?? true;

  const buildConfig = () => {
    if (type === "RSS") return { feedUrl: form.feedUrl.trim(), maxItems: form.maxItems };
    if (type === "URL") return { url: form.url.trim() };
    if (type === "WEBSITE") return { website: form.url.trim(), companyName: form.companyName.trim() || undefined };
    if (type === "HN") return { query: form.query.trim(), tags: "show_hn", minPoints: 2, maxItems: form.maxItems };
    if (type === "JOB_FEED") {
      if (form.provider === "remotive") return { provider: "remotive", query: form.query.trim(), maxItems: form.maxItems };
      if (form.provider === "jobicy") return { provider: "jobicy", tag: form.query.trim() || undefined, maxItems: form.maxItems };
      if (form.provider === "greenhouse") return { provider: "greenhouse", boardToken: form.boardToken.trim(), companyName: form.companyName.trim(), maxItems: form.maxItems };
      if (form.provider === "lever") return { provider: "lever", boardToken: form.boardToken.trim(), companyName: form.companyName.trim(), maxItems: form.maxItems };
      return { provider: "rss", feedUrl: form.feedUrl.trim(), maxItems: form.maxItems };
    }
    return { provider: "tavily", query: form.query.trim(), maxResults: 8 };
  };

  const submit = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          name: form.name.trim() || undefined,
          config: buildConfig(),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not add that source.");
      toast.success("Source added. Test it before running discovery.");
      setForm({ name: "", url: "", feedUrl: "", query: "", provider: "remotive", boardToken: "", companyName: "", maxItems: 15 });
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Add source</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a permitted source</DialogTitle>
          <DialogDescription>Only add public pages and official APIs. The fetcher enforces robots.txt, timeouts and private-IP blocks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Connector</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {catalog.map((item) => (
                  <SelectItem key={item.type} value={item.type} disabled={!item.available}>
                    {item.label}{!item.available ? " — needs API key" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && <p className="text-[10px] leading-relaxed text-muted-foreground/50">{selected.description} <span className="text-muted-foreground/35">e.g. {selected.example}</span></p>}
          </div>

          {!available ? (
            <div className="flex items-start gap-2 rounded-lg border border-signal-amber/20 bg-signal-amber/[0.05] px-3 py-2.5 text-[10px] leading-relaxed text-signal-amber/80">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This connector needs TAVILY_API_KEY or BRAVE_SEARCH_API_KEY in the server environment. Add the key and redeploy, then create the source.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Display name</Label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={selected?.label} />
              </div>

              {(type === "RSS" || (type === "JOB_FEED" && form.provider === "rss")) && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Feed URL</Label>
                  <Input value={form.feedUrl} onChange={(event) => setForm({ ...form, feedUrl: event.target.value })} placeholder="https://example.com/feed.xml" />
                </div>
              )}

              {(type === "URL" || type === "WEBSITE") && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">{type === "URL" ? "Page URL" : "Company website"}</Label>
                  <Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com/news" />
                </div>
              )}

              {type === "WEBSITE" && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Company name (optional hint)</Label>
                  <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Only if the page does not name the company" />
                </div>
              )}

              {type === "HN" && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Search query</Label>
                  <Input value={form.query} onChange={(event) => setForm({ ...form, query: event.target.value })} placeholder="revenue intelligence" />
                </div>
              )}

              {type === "JOB_FEED" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Provider</Label>
                    <Select value={form.provider} onValueChange={(value) => setForm({ ...form, provider: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remotive">Remotive (public search)</SelectItem>
                        <SelectItem value="jobicy">Jobicy (public tag)</SelectItem>
                        <SelectItem value="greenhouse">Greenhouse board</SelectItem>
                        <SelectItem value="lever">Lever board</SelectItem>
                        <SelectItem value="rss">Custom job RSS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(form.provider === "remotive" || form.provider === "jobicy") && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">{form.provider === "remotive" ? "Search query" : "Tag"}</Label>
                      <Input value={form.query} onChange={(event) => setForm({ ...form, query: event.target.value })} placeholder="sales" />
                    </div>
                  )}
                  {(form.provider === "greenhouse" || form.provider === "lever") && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Board token</Label>
                        <Input value={form.boardToken} onChange={(event) => setForm({ ...form, boardToken: event.target.value })} placeholder="company-token" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Company name</Label>
                        <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Northwind Labs" />
                      </div>
                    </>
                  )}
                </>
              )}

              <p className="text-[9px] leading-relaxed text-muted-foreground/40">
                By adding a source you confirm you are allowed to fetch it. The app sends a normal user agent, respects robots.txt where applicable, and never bypasses authentication or paywalls.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !available}>
            {saving ? <Loader2 className="animate-spin" /> : <Zap />} Add source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
