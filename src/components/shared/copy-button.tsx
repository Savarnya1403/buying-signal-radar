"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  toastMessage,
  ...props
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  toastMessage?: string;
} & Omit<ButtonProps, "onClick" | "children">) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      {...props}
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(toastMessage ?? "Copied to clipboard.");
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Clipboard access was blocked by the browser.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
