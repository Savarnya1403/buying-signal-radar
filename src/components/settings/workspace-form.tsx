"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceForm({ initialName, workspaceId }: { initialName: string; workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Workspace name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not rename the workspace.");
      }
      toast.success("Workspace renamed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px]">Workspace name</Label>
        <div className="flex gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="h-9" />
          <Button size="sm" className="h-9" onClick={save} disabled={saving || name.trim() === initialName}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} Save
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] px-3 py-2">
        <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40">Workspace session</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/60">{workspaceId}</p>
        <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground/40">
          This MVP uses a private cookie-scoped workspace instead of accounts. Clearing cookies starts a new, empty workspace. Do not treat this as multi-user authentication.
        </p>
      </div>
    </div>
  );
}
