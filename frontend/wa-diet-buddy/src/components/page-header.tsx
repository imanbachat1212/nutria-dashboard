import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 pb-6", className)}>
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {/* flex-wrap: Arabic labels run longer than their English equivalents (e.g. Journal's
          "Approve all clean" becomes "الموافقة على كل المدخلات السليمة"), and a non-wrapping
          action row pushed the page 36px past the viewport at 900px wide. Caught by measuring
          document.body.scrollWidth per page in both languages, not by reading the code. */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
