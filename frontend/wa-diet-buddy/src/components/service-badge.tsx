import { cn } from "@/lib/utils";
import type { ServiceType } from "@/lib/clients-mock";
import { SERVICE_TYPE_LABEL } from "@/lib/clients-mock";

const TONE: Record<ServiceType, string> = {
  diet: "bg-primary-soft text-primary border-primary/20",
  gym: "bg-accent text-accent-foreground border-accent-foreground/20",
  classes: "bg-success/10 text-success border-success/30",
};

export function ServiceBadge({ types, className }: { types: string[]; className?: string }) {
  if (types.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border-border",
          className,
        )}
      >
        —
      </span>
    );
  }
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {types.map((t) => (
        <span
          key={t}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            TONE[t as ServiceType] ?? "bg-muted text-muted-foreground border-border",
          )}
        >
          {SERVICE_TYPE_LABEL[t as ServiceType] ?? t}
        </span>
      ))}
    </div>
  );
}
