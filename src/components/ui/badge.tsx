import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-white/[0.09] bg-white/[0.05] text-foreground/80",
        primary: "border-primary/25 bg-primary/10 text-[#d6f9a4]",
        outline: "border-white/[0.12] bg-transparent text-muted-foreground",
        destructive: "border-destructive/30 bg-destructive/10 text-[#ff9cac]",
        amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
        violet: "border-violet-400/25 bg-violet-400/10 text-violet-200",
        sky: "border-sky-400/25 bg-sky-400/10 text-sky-200",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
