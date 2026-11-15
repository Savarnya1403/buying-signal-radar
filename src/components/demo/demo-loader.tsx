"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DemoLoader({
  variant = "secondary",
  size = "default",
  label = "Explore with demo data",
  className,
}: {
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function loadDemo() {
    setLoading(true);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Could not load demo data.");
      toast.success(data.alreadySeeded ? "Demo workspace already loaded" : "Demo dataset loaded", {
        description: "All companies, people and evidence are synthetic and labelled.",
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load demo data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={loadDemo} disabled={loading} className={className}>
      {loading ? <Loader2 className="animate-spin" /> : <FlaskConical />}
      {loading ? "Loading synthetic dataset…" : label}
    </Button>
  );
}
