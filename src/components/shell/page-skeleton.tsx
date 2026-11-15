import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} />;
}

export function PageSkeleton({
  variant = "list",
  label = "Loading",
}: {
  variant?: "list" | "dashboard" | "detail" | "graph" | "wizard" | "settings";
  label?: string;
}) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={label}>
      <div className="space-y-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-8 w-[min(520px,80%)]" />
        <Bar className="h-3 w-[min(380px,65%)]" />
      </div>

      {variant === "dashboard" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="panel h-[104px] p-4">
                <Bar className="h-2.5 w-20" />
                <Bar className="mt-4 h-7 w-14" />
                <Bar className="mt-3 h-2 w-24" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="panel h-[420px]" />
            <div className="panel h-[420px]" />
          </div>
        </>
      )}

      {variant === "list" && (
        <>
          <div className="panel flex flex-wrap gap-2 p-3">
            {[0, 1, 2, 3].map((index) => (
              <Bar key={index} className="h-8 w-28" />
            ))}
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="panel flex items-center gap-4 p-4">
                <Bar className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bar className="h-3 w-[min(220px,50%)]" />
                  <Bar className="h-2.5 w-[min(340px,70%)]" />
                </div>
                <Bar className="h-8 w-16" />
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "detail" && (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="panel h-[220px]" />
            <div className="panel h-[320px]" />
          </div>
          <div className="space-y-4">
            <div className="panel h-[260px]" />
            <div className="panel h-[200px]" />
          </div>
        </div>
      )}

      {variant === "graph" && <div className="panel h-[560px]" />}

      {variant === "wizard" && (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="panel h-[460px]" />
          <div className="panel h-[360px]" />
        </div>
      )}

      {variant === "settings" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="panel h-[380px]" />
          <div className="space-y-4">
            <div className="panel h-[180px]" />
            <div className="panel h-[180px]" />
          </div>
        </div>
      )}
    </div>
  );
}
