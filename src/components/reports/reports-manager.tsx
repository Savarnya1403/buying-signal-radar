"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, relativeTime } from "@/lib/utils";

type ReportRow = {
  id: string;
  token: string;
  title: string;
  industry: string;
  companyCount: number;
  createdAt: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  signalBreakdown: Record<string, number>;
};

export function ReportsManager({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success("Share link copied.");
    } catch {
      toast.error("Clipboard access was blocked.");
    }
  };

  const rotate = async (report: ReportRow) => {
    if (!window.confirm("Rotate the link? The old URL will stop working immediately.")) return;
    setBusyId(report.id);
    try {
      const response = await fetch(`/api/reports/${report.id}`, { method: "PATCH" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not rotate the link.");
      toast.success("Link rotated. Copy the new URL.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (report: ReportRow) => {
    if (!window.confirm(`Revoke “${report.title}”? The public link will stop working and the snapshot is deleted.`)) return;
    setBusyId(report.id);
    try {
      const response = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not revoke the report.");
      }
      toast.success("Report revoked.");
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
        <CreateReportDialog onDone={() => refresh()} />
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/45">
          <ShieldCheck className="h-3 w-3 text-signal-mint/60" /> No contacts, notes or graph data in any report.
        </span>
        {pending && <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground/50" />}
      </div>

      {reports.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-signal-lime">
            <FileText className="h-5 w-5" />
          </div>
          <p className="mt-3 text-[16px] font-medium">No shared reports yet.</p>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground/60">
            Publish a sanitised snapshot of your ranked prospects and evidence. The recipient does not need an account, and your contacts and notes are never included.
          </p>
          <div className="mt-4"><CreateReportDialog onDone={() => refresh()} /></div>
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => {
            const path = `/r/${report.token}`;
            return (
              <div key={report.id} className="panel p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-signal-lime">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={path} className="text-[13px] font-medium text-foreground hover:text-signal-lime">{report.title}</Link>
                      <Badge variant="outline" className="font-mono text-[8px]">{report.companyCount} COMPANIES</Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground/55">
                      {report.industry} · published {relativeTime(report.createdAt)} · evidence {formatDate(report.dateRangeStart)} → {formatDate(report.dateRangeEnd)}
                    </p>
                    <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground/35">{path}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button asChild variant="outline" size="sm" className="h-7 text-[10px]"><Link href={path}><Eye /> Open</Link></Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => copy(path)}><Copy /> Copy link</Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Rotate link" onClick={() => rotate(report)} disabled={busyId === report.id}>
                      {busyId === report.id ? <Loader2 className="animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Revoke report" onClick={() => revoke(report)} disabled={busyId === report.id}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {Object.keys(report.signalBreakdown).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-2.5">
                    {Object.entries(report.signalBreakdown).slice(0, 7).map(([label, count]) => (
                      <span key={label} className="rounded border border-white/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground/50">
                        {label} · {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3 text-[10px] leading-relaxed text-muted-foreground/45">
        <Link2 className="mb-1 h-3 w-3 text-signal-mint/60" />
        Reports are immutable snapshots. Rotate the link to revoke access without deleting the record, or delete the report entirely. Companies, scores and evidence are included; contacts, notes and graph relationships are not.
      </div>
    </div>
  );
}

function CreateReportDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [createdPath, setCreatedPath] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not create the report.");
      setCreatedPath(body.path);
      toast.success("Report published.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setTitle("");
    setCreatedPath(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Publish report</Button>
      </DialogTrigger>
      <DialogContent>
        {createdPath ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-signal-lime" /> Report published</DialogTitle>
              <DialogDescription>
                Share this sanitised link. It contains companies, scores and public evidence — never contacts, notes or graph data.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-white/[0.08] bg-[#080b0f] p-3 font-mono text-[10px] text-muted-foreground/70">
              {typeof window !== "undefined" ? `${window.location.origin}${createdPath}` : createdPath}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setCreatedPath(null); reset(); }}>Create another</Button>
              <Button variant="outline" asChild><Link href={createdPath}><ArrowUpRight /> Open report</Link></Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Publish a sanitised report</DialogTitle>
              <DialogDescription>
                Creates an immutable snapshot of ranked prospects for your current ICP. Recipients see scores, signals, sources and your ICP — not private workspace data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Report title (optional)</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Fintech buying-signal radar · Q4" maxLength={140} />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-signal-mint/15 bg-signal-mint/[0.04] px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/60">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-signal-mint/70" />
                Contacts, notes, statuses and referral relationships are excluded by design. Every link can be rotated or revoked.
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <FileText />} Publish snapshot</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
