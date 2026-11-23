import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  Check,
  Clock,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Play,
  Filter,
  PanelRightOpen,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ltrIsolate } from "@/lib/i18n/format";

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  fetchConversations,
  fetchThread,
  fetchMessagesStatus,
  sendMessage,
  setAiAutopilot,
  useThreadFormatters,
  type ChatMessage,
  type ConversationSummary,
  type Thread,
} from "@/lib/messages-api";

// Live data refresh (prompt-96). Polling, not websockets: nothing in this stack carries a
// socket today, n8n writes messages over plain HTTP, and a dietitian reading a thread tolerates
// a few seconds of lag. refetchOnWindowFocus does most of the real work — she alt-tabs back
// from WhatsApp far more often than she sits watching an idle inbox.
const POLL_MS = 15_000;

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

/**
 * The conversation badge. The backend sends either "Lead" or the client's first serviceType
 * ("diet" / "gym" / "classes") — see messages.service.js — so both vocabularies already have
 * translations. Anything unrecognised is shown verbatim rather than swallowed.
 */
function useConversationTag() {
  const { t } = useTranslation(["messages", "clients"]);
  return (tag: string | null) => {
    if (!tag) return null;
    if (tag === "Lead") return t("messages:tag.Lead");
    if (["diet", "gym", "classes"].includes(tag)) return t(`clients:serviceType.${tag}`);
    return tag;
  };
}

