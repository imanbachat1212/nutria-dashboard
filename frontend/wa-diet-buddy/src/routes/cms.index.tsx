import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  ExternalLink,
  Shield,
  Eye,
  TrendingUp,
  CalendarCheck,
  Plus,
  FileText,
  Newspaper,
  Sparkles,
  Quote,
  Star,
  Pencil,
  MoreHorizontal,
  Search,
  Languages,
  Rocket,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  SITE_STATS,
  BLOG_POSTS,
  SERVICES,
  TESTIMONIALS,
  STATUS_STYLES,
  fmtDate,
} from "@/lib/cms-mock";
import {
  fetchCmsPages,
  createCmsPage,
  STATUS_STYLES as PAGE_STATUS_STYLES,
  fmtDate as pageFmtDate,
  type SitePageListItem,
} from "@/lib/cms-api";
import { PageActionsDialog, type PageActionMode } from "@/components/page-actions-dialog";

export const Route = createFileRoute("/cms/")({
  head: () => ({
    meta: [
      { title: "Website / CMS — Nutria" },
      { name: "description", content: "Built-in landing pages on your own domain, bilingual." },
    ],
  }),
  component: CmsPage,
});

function CmsPage() {
  const [tab, setTab] = useState("pages");

  return (
    <div>
      <PageHeader
        title="Website / CMS"
        description="Manage your public-facing site, blog, services and testimonials — bilingual, on your own domain."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`https://${SITE_STATS.domain}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View site
              </a>
            </Button>
            <Button size="sm">
              <Rocket className="mr-2 h-4 w-4" />
              Publish changes
            </Button>
          </>
        }
      />

      {/* Site status banner */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-stretch gap-0 md:flex-row">
          <div className="flex flex-1 items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a href={`https://${SITE_STATS.domain}`} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                  {SITE_STATS.domain}
                </a>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                  <Shield className="mr-1 h-3 w-3" />
                  SSL active
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last deployed{" "}
                {new Date(SITE_STATS.lastDeploy).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}
              </p>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 border-t md:border-l md:border-t-0">
            <Stat icon={Eye}         label="Visitors"   value={SITE_STATS.visitors30d.toLocaleString()} delta={`+${SITE_STATS.visitorsDelta}%`} />
            <Stat icon={CalendarCheck} label="Bookings" value={String(SITE_STATS.bookings30d)}          delta={`+${SITE_STATS.bookingsDelta}%`} />
            <Stat icon={TrendingUp}  label="Conversion" value={`${SITE_STATS.conversionRate}%`}         delta="30d" muted />
          </div>
        </div>
      </Card>

      {/* Content tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="pages"><FileText className="mr-1.5 h-3.5 w-3.5" />Pages</TabsTrigger>
          <TabsTrigger value="blog"><Newspaper className="mr-1.5 h-3.5 w-3.5" />Blog</TabsTrigger>
          <TabsTrigger value="services"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Services</TabsTrigger>
          <TabsTrigger value="testimonials"><Quote className="mr-1.5 h-3.5 w-3.5" />Testimonials</TabsTrigger>
        </TabsList>
        <TabsContent value="pages"        className="mt-4"><PagesTab /></TabsContent>
        <TabsContent value="blog"         className="mt-4"><BlogTab /></TabsContent>
        <TabsContent value="services"     className="mt-4"><ServicesTab /></TabsContent>
        <TabsContent value="testimonials" className="mt-4"><TestimonialsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta, muted }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; delta: string; muted?: boolean;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-4 border-r last:border-r-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        <span className={cn("text-[11px]", muted ? "text-muted-foreground" : "text-emerald-600")}>{delta}</span>
      </div>
    </div>
  );
}

function PagesTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<{ page: SitePageListItem; mode: PageActionMode } | null>(null);
  const [newError, setNewError] = useState<string | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["cms-pages"],
    queryFn: () => fetchCmsPages(),
  });

  const createMutation = useMutation({
    mutationFn: () => createCmsPage({ title: "New page", slug: `/new-${Date.now().toString(36)}` }),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      navigate({ to: "/cms/pages/$pageId", params: { pageId: page.id } });
    },
    onError: (err: Error) => setNewError(err.message),
  });

  const filtered = pages.filter(
    (p: SitePageListItem) =>
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.slug.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Site pages</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} of {pages.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" className="h-8 w-56 pl-7 text-xs" />
          </div>
          <Button size="sm" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Plus className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Creating…" : "New page"}
          </Button>
        </div>
      </div>
      {newError && <p className="mb-3 text-xs text-rose-600">{newError}</p>}

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Page</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Languages</div>
          <div className="col-span-2">Updated</div>
          <div className="col-span-1 text-right">Views 30d</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No pages yet. Create one above.</div>
        ) : (
          filtered.map((p: SitePageListItem) => {
            const s = PAGE_STATUS_STYLES[p.status];
            return (
              <div key={p.id} className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30">
                <div className="col-span-4">
                  <p className="font-medium leading-tight">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.slug}</p>
                </div>
                <div className="col-span-2">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", s.cls)}>{s.label}</span>
                </div>
                <div className="col-span-2 flex flex-wrap gap-1">
                  {p.languages.map((l: string) => (
                    <Badge key={l} variant="outline" className="text-[9px] uppercase">{l}</Badge>
                  ))}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">{pageFmtDate(p.updatedAt)}</div>
                <div className="col-span-1 text-right text-sm tabular-nums">{p.views30d.toLocaleString()}</div>
                <div className="col-span-1 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => navigate({ to: "/cms/pages/$pageId", params: { pageId: p.id } })}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit content
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setAction({ page: p, mode: "edit" })}>
                        <FileText className="mr-2 h-3.5 w-3.5" />
                        Quick metadata
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setAction({ page: p, mode: "preview" })}>
                        <Eye className="mr-2 h-3.5 w-3.5" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setAction({ page: p, mode: "translations" })}>
                        <Languages className="mr-2 h-3.5 w-3.5" />
                        Manage translations
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600" disabled={p.status !== "published"} onSelect={() => setAction({ page: p, mode: "unpublish" })}>
                        Unpublish
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PageActionsDialog
        page={action?.page ?? null}
        mode={action?.mode ?? null}
        domain={SITE_STATS.domain}
        onClose={() => setAction(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["cms-pages"] }); setAction(null); }}
      />
    </Card>
  );
}

function BlogTab() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div><h2 className="text-sm font-semibold">Blog posts</h2><p className="text-xs text-muted-foreground">{BLOG_POSTS.length} posts</p></div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />New post</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {BLOG_POSTS.map((post) => {
          const s = STATUS_STYLES[post.status];
          return (
            <Card key={post.id} className="overflow-hidden">
              <div className="flex aspect-video items-center justify-center bg-linear-to-br from-primary/10 via-muted to-amber-500/10 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", s.cls)}>{s.label}</span>
                  <Badge variant="outline" className="text-[10px]">{post.category}</Badge>
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{post.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{post.author} · {post.readMin} min</span>
                  <span className="tabular-nums">
                    {post.status === "published" && post.publishedAt ? `${fmtDate(post.publishedAt)} · ${post.views} views`
                      : post.status === "scheduled" && post.publishedAt ? `Scheduled ${fmtDate(post.publishedAt)}`
                      : "Draft"}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ServicesTab() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Services on your site</h2>
          <p className="text-xs text-muted-foreground">Cards shown on /services — toggle visibility per package</p>
        </div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />New service</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SERVICES.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="text-sm font-semibold">{s.name}</h3><p className="mt-1 text-xs text-muted-foreground">{s.blurb}</p></div>
              <Switch defaultChecked={s.active} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">From</p><p className="text-xl font-semibold tabular-nums">${s.priceFrom}</p></div>
              <div className="text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bookings 30d</p><p className="text-sm font-medium tabular-nums">{s.bookings30d}</p></div>
            </div>
            <div className="mt-3 flex gap-2 border-t pt-3">
              <Button variant="outline" size="sm" className="flex-1 text-xs"><Pencil className="mr-1.5 h-3 w-3" />Edit</Button>
              <Button variant="ghost"   size="sm" className="text-xs"><Eye className="mr-1.5 h-3 w-3" />Preview</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TestimonialsTab() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div><h2 className="text-sm font-semibold">Testimonials</h2><p className="text-xs text-muted-foreground">Approve client quotes before they appear on the site</p></div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add testimonial</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TESTIMONIALS.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{t.client.split(" ").map((p) => p[0]).join("")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{t.client}</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn("h-3 w-3", i < t.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">"{t.quote}"</p>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {t.published ? (<><CheckCircle2 className="h-3 w-3 text-emerald-500" />Live on site</>) : "Awaiting approval"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Switch defaultChecked={t.published} />
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
