import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image as ImageIcon } from "lucide-react";
import {
  ExternalLink,
  Globe,
  Languages,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fetchCmsPage,
  updateCmsPage,
  unpublishCmsPage,
  STATUS_STYLES,
  type SitePageListItem,
  type PageBlock,
  type PageStatus,
  type Language,
} from "@/lib/cms-api";

export type PageActionMode = "edit" | "preview" | "translations" | "unpublish";

// EN is the source language (always locked on). AR is the optional second language.
// French has been removed from the platform.
const ALL_LANGS: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ar", label: "Arabic", native: "العربية" },
];

interface Props {
  page: SitePageListItem | null;
  mode: PageActionMode | null;
  domain: string;
  onClose: () => void;
  onSaved: () => void; // caller invalidates ["cms-pages"] query after success
}

export function PageActionsDialog({ page, mode, domain, onClose, onSaved }: Props) {
  if (!page || !mode) return null;

  if (mode === "unpublish") {
    return (
      <AlertDialog open onOpenChange={(o) => !o && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Unpublish "{page.title}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This page will be removed from {domain}
              {page.slug} and marked as a draft. Visitors who land on it will see a 404. You can
              republish it any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <UnpublishAction page={page} onClose={onClose} onSaved={onSaved} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          mode === "preview" ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        {mode === "edit" && (
          <EditMode page={page} domain={domain} onClose={onClose} onSaved={onSaved} />
        )}
        {mode === "preview" && <PreviewMode page={page} domain={domain} onClose={onClose} />}
        {mode === "translations" && (
          <TranslationsMode page={page} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Unpublish confirm ── */

function UnpublishAction({
  page,
  onClose,
  onSaved,
}: {
  page: SitePageListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => unpublishCmsPage(page.id),
    onSuccess: () => {
      toast.success(`Unpublished "${page.title}"`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialogAction
      className="bg-rose-600 text-white hover:bg-rose-700"
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "Unpublishing…" : "Unpublish"}
    </AlertDialogAction>
  );
}

/* ── Edit metadata ── */

function EditMode({
  page,
  domain,
  onClose,
  onSaved,
}: {
  page: SitePageListItem;
  domain: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [status, setStatus] = useState<PageStatus>(page.status);
  const [scheduledAt, setScheduledAt] = useState(
    page.scheduledAt ? new Date(page.scheduledAt).toISOString().slice(0, 16) : "",
  );
  const [seoEn, setSeoEn] = useState(page.seoDescription?.en ?? "");
  const [seoAr, setSeoAr] = useState(page.seoDescription?.ar ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateCmsPage(page.id, {
        title,
        slug,
        status,
        scheduledAt:
          status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        seoDescription: { en: seoEn, ar: seoAr || null },
      }),
    onSuccess: () => {
      toast.success("Page saved");
      onSaved();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const dirty =
    title !== page.title ||
    slug !== page.slug ||
    status !== page.status ||
    seoEn !== (page.seoDescription?.en ?? "") ||
    seoAr !== (page.seoDescription?.ar ?? "");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick metadata</DialogTitle>
        <DialogDescription>
          Update page metadata. Content blocks are edited in the page builder.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid gap-1.5">
          <Label>URL slug</Label>
          <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 focus-within:ring-2 focus-within:ring-ring">
            <span className="select-none text-xs text-muted-foreground">{domain}</span>
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.startsWith("/") ? e.target.value : `/${e.target.value}`)
              }
              className="h-9 border-0 bg-transparent px-1 focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PageStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === "scheduled" && (
            <div className="grid gap-1.5">
              <Label>
                Publish at <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9"
              />
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label>SEO description</Label>
          <div className="grid gap-1.5">
            <Textarea
              rows={2}
              maxLength={160}
              value={seoEn}
              onChange={(e) => setSeoEn(e.target.value)}
              placeholder="English · max 160 chars"
            />
            <p className="text-[10px] text-muted-foreground text-right">{seoEn.length}/160</p>
          </div>
          {page.languages.includes("ar") && (
            <div className="grid gap-1.5">
              <Textarea
                rows={2}
                maxLength={160}
                value={seoAr}
                onChange={(e) => setSeoAr(e.target.value)}
                placeholder="عربي · اختياري"
                dir="rtl"
                className="text-right"
              />
              <p className="text-[10px] text-muted-foreground text-right">{seoAr.length}/160</p>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ── Preview ── */

function PreviewMode({
  page,
  domain,
  onClose,
}: {
  page: SitePageListItem;
  domain: string;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Fetch the full page (with blocks) — the list item has no blocks
  const { data: fullPage, isLoading } = useQuery({
    queryKey: ["cms-page", page.id],
    queryFn: () => fetchCmsPage(page.id),
  });

  const widths = { desktop: "100%", tablet: 720, mobile: 360 } as const;
  const s = STATUS_STYLES[page.status];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          Preview
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
              s.cls,
            )}
          >
            {s.label}
          </span>
        </DialogTitle>
        <DialogDescription className="flex items-center gap-1 text-xs">
          <Globe className="h-3 w-3" />
          {domain}
          {page.slug}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-2 flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <DeviceBtn active={device === "desktop"} onClick={() => setDevice("desktop")} label="Desktop" icon={Monitor} />
          <DeviceBtn active={device === "tablet"}  onClick={() => setDevice("tablet")}  label="Tablet"  icon={Tablet} />
          <DeviceBtn active={device === "mobile"}  onClick={() => setDevice("mobile")}  label="Mobile"  icon={Smartphone} />
        </div>
        <Button variant="ghost" size="sm" asChild>
          <a href={`https://${domain}${page.slug}`} target="_blank" rel="noreferrer" className="text-xs">
            <ExternalLink className="mr-1.5 h-3 w-3" />Open live
          </a>
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-center rounded-lg border bg-muted/20 p-3">
        <div
          style={{ width: widths[device], maxWidth: "100%" }}
          className="overflow-hidden rounded-md border bg-background shadow-sm transition-all"
        >
          <div className="flex items-center gap-1.5 border-b bg-muted/40 px-2 py-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-400/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
            <span className="ml-2 truncate text-[10px] text-muted-foreground">{domain}{page.slug}</span>
          </div>
          <div className="max-h-90 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <>
                {/* Faux site nav */}
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <span className="text-xs font-semibold">Nutria</span>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Home</span><span>Services</span><span>Book</span>
                  </div>
                </div>
                {/* Real blocks rendered in EN */}
                {fullPage?.blocks.length === 0 && (
                  <p className="px-6 py-8 text-center text-xs text-muted-foreground italic">
                    No content blocks yet — add blocks in the page editor.
                  </p>
                )}
                {fullPage?.blocks.map((b) => <PreviewBlock key={b.id} block={b} />)}
                {/* Faux footer */}
                <div className="border-t bg-muted/30 px-4 py-2 text-center text-[10px] text-muted-foreground">
                  © Nutria
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </>
  );
}

function PreviewBlock({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="flex flex-col items-center gap-3 bg-linear-to-br from-primary/10 via-background to-amber-500/10 px-6 py-10 text-center">
          <h1 className="max-w-md text-xl font-semibold leading-tight">{block.heading.en}</h1>
          <p className="max-w-md text-xs text-muted-foreground">{block.subheading.en}</p>
          <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {block.ctaLabel.en}
          </button>
        </div>
      );
    case "heading":
      return block.level === 2
        ? <h2 className="px-6 pb-1 pt-5 text-base font-semibold">{block.text.en}</h2>
        : <h3 className="px-6 pb-1 pt-4 text-sm font-semibold">{block.text.en}</h3>;
    case "paragraph":
      return <p className="px-6 py-2 text-xs leading-relaxed text-muted-foreground">{block.text.en}</p>;
    case "image":
      return (
        <div className="px-6 py-3">
          <div className="flex aspect-video items-center justify-center rounded-md bg-linear-to-br from-muted via-muted/70 to-muted/40 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
          {block.caption.en && (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">{block.caption.en}</p>
          )}
        </div>
      );
    case "cta":
      return (
        <div className="flex justify-center px-6 py-4">
          <button
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              block.variant === "primary"
                ? "bg-primary text-primary-foreground"
                : "border bg-background text-foreground",
            )}
          >
            {block.label.en}
          </button>
        </div>
      );
    case "faq":
      return (
        <div className="flex flex-col gap-2 px-6 py-3">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-md border bg-muted/20 p-2">
              <p className="text-xs font-semibold">{item.q.en}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{item.a.en}</p>
            </div>
          ))}
        </div>
      );
  }
}

function DeviceBtn({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/* ── Translations ── */

function TranslationsMode({
  page,
  onClose,
  onSaved,
}: {
  page: SitePageListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [langs, setLangs] = useState<Language[]>(page.languages as Language[]);
  const dirty =
    langs.length !== page.languages.length || langs.some((l) => !page.languages.includes(l));

  const mutation = useMutation({
    mutationFn: () => updateCmsPage(page.id, { languages: langs }),
    onSuccess: () => {
      toast.success("Languages updated");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (l: Language) =>
    setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          Manage translations
        </DialogTitle>
        <DialogDescription>
          Toggle which languages this page is available in. English is the source language and
          cannot be removed.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-2 divide-y rounded-md border">
        {ALL_LANGS.map(({ code, label, native }) => {
          const enabled = langs.includes(code);
          const isSource = code === "en";
          return (
            <div key={code} className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {code}
                </Badge>
                <div>
                  <p className="text-sm font-medium">
                    {label} <span className="text-muted-foreground font-normal">({native})</span>
                  </p>
                  {isSource ? (
                    <p className="text-[11px] text-muted-foreground">
                      Source language — always enabled
                    </p>
                  ) : enabled ? (
                    <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Enabled — edit Arabic content in the page
                      builder
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Circle className="h-3 w-3" /> Not enabled
                    </p>
                  )}
                </div>
              </div>
              <Switch
                checked={enabled}
                disabled={isSource}
                onCheckedChange={() => toggle(code)}
                aria-label={`Toggle ${label}`}
              />
            </div>
          );
        })}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