function MessagesPage() {
  const { t } = useTranslation(["messages", "common"]);
  const { ago } = useThreadFormatters();
  const conversationTag = useConversationTag();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showContext, setShowContext] = useState(true);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: fetchConversations,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const { data: status } = useQuery({
    queryKey: ["messages", "status"],
    queryFn: fetchMessagesStatus,
    refetchInterval: POLL_MS,
  });

  // Select the newest thread once the list arrives, and recover if the selected one disappears.
  useEffect(() => {
    if (!all.length) return;
    if (!activeId || !all.some((c) => c.id === activeId)) setActiveId(all[0].id);
  }, [all, activeId]);

  const conversations = useMemo(() => {
    return (
      all
        .filter((c) => {
          if (filter === "clients" && c.kind !== "client") return false;
          if (filter === "leads" && c.kind !== "lead") return false;
          if (filter === "unread" && c.unread === 0) return false;
          if (filter === "review" && !c.awaitingDietitian) return false;
          if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
          return true;
        })
        // `pinned` is gone: nothing sets it (see messages-api.ts). Newest-first only.
        .sort((a, b) => b.lastAtIso.localeCompare(a.lastAtIso))
    );
  }, [all, filter, search]);

  const active = all.find((c) => c.id === activeId) ?? null;

  const totals = useMemo(() => {
    const unread = all.reduce((s, c) => s + c.unread, 0);
    const review = all.filter((c) => c.awaitingDietitian).length;
    const leads = all.filter((c) => c.kind === "lead").length;
    return { unread, review, leads };
  }, [all]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        eyebrow={t("messages:eyebrow")}
        title={t("messages:title")}
        description={t("messages:description")}
        actions={
          <>
            {/* Was a hardcoded "n8n connected" string. Now reports whether a message has
                actually moved recently — a weak signal, deliberately, and labelled as one.
                It can say "no", which is the whole point of replacing it. */}
            <Badge
              variant="outline"
              className="gap-1.5"
              title={
                status?.lastMessageAt
                  ? t("messages:status.lastMessage", { when: ago(status.lastMessageAt) })
                  : t("messages:status.noneLogged")
              }
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status?.recentlyActive ? "bg-success" : "bg-muted-foreground",
                )}
              />
              {status?.recentlyActive
                ? t("messages:status.active", { when: ago(status.lastMessageAt!) })
                : status?.lastMessageAt
                  ? t("messages:status.quiet", { when: ago(status.lastMessageAt) })
                  : t("messages:status.none")}
            </Badge>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
              {t("messages:filtersButton")}
            </Button>
          </>
        }
      />

      <div className="grid flex-1 min-h-0 grid-cols-[320px_1fr] gap-4 xl:grid-cols-[320px_1fr_320px]">
        {/* List pane */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-3 space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("messages:searchPlaceholder")}
                className="ps-9"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList className="grid w-full grid-cols-5 h-8">
                <TabsTrigger value="all" className="text-[11px]">
                  {t("messages:tabs.all")}
                </TabsTrigger>
                <TabsTrigger value="clients" className="text-[11px]">
                  {t("messages:tabs.clients")}
                </TabsTrigger>
                <TabsTrigger value="leads" className="text-[11px]">
                  {t("messages:tabs.leads")}
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-[11px]">
                  {t("messages:tabs.unread")}
                  {totals.unread > 0 && (
                    <span className="ms-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                      {totals.unread}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="review" className="text-[11px]">
                  {t("messages:tabs.review")}
                  {totals.review > 0 && (
                    <span className="ms-1 rounded-full bg-warning px-1.5 text-[10px] text-warning-foreground">
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
                      "w-full px-3 py-3 text-start transition-colors hover:bg-muted/60",
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
                            <span className="truncate text-sm font-medium">{c.name}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {ago(c.lastAtIso)}
                          </span>
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
                            {conversationTag(c.tag)}
                          </Badge>
                          {c.awaitingDietitian && (
                            <Badge className="h-4 px-1.5 text-[10px] font-normal bg-warning/15 text-warning border-warning/30">
                              <AlertCircle className="h-2.5 w-2.5 me-0.5" />
                              {t("messages:review")}
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
                  {isLoading ? t("messages:list.loading") : t("messages:list.empty")}
                </li>
              )}
            </ul>
          </ScrollArea>
        </div>

        {/* Thread pane */}
        {active ? (
          <ConversationThread
            summary={active}
            draft={draft}
            onDraft={setDraft}
            onToggleContext={() => setShowContext((s) => !s)}
          />
        ) : (
          <div className="flex min-h-0 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground shadow-soft">
            {isLoading ? t("common:state.loading") : t("messages:list.noneSelected")}
          </div>
        )}

        {/* Context pane */}
        {showContext && active && <ContextPanel conversation={active} />}
      </div>
    </div>
  );
}

function ConversationThread({
  summary,
  draft,
  onDraft,
  onToggleContext,
}: {
  summary: ConversationSummary;
  draft: string;
  onDraft: (v: string) => void;
  onToggleContext: () => void;
}) {
  const { t } = useTranslation(["messages", "common"]);
  const { day: formatDay } = useThreadFormatters();
  const conversationTag = useConversationTag();
  const qc = useQueryClient();

  const { data: thread } = useQuery({
    queryKey: ["messages", "thread", summary.id],
    queryFn: () => fetchThread(summary.id),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  // The list already knows the flag, so the toggle renders correctly before the thread loads.
  const conversation: Thread | ConversationSummary = thread ?? summary;
  const autopilot = thread?.aiAutopilot ?? summary.aiAutopilot;

  // Persisted, not local state — the mock's toggle reset on reload. Optimistic so the switch
  // moves under the finger; both queries are invalidated after so the server value wins.
  const autopilotMutation = useMutation({
    mutationFn: (next: boolean) => setAiAutopilot(summary.id, next),
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: ["messages", "thread", summary.id] });
      const prev = qc.getQueryData<Thread>(["messages", "thread", summary.id]);
      if (prev) qc.setQueryData(["messages", "thread", summary.id], { ...prev, aiAutopilot: next });
      return { prev };
    },
    onError: (err: Error, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["messages", "thread", summary.id], ctx.prev);
      toast.error(err.message || "Couldn't change AI autopilot");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      // The flag lives on the Client, so anything showing client data is now stale too.
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(summary.id, body),
    onSuccess: (res) => {
      onDraft("");
      qc.invalidateQueries({ queryKey: ["messages"] });
      // The message is stored either way; only delivery can fail. Saying so beats a silent
      // success on a message the client never received.
      if (res.delivered) toast.success(t("messages:thread.sentToast"));
      else
        toast.error(
          t("messages:thread.notDeliveredToast", {
            // The server's own error text, shown as the server sends it.
            reason: res.error ?? t("messages:thread.n8nUnreachable"),
          }),
        );
    },
    onError: (err: Error) => toast.error(err.message || t("messages:thread.sendFailed")),
  });

  const messages = thread?.messages ?? [];

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      const day = formatDay(m.at);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(m);
    }
    return Array.from(map.entries());
    // The map KEY is the formatted day label, so a language switch has to rebuild these groups
    // or the date separators keep the old language.
  }, [messages, formatDay]);

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft">
      {/* Thread header */}
      {/* gap-2 + min-w-0 on the right-hand control group: the Arabic autopilot label
          ("الرد التلقائي بالذكاء الاصطناعي") is far longer than "AI autopilot", and without a
          shrinkable left side it rode over the phone/WhatsApp line. */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {conversation.avatarInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold truncate">{conversation.name}</h2>
              <Badge variant="outline" className="h-5 text-[10px]">
                {conversationTag(conversation.tag)}
              </Badge>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span dir="ltr">{conversation.phone}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {t("messages:thread.channel")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="me-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
            <Sparkles
              className={cn("h-3.5 w-3.5", autopilot ? "text-primary" : "text-muted-foreground")}
            />
            <span className="hidden text-xs font-medium lg:inline">
              {t("messages:thread.autopilot")}
            </span>
            <Switch
              checked={autopilot}
              disabled={autopilotMutation.isPending}
              onCheckedChange={(v) => autopilotMutation.mutate(v)}
            />
          </div>
          <Button variant="ghost" size="icon" title={t("messages:thread.call")}>
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t("messages:thread.videoCall")}>
            <Video className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t("messages:thread.toggleContext")}
            onClick={onToggleContext}
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("messages:thread.moreActions")}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="space-y-6 p-6">
          {grouped.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {thread ? t("messages:thread.empty") : t("messages:thread.loading")}
            </p>
          )}
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
            {t("messages:thread.autopilotPaused")}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t("messages:thread.attach")}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && draft.trim() && !sendMutation.isPending) {
                e.preventDefault();
                sendMutation.mutate(draft.trim());
              }
            }}
            placeholder={
              autopilot
                ? t("messages:thread.composerOverride")
                : t("messages:thread.composerPlaceholder")
            }
            className="min-h-11 max-h-32 resize-none"
            rows={1}
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t("messages:thread.recordVoice")}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="shrink-0"
            disabled={!draft.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate(draft.trim())}
            aria-label={t("messages:thread.send")}
          >
            {/* The paper-plane points in the reading direction, so it has to mirror. */}
            <Send className="h-4 w-4 rtl:-scale-x-100" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground me-1">
            {t("messages:thread.quickLabel")}
          </span>
          {/* These are message BODIES, not UI labels — they go into the composer and get sent
              to a client over WhatsApp, so they have to be in the language the practice writes
              to clients in. Translated with the UI for that reason. */}
          {(
            [
              "quick.greatWork",
              "quick.sendPlan",
              "quick.bookConsult",
              "quick.requestWeighIn",
            ] as const
          ).map((key) => {
            const q = t(`messages:${key}`);
            return (
              <button
                key={key}
                onClick={() => onDraft(q)}
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground hover:bg-muted transition-colors"
              >
                {q}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation("messages");
  const { clock } = useThreadFormatters();
  // Per-bubble, so each photo opens itself. Cheap: the Dialog is only mounted for a message that
  // actually has an image.
  const [photoOpen, setPhotoOpen] = useState(false);
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
          // The squared-off "tail" corner. LOGICAL, not physical: `justify-end` already puts an
          // outgoing bubble on the left in Arabic, so a bottom-RIGHT tail would end up on the
          // far side of the bubble from the speaker and the chat would read as inverted.
          // rounded-ee = bottom-end, rounded-es = bottom-start.
          isOut
            ? message.author === "ai"
              ? "bg-primary/10 text-foreground border border-primary/20 rounded-ee-sm"
              : "bg-primary text-primary-foreground rounded-ee-sm"
            : "bg-card border border-border rounded-es-sm",
          // A failed send is the one message state worth ringing. The mock's per-message
          // `flagged` had no producer and isn't built (see messages-api.ts).
          message.status === "failed" && "ring-2 ring-destructive/50",
        )}
      >
        {isOut && (
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-75">
            {message.author === "ai" ? (
              <>
                <Sparkles className="h-2.5 w-2.5" />
                {t("bubble.aiReply")}
              </>
            ) : (
              <>
                <UserCircle2 className="h-2.5 w-2.5" />
                {t("bubble.you")}
              </>
            )}
          </div>
        )}

        {/* The real photo (prompt-123). Keyed off attachmentUrl rather than kind === "image":
            if n8n ever sends the bytes without tagging the kind, the photo should still show,
            and a kind of "image" with nothing stored should still explain itself. */}
        {message.attachmentUrl && (
          <>
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="mb-1.5 block overflow-hidden rounded-md ring-offset-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={t("bubble.viewFullSize")}
            >
              <img
                src={message.attachmentUrl}
                // The label is a filename ("lunch.jpg") — useless to a screen reader, so the
                // alt describes what the image IS. Empty alt would hide a photo that is often
                // the entire content of the message.
                alt={
                  message.attachmentLabel
                    ? t("bubble.photoAltLabelled", { label: message.attachmentLabel })
                    : t("bubble.photoAlt")
                }
                loading="lazy"
                className="max-h-60 w-full max-w-[240px] cursor-zoom-in object-cover transition-opacity hover:opacity-90"
              />
            </button>
            <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle className="text-sm font-medium">
                    {message.attachmentLabel ?? t("bubble.photo")}
                  </DialogTitle>
                </DialogHeader>
                {/* Capped against the viewport, not a fixed size: a portrait phone photo would
                    otherwise run off the bottom of the dialog with no way to see the rest. */}
                <img
                  src={message.attachmentUrl}
                  alt={
                    message.attachmentLabel
                      ? t("bubble.photoAltLabelled", { label: message.attachmentLabel })
                      : t("bubble.photoAlt")
                  }
                  className="max-h-[75vh] w-auto rounded-md object-contain"
                />
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* No stored image: every message logged before prompt-123, and any whose upload
            failed. Unchanged from what the inbox showed before — minus the "Tap to view full
            size" line, which promised something that never worked. */}
        {!message.attachmentUrl && message.kind === "image" && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-background/40 px-2 py-2 text-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {message.attachmentLabel ?? t("bubble.photoFallbackName")}
              </p>
              <p className="text-[10px] opacity-70">{t("bubble.photoNotStored")}</p>
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
            {/* Duration omitted: n8n doesn't send it, and a fabricated 0:00 is worse than
                nothing. attachmentLabel carries what is actually known. */}
            <span className="text-[11px] opacity-80">
              {message.attachmentLabel ?? t("bubble.voiceNote")}
            </span>
          </div>
        )}

        {message.kind === "plan" && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md bg-background/40 px-2 py-2 text-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/20 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{message.attachmentLabel ?? t("bubble.mealPlan")}</p>
              <p className="text-[10px] opacity-70">{t("bubble.deliveredToWhatsApp")}</p>
            </div>
          </div>
        )}

        {message.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}

        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px] opacity-70",
            isOut ? "justify-end" : "justify-start",
          )}
        >
          <span>{clock(message.at)}</span>
          {/* Real delivery states only. "delivered"/"read" would need WhatsApp receipts
              flowing back through n8n, which don't exist — double ticks that always showed
              would be a lie about whether a client saw the message. */}
          {isOut && message.status === "sent" && <Check className="h-3 w-3" />}
          {isOut && message.status === "queued" && <Clock className="h-3 w-3 opacity-60" />}
          {/* The outbound bubble is a solid dark fill, so `text-destructive` on it is dark-on-dark
              and unreadable. Inherit the bubble's own foreground and carry the warning with the
              ring around the bubble plus full opacity instead of colour alone. */}
          {isOut && message.status === "failed" && (
            <span className="inline-flex items-center gap-0.5 font-medium opacity-100">
              <AlertCircle className="h-3 w-3" />
              {t("bubble.notDelivered")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ conversation }: { conversation: ConversationSummary }) {
  const { t } = useTranslation("messages");
  const conversationTag = useConversationTag();
  const isLead = conversation.kind === "lead";
  return (
    <div className="hidden xl:flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("context.heading")}
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
            <Badge variant="outline" className="mt-2 text-[10px]">
              {conversationTag(conversation.tag)}
            </Badge>
          </div>

          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="h-3.5 w-3.5" />
            {isLead ? t("context.openLead") : t("context.openClient")}
          </Button>

          <Separator />

          {!isLead ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("context.todaysTargets")}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">{t("context.calories")}</p>
                  <p className="font-display text-lg font-semibold">1,650</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">{t("context.adherence")}</p>
                  <p className="font-display text-lg font-semibold text-success">82%</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">{t("context.weightDelta")}</p>
                  {/* Hardcoded mock (no backend source yet) — isolated so the sign stays on
                      the left of the digits once this is wired to a real value. */}
                  <p className="font-display text-lg font-semibold">{ltrIsolate("-1.4 kg")}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-muted-foreground">{t("context.week")}</p>
                  <p className="font-display text-lg font-semibold">3 / 12</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("context.leadSnapshot")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("context.stage")}</span>
                  <span className="font-medium">New</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("context.source")}</span>
                  <span className="font-medium">Instagram reel</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("context.interest")}</span>
                  <span className="font-medium">Diet · PCOS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("context.qualityScore")}</span>
                  <span className="font-medium text-success">82 / 100</span>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("context.internalNotes")}
            </h4>
            <Textarea placeholder={t("context.notePlaceholder")} className="min-h-20 text-xs" />
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("context.quickActions")}
            </h4>
            <div className="grid gap-1.5">
              <Button variant="outline" size="sm" className="justify-start">
                {t("context.sendPlan")}
              </Button>
              <Button variant="outline" size="sm" className="justify-start">
                {t("context.scheduleAppointment")}
              </Button>
              <Button variant="outline" size="sm" className="justify-start">
                {t("context.requestWeighIn")}
              </Button>
              {isLead && (
                <Button variant="outline" size="sm" className="justify-start">
                  {t("context.convertToClient")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
