import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Heading as HeadingIcon,
  Type,
  Megaphone,
  HelpCircle,
  Sparkles,
  Save,
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  fetchCmsPage,
  updateCmsPage,
  publishCmsPage,
  unpublishCmsPage,
  scheduleCmsPage,
  STATUS_STYLES,
  makeBlock,
  type SitePage,
  type PageBlock,
  type PageBlockType,
  type PageStatus,
  type BilingualString,
} from "@/lib/cms-api";
import { SITE_STATS } from "@/lib/cms-mock";

export const Route = createFileRoute("/cms/pages/$pageId")({
  head: () => ({
    meta: [
      { title: "Page editor — Nutria CMS" },
      { name: "description", content: "Edit content blocks for this page." },
    ],
  }),
  component: PageEditor,
});

const BLOCK_META: Record<
  PageBlockType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  hero: { label: "Hero", icon: Sparkles },
  heading: { label: "Heading", icon: HeadingIcon },
  paragraph: { label: "Paragraph", icon: Type },
  image: { label: "Image", icon: ImageIcon },
  cta: { label: "Call to action", icon: Megaphone },
  faq: { label: "FAQ", icon: HelpCircle },
};

function PageEditor() {
  const { pageId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [editLang, setEditLang] = useState<"en" | "ar">("en");

  const {
    data: page,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cms-page", pageId],
    queryFn: () => fetchCmsPage(pageId),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateCmsPage>[1]) => updateCmsPage(pageId, data),
    onSuccess: (updated) => {
      qc.setQueryData(["cms-page", pageId], updated);
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishCmsPage(pageId),
    onSuccess: (u) => {
      qc.setQueryData(["cms-page", pageId], u);
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      toast.success("Published");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishCmsPage(pageId),
    onSuccess: (u) => {
      qc.setQueryData(["cms-page", pageId], u);
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      toast.success("Unpublished");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  if (error || !page) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">Page not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/cms">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to CMS
          </Link>
        </Button>
      </div>
    );
  }

  const s = STATUS_STYLES[page.status];
  const widths = { desktop: "100%", tablet: 720, mobile: 380 } as const;
  const hasAr = page.languages.includes("ar");

  const save = (data: Parameters<typeof updateCmsPage>[1]) => saveMutation.mutate(data);
  const setBlocks = (blocks: PageBlock[]) => save({ blocks });
  const moveBlock = (idx: number, dir: -1 | 1) => {
    const next = [...page.blocks];
    const tgt = idx + dir;
    if (tgt < 0 || tgt >= next.length) return;
    [next[idx], next[tgt]] = [next[tgt], next[idx]];
    setBlocks(next);
  };
  const updateBlock = (idx: number, patch: Partial<PageBlock>) =>
    setBlocks(page.blocks.map((b, i) => (i === idx ? ({ ...b, ...patch } as PageBlock) : b)));
  const removeBlock = (idx: number) => setBlocks(page.blocks.filter((_, i) => i !== idx));
  const addBlock = (type: PageBlockType) => setBlocks([...page.blocks, makeBlock(type)]);

  return (
    <div>
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 h-7 text-xs text-muted-foreground"
          >
            <Link to="/cms">
              <ArrowLeft className="mr-1 h-3 w-3" />
              All pages
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={page.title}
              onChange={(e) => save({ title: e.target.value })}
              className="h-9 max-w-md text-base font-semibold"
            />
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                s.cls,
              )}
            >
              {s.label}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            {SITE_STATS.domain}
            {page.slug}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* EN / AR toggle — only shown when Arabic is enabled for the page */}
          {hasAr && (
            <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs">
              <button
                onClick={() => setEditLang("en")}
                className={cn(
                  "rounded px-2 py-1",
                  editLang === "en"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground",
                )}
              >
                EN
              </button>
              <button
                onClick={() => setEditLang("ar")}
                className={cn(
                  "rounded px-2 py-1",
                  editLang === "ar"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground",
                )}
              >
                عر
              </button>
            </div>
          )}

          {page.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 text-emerald-700"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              {publishMutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
          {page.status === "published" && (
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              disabled={unpublishMutation.isPending}
              onClick={() => unpublishMutation.mutate()}
            >
              {unpublishMutation.isPending ? "Unpublishing…" : "Unpublish"}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/cms" })}>
            <Eye className="mr-2 h-4 w-4" />
            Done
          </Button>
          <Button
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => save({ title: page.title, slug: page.slug })}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Split editor / preview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Editor */}
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Page metadata
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">URL slug</Label>
                <Input
                  value={page.slug}
                  onChange={(e) =>
                    save({
                      slug: e.target.value.startsWith("/") ? e.target.value : `/${e.target.value}`,
                    })
                  }
                  className="h-8"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={page.status}
                  onValueChange={(v) => save({ status: v as PageStatus })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {page.status === "scheduled" && (
                <div className="col-span-2 grid gap-1.5">
                  <Label className="text-xs">
                    Publish at <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    defaultValue={
                      page.scheduledAt ? new Date(page.scheduledAt).toISOString().slice(0, 16) : ""
                    }
                    className="h-8"
                    onBlur={(e) => {
                      if (!e.target.value) return;
                      scheduleCmsPage(pageId, new Date(e.target.value).toISOString())
                        .then((u) => qc.setQueryData(["cms-page", pageId], u))
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  />
                </div>
              )}
              <div className="col-span-2 grid gap-1.5">
                <Label className="text-xs">SEO description (EN)</Label>
                <Textarea
                  rows={2}
                  maxLength={160}
                  value={page.seoDescription?.en ?? ""}
                  onChange={(e) =>
                    save({
                      seoDescription: { en: e.target.value, ar: page.seoDescription?.ar ?? null },
                    })
                  }
                />
              </div>
              {hasAr && (
                <div className="col-span-2 grid gap-1.5">
                  <Label className="text-xs">SEO description (AR)</Label>
                  <Textarea
                    rows={2}
                    maxLength={160}
                    dir="rtl"
                    className="text-right"
                    value={page.seoDescription?.ar ?? ""}
                    onChange={(e) =>
                      save({
                        seoDescription: {
                          en: page.seoDescription?.en ?? "",
                          ar: e.target.value || null,
                        },
                      })
                    }
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Content blocks
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add block
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(BLOCK_META) as PageBlockType[]).map((t) => {
                    const m = BLOCK_META[t];
                    return (
                      <DropdownMenuItem key={t} onSelect={() => addBlock(t)}>
                        <m.icon className="mr-2 h-3.5 w-3.5" />
                        {m.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {page.blocks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">No blocks yet.</p>
                <Button size="sm" variant="outline" onClick={() => addBlock("hero")}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add hero
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {page.blocks.map((block, idx) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    idx={idx}
                    last={idx === page.blocks.length - 1}
                    editLang={hasAr ? editLang : "en"}
                    onChange={(patch) => updateBlock(idx, patch)}
                    onMove={(dir) => moveBlock(idx, dir)}
                    onRemove={() => removeBlock(idx)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-3">
          <Card className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
                <DeviceBtn
                  active={device === "desktop"}
                  onClick={() => setDevice("desktop")}
                  icon={Monitor}
                  label="Desktop"
                />
                <DeviceBtn
                  active={device === "tablet"}
                  onClick={() => setDevice("tablet")}
                  icon={Tablet}
                  label="Tablet"
                />
                <DeviceBtn
                  active={device === "mobile"}
                  onClick={() => setDevice("mobile")}
                  icon={Smartphone}
                  label="Mobile"
                />
              </div>
              <Badge variant="outline" className="text-[10px]">
                Preview (EN)
              </Badge>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex justify-center">
              <div
                style={{ width: widths[device], maxWidth: "100%" }}
                className="overflow-hidden rounded-md border bg-background shadow-sm transition-all"
              >
                <div className="flex items-center gap-1.5 border-b bg-muted/40 px-2 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400/70" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                  <span className="ml-2 truncate text-[10px] text-muted-foreground">
                    {SITE_STATS.domain}
                    {page.slug}
                  </span>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  <FauxSiteNav />
                  <div className="flex flex-col">
                    {page.blocks.map((b) => (
                      <BlockPreview key={b.id} block={b} />
                    ))}
                  </div>
                  <FauxSiteFooter />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DeviceBtn({
  active,
  onClick,
  icon: Icon,
  label,
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
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function BlockCard({
  block,
  idx,
  last,
  editLang,
  onChange,
  onMove,
  onRemove,
}: {
  block: PageBlock;
  idx: number;
  last: boolean;
  editLang: "en" | "ar";
  onChange: (patch: Partial<PageBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const meta = BLOCK_META[block.type];
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs font-medium">
          <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
          {meta.label}
          <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={idx === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={last}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-600" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        <BlockEditor block={block} editLang={editLang} onChange={onChange} />
      </div>
    </div>
  );
}

/* ── Bilingual field ── */

function BilField({
  label,
  value,
  onChange,
  editLang,
  rows,
}: {
  label: string;
  value: BilingualString;
  onChange: (v: BilingualString) => void;
  editLang: "en" | "ar";
  rows?: number;
}) {
  const isAr = editLang === "ar";
  const current = isAr ? (value.ar ?? "") : value.en;
  const change = (val: string) =>
    onChange(isAr ? { ...value, ar: val || null } : { ...value, en: val });

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">
          {editLang}
        </span>
      </div>
      {rows ? (
        <Textarea
          rows={rows}
          value={current}
          onChange={(e) => change(e.target.value)}
          dir={isAr ? "rtl" : undefined}
          className={cn("text-sm", isAr && "text-right")}
          placeholder={isAr ? "(Arabic, optional)" : ""}
        />
      ) : (
        <Input
          value={current}
          onChange={(e) => change(e.target.value)}
          dir={isAr ? "rtl" : undefined}
          className={cn(isAr && "text-right")}
          placeholder={isAr ? "(Arabic, optional)" : ""}
        />
      )}
    </div>
  );
}

/* ── Block editors ── */

function BlockEditor({
  block,
  editLang,
  onChange,
}: {
  block: PageBlock;
  editLang: "en" | "ar";
  onChange: (patch: Partial<PageBlock>) => void;
}) {
  switch (block.type) {
    case "hero":
      return (
        <div className="grid gap-2">
          <BilField
            label="Heading"
            value={block.heading}
            onChange={(v) => onChange({ heading: v })}
            editLang={editLang}
          />
          <BilField
            label="Subheading"
            value={block.subheading}
            onChange={(v) => onChange({ subheading: v })}
            editLang={editLang}
            rows={2}
          />
          <BilField
            label="CTA label"
            value={block.ctaLabel}
            onChange={(v) => onChange({ ctaLabel: v })}
            editLang={editLang}
          />
        </div>
      );
    case "heading":
      return (
        <div className="flex gap-2">
          <Select
            value={String(block.level)}
            onValueChange={(v) => onChange({ level: Number(v) as 2 | 3 })}
          >
            <SelectTrigger className="h-9 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">H2</SelectItem>
              <SelectItem value="3">H3</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1">
            <BilField
              label="Text"
              value={block.text}
              onChange={(v) => onChange({ text: v })}
              editLang={editLang}
            />
          </div>
        </div>
      );
    case "paragraph":
      return (
        <BilField
          label="Text"
          value={block.text}
          onChange={(v) => onChange({ text: v })}
          editLang={editLang}
          rows={3}
        />
      );
    case "image":
      return (
        <div className="grid gap-2">
          <div className="flex aspect-video items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground">
            <ImageIcon className="mr-1.5 h-5 w-5" />
            Image upload deferred — placeholder only
          </div>
          <BilField
            label="Caption"
            value={block.caption}
            onChange={(v) => onChange({ caption: v })}
            editLang={editLang}
          />
          <BilField
            label="Alt text"
            value={block.alt}
            onChange={(v) => onChange({ alt: v })}
            editLang={editLang}
          />
        </div>
      );
    case "cta":
      return (
        <div className="grid gap-2">
          <BilField
            label="Button label"
            value={block.label}
            onChange={(v) => onChange({ label: v })}
            editLang={editLang}
          />
          <div className="grid gap-1">
            <Label className="text-xs">Destination URL</Label>
            <Input
              value={block.href}
              onChange={(e) => onChange({ href: e.target.value })}
              placeholder="/destination"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Variant</Label>
            <Select
              value={block.variant}
              onValueChange={(v) => onChange({ variant: v as "primary" | "outline" })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="grid gap-2">
          {block.items.map((item, i) => (
            <div key={i} className="grid gap-1.5 rounded border p-2">
              <BilField
                label={`Q${i + 1}`}
                value={item.q}
                onChange={(v) => {
                  const its = [...block.items];
                  its[i] = { ...its[i], q: v };
                  onChange({ items: its });
                }}
                editLang={editLang}
              />
              <BilField
                label={`A${i + 1}`}
                value={item.a}
                onChange={(v) => {
                  const its = [...block.items];
                  its[i] = { ...its[i], a: v };
                  onChange({ items: its });
                }}
                editLang={editLang}
                rows={2}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-rose-600"
                  disabled={block.items.length === 1}
                  onClick={() => onChange({ items: block.items.filter((_, j) => j !== i) })}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                items: [
                  ...block.items,
                  { q: { en: "New question?", ar: null }, a: { en: "Answer.", ar: null } },
                ],
              })
            }
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Add question
          </Button>
        </div>
      );
  }
}

/* ── Block previews (always EN) ── */

function BlockPreview({ block }: { block: PageBlock }) {
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
      return block.level === 2 ? (
        <h2 className="px-6 pb-1 pt-5 text-base font-semibold">{block.text.en}</h2>
      ) : (
        <h3 className="px-6 pb-1 pt-4 text-sm  font-semibold">{block.text.en}</h3>
      );
    case "paragraph":
      return (
        <p className="px-6 py-2 text-xs leading-relaxed text-muted-foreground">{block.text.en}</p>
      );
    case "image":
      return (
        <div className="px-6 py-3">
          <div className="flex aspect-video items-center justify-center rounded-md bg-linear-to-br from-muted via-muted/70 to-muted/40 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
          {block.caption.en && (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {block.caption.en}
            </p>
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

function FauxSiteNav() {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <span className="text-xs font-semibold">Nutria</span>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>Home</span>
        <span>Services</span>
        <span>Book</span>
      </div>
    </div>
  );
}

function FauxSiteFooter() {
  return (
    <div className="border-t bg-muted/30 px-4 py-2 text-center text-[10px] text-muted-foreground">
      © Nutria — built with love
    </div>
  );
}
