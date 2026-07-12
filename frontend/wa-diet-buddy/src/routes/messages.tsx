import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Mic,
  Send,
  Sparkles,
  UserCircle2,
  Pin,
  CheckCheck,
  Check,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Play,
  Filter,
  PanelRightOpen,
  ExternalLink,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CONVERSATIONS,
  formatClock,
  formatDay,
  type ChatMessage,
  type Conversation,
} from "@/lib/messages-mock";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Nutria" },
      {
        name: "description",
        content: "Unified WhatsApp inbox for clients and leads, with AI autopilot oversight.",
      },
    ],
  }),
  component: MessagesPage,
});

type FilterKey = "all" | "clients" | "leads" | "unread" | "review";

function MessagesPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState("");
  const [showContext, setShowContext] = useState(true);

  const conversations = useMemo(() => {
    return CONVERSATIONS.filter((c) => {
      if (filter === "clients" && c.kind !== "client") return false;
      if (filter === "leads" && c.kind !== "lead") return false;
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "review" && !c.awaitingDietitian) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.lastAtIso.localeCompare(a.lastAtIso);
    });
  }, [filter, search]);

  const active = CONVERSATIONS.find((c) => c.id === activeId) ?? CONVERSATIONS[0];

  const totals = useMemo(() => {
    const unread = CONVERSATIONS.reduce((s, c) => s + c.unread, 0);
    const review = CONVERSATIONS.filter((c) => c.awaitingDietitian).length;
    const leads = CONVERSATIONS.filter((c) => c.kind === "lead").length;
    return { unread, review, leads };
  }, []);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        eyebrow="Conversations"
        title="Messages"
        description="One inbox for every WhatsApp thread — clients and leads. The AI handles routine replies; you step in when flagged."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              n8n connected
            </Badge>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </>
        }
      />

      <div className="grid flex-1 min-h-0 grid-cols-[320px_1fr] gap-4 xl:grid-cols-[320px_1fr_320px]">
        {/* List pane */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="pl-9"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList className="grid w-full grid-cols-5 h-8">
                <TabsTrigger value="all" className="text-[11px]">All</TabsTrigger>
                <TabsTrigger value="clients" className="text-[11px]">Clients</TabsTrigger>
                <TabsTrigger value="leads" className="text-[11px]">Leads</TabsTrigger>
                <TabsTrigger value="unread" className="text-[11px]">
                  Unread
                  {totals.unread > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                      {totals.unread}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="review" className="text-[11px]">
                  Review
                  {totals.review > 0 && (
                    <span className="ml-1 rounded-full bg-warning px-1.5 text-[10px] text-warning-foreground">
                      {totals.review}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            <ul className="divide-y divide-border">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "w-full px-3 py-3 text-left transition-colors hover:bg-muted/60",
                      c.id === activeId && "bg-muted/80",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                          {c.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {c.pinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
                            <span className="truncate text-sm font-medium">{c.name}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">{c.lastAt}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-muted-foreground">{c.lastSnippet}</p>
                          {c.unread > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                              {c.unread}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4 px-1.5 text-[10px] font-normal",
                              c.kind === "lead"
                                ? "border-chart-1/40 text-chart-1 bg-chart-1/10"
                                : "border-primary/30 text-primary bg-primary/5",
                            )}
                          >
                            {c.tag}
                          </Badge>
                          {c.awaitingDietitian && (
                            <Badge className="h-4 px-1.5 text-[10px] font-normal bg-warning/15 text-warning border-warning/30">
                              <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                              Review
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              {conversations.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  No conversations match.
                </li>
              )}
            </ul>
          </ScrollArea>
        </div>

        {/* Thread pane */}
        <ConversationThread
          conversation={active}
          draft={draft}
          onDraft={setDraft}
          onToggleContext={() => setShowContext((s) => !s)}
        />

        {/* Context pane */}
        {showContext && <ContextPanel conversation={active} />}
      </div>
    </div>
  );
}

function ConversationThread({
  conversation,
  draft,
  onDraft,
  onToggleContext,
}: {
  conversation: Conversation;
  draft: string;
  onDraft: (v: string) => void;
  onToggleContext: () => void;
}) {
  const [autopilot, setAutopilot] = useState(conversation.aiAutopilot);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const m of conversation.messages) {
      const day = formatDay(m.at);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(m);
    }
    return Array.from(map.entries());
  }, [conversation]);

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {conversation.avatarInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold truncate">{conversation.name}</h2>
              <Badge variant="outline" className="h-5 text-[10px]">{conversation.tag}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{conversation.phone}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                WhatsApp
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
            <Sparkles className={cn("h-3.5 w-3.5", autopilot ? "text-primary" : "text-muted-foreground")} />
            <span className="text-xs font-medium">AI autopilot</span>
            <Switch checked={autopilot} onCheckedChange={setAutopilot} />
          </div>
          <Button variant="ghost" size="icon" title="Call">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Video call">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Toggle context" onClick={onToggleContext}>
            <PanelRightOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="space-y-6 p-6">
          {grouped.map(([day, msgs]) => (
            <div key={day} className="space-y-3">
              <div className="flex items-center justify-center">
                <span className="rounded-full bg-background border border-border px-3 py-0.5 text-[11px] text-muted-foreground">
                  {day}
                </span>
              </div>
              {msgs.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border p-3 space-y-2">
        {!autopilot && (
          <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-1.5 text-xs text-warning">
            <AlertCircle className="h-3.5 w-3.5" />
            AI autopilot paused — you're replying manually as Dr. Layla.
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={autopilot ? "Override AI with a manual message…" : "Type a message…"}
            className="min-h-11 max-h-32 resize-none"
            rows={1}
          />
          <Button variant="ghost" size="icon" className="shrink-0">
            <Mic className="h-4 w-4" />
          </Button>
          <Button size="icon" className="shrink-0" disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">Quick:</span>
          {[
            "Great work! 💪",
            "Send today's plan",
            "Book a consult",
            "Request weigh-in photo",
          ].map((q) => (
            <button
              key={q}
              onClick={() => onDraft(q)}
              className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground hover:bg-muted transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isOut = message.direction === "out";
  const isSystem = message.kind === "system";

  if (isSystem) {
    return (
      <div className="flex items-center justify-center">
        <span className="rounded-md bg-background border border-border px-3 py-1 text-[11px] text-muted-foreground">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 shadow-soft",
          isOut
            ? message.author === "ai"
              ? "bg-primary/10 text-foreground border border-primary/20 rounded-br-sm"
              : "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm",
          message.flagged && "ring-2 ring-warning/50",
        )}
      >
        {isOut && (
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-75">
            {message.author === "ai" ? (
              <>
                <Sparkles className="h-2.5 w-2.5" />
                AI reply
              </>
            ) : (
              <>
                <UserCircle2 className="h-2.5 w-2.5" />
                You
              </>
            )}
          </div>
        )}

        {message.kind === "image" && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-background/40 px-2 py-2 text-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{message.attachmentLabel ?? "photo.jpg"}</p>
              <p className="text-[10px] opacity-70">Tap to view full size</p>
            </div>
          </div>
        )}

        {message.kind === "voice" && (
          <div className="flex items-center gap-2 py-1">
            <button className="flex h-7 w-7 items-center justify-center rounded-full bg-background/30">
              <Play className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-1 w-32 items-center gap-0.5">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="h-full w-0.5 rounded-full bg-current opacity-50"
                  style={{ height: `${30 + Math.sin(i) * 30 + (i % 3) * 15}%` }}
                />
              ))}
            </div>
            <span className="text-[11px] opacity-80">0:{String(message.voiceSeconds ?? 0).padStart(2, "0")}</span>
          </div>
        )}

        {message.kind === "plan" && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-background/40 px-2 py-2 text-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/20 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{message.attachmentLabel ?? "Meal plan"}</p>
              <p className="text-[10px] opacity-70">Delivered to WhatsApp</p>
            </div>
          </div>
        )}

        {message.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}

        <div className={cn("mt-1 flex items-center gap-1 text-[10px] opacity-70", isOut ? "justify-end" : "justify-start")}>
          <span>{formatClock(message.at)}</span>
          {isOut && message.status === "read" && <CheckCheck className="h-3 w-3" />}
          {isOut && message.status === "delivered" && <CheckCheck className="h-3 w-3 opacity-50" />}
          {isOut && message.status === "sent" && <Check className="h-3 w-3" />}
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ conversation }: { conversation: Conversation }) {
  const isLead = conversation.kind === "lead";
  return (
    <div className="hidden xl:flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Contact context
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-accent text-accent-foreground text-base font-semibold">
                {conversation.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-2 font-display text-base font-semibold">{conversation.name}</h3>
            <p className="text-xs text-muted-foreground">{conversation.phone}</p>
            <Badge variant="outline" className="mt-2 text-[10px]">{conversation.tag}</Badge>
          </div>

          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="h-3.5 w-3.5" />
            {isLead ? "Open lead profile" : "Open client profile"}
          </Button>

          <Separator />

          {!isLead ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Today's targets
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">Calories</p>
                  <p className="font-display text-lg font-semibold">1,650</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">Adherence</p>
                  <p className="font-display text-lg font-semibold text-success">82%</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">Weight Δ</p>
                  <p className="font-display text-lg font-semibold">-1.4 kg</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">Week</p>
                  <p className="font-display text-lg font-semibold">3 / 12</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lead snapshot
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Stage</span><span className="font-medium">New</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium">Instagram reel</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Interest</span><span className="font-medium">Diet · PCOS</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Quality score</span><span className="font-medium text-success">82 / 100</span></div>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Internal notes
            </h4>
            <Textarea
              placeholder="Add a private note for the team…"
              className="min-h-20 text-xs"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick actions
            </h4>
            <div className="grid gap-1.5">
              <Button variant="outline" size="sm" className="justify-start">Send today's plan</Button>
              <Button variant="outline" size="sm" className="justify-start">Schedule appointment</Button>
              <Button variant="outline" size="sm" className="justify-start">Request weigh-in</Button>
              {isLead && <Button variant="outline" size="sm" className="justify-start">Convert to client</Button>}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
