"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CompanyNotes({ prospectId, initialNotes }: { prospectId: string; initialNotes: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not save notes.");
      }
      toast.success("Notes saved to this private workspace.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const dirty = notes !== (initialNotes ?? "");

  return (
    <div className="space-y-2.5">
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="What did you learn? Who replied? What should happen next? Notes stay out of shared reports."
        className="min-h-[108px] resize-y text-[12px] leading-relaxed"
        maxLength={4000}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/45">{notes.length}/4000 · never included in shared reports</p>
        <Button size="sm" variant="outline" onClick={save} disabled={!dirty || saving || pending}>
          {saving || pending ? <Loader2 className="animate-spin" /> : <Save />}
          {dirty ? "Save notes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
