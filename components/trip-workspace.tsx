"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  Lock,
  MapPin,
  Send,
  Share2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  enqueueBuildTrip,
  enqueueRegenerateDay,
  loadTrips,
  loadWorkspaceData,
  patchItineraryItem,
  patchTripPlace,
  pollAgentRun,
  publishShare,
  streamTripChat,
  unpublishShare,
} from "@/lib/api-client";
import {
  absoluteShareUrl,
  createIdempotencyKey,
  formatBudget,
  formatDateRange,
  formatDayDate,
  formatStatus,
  formatTime,
} from "@/lib/formatters";
import type {
  AgentEvent,
  AgentRun,
  ChatMessage,
  ChecklistItem,
  ItineraryDay,
  ItineraryItem,
  Trip,
  TripPlace,
  TripShareStatus,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const MOBILE_TABS = [
  "chat",
  "itinerary",
  "places",
  "budget",
  "tasks",
  "activity",
] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

type RunState = {
  busy: boolean;
  status: string;
  summary: string;
  events: AgentEvent[];
};

const emptyRun: RunState = { busy: false, status: "", summary: "", events: [] };

export function TripWorkspace({ tripId }: { tripId: string }) {
  const { getToken } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [shareStatus, setShareStatus] = useState<TripShareStatus | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("itinerary");
  const [sidePanel, setSidePanel] = useState<
    "places" | "budget" | "tasks" | "activity"
  >("places");
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [buildRun, setBuildRun] = useState<RunState>(emptyRun);
  const [regenerateRun, setRegenerateRun] = useState<RunState>(emptyRun);
  const [regenerateDay, setRegenerateDay] = useState<ItineraryDay | null>(null);
  const [regenerateInstruction, setRegenerateInstruction] = useState("");

  async function refreshWorkspace() {
    const data = await loadWorkspaceData(tripId, getToken);
    setTrip(data.trip);
    setMessages(data.messages);
    setItineraryDays(data.itineraryDays);
    setPlaces(data.places);
    setChecklist(data.checklist);
    setAgentEvents(data.events);
    setShareStatus(data.share);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await loadWorkspaceData(tripId, getToken);
        if (cancelled) return;
        setTrip(data.trip);
        setMessages(data.messages);
        setItineraryDays(data.itineraryDays);
        setPlaces(data.places);
        setChecklist(data.checklist);
        setAgentEvents(data.events);
        setShareStatus(data.share);
      } catch {
        if (!cancelled) setError("Could not load this trip workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [getToken, tripId]);

  const workflowBusy =
    buildRun.busy || regenerateRun.busy || streaming || loading;
  const budget = trip?.planning_context?.build_trip?.budget;
  const budgetTotal = budget?.total_estimate ?? trip?.budget_amount;

  function activateMobileTab(tab: MobileTab) {
    setMobileTab(tab);
    if (
      tab === "places" ||
      tab === "budget" ||
      tab === "tasks" ||
      tab === "activity"
    ) {
      setSidePanel(tab);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!trip || !text || streaming) return;

    setChatInput("");
    setStreaming(true);
    setError("");
    setMessages((current) => [
      ...current,
      optimisticMessage(trip.id, "user", text),
      optimisticMessage(trip.id, "assistant", ""),
    ]);

    let assistantText = "";
    let failed = false;

    try {
      await streamTripChat(trip.id, text, getToken, (streamEvent) => {
        if (streamEvent.type === "delta") {
          assistantText += streamEvent.text;
          setMessages((current) =>
            current.map((message, index) =>
              index === current.length - 1
                ? { ...message, content: assistantText }
                : message,
            ),
          );
        }

        if (streamEvent.type === "error") {
          failed = true;
          setError(
            streamEvent.message || "Wayfinder could not complete this request.",
          );
        }
      });

      const data = await loadWorkspaceData(trip.id, getToken);
      setMessages(data.messages);
      setAgentEvents(data.events);

      if (failed) {
        setError("Wayfinder could not complete this request.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  async function updateItem(
    item: ItineraryItem,
    patch: Partial<ItineraryItem>,
  ) {
    const previous = itineraryDays;
    setItineraryDays((days) =>
      days.map((day) => ({
        ...day,
        items: day.items.map((candidate) =>
          candidate.id === item.id ? { ...candidate, ...patch } : candidate,
        ),
      })),
    );

    try {
      const updated = await patchItineraryItem(item.id, patch, getToken);
      setItineraryDays((days) =>
        days.map((day) => ({
          ...day,
          items: day.items.map((candidate) =>
            candidate.id === item.id ? updated : candidate,
          ),
        })),
      );
    } catch {
      setItineraryDays(previous);
      setError("Could not save itinerary change.");
    }
  }

  async function updatePlace(place: TripPlace, status: string) {
    const previous = places;
    setPlaces((current) =>
      current.map((candidate) =>
        candidate.id === place.id ? { ...candidate, status } : candidate,
      ),
    );

    try {
      const updated = await patchTripPlace(place.id, { status }, getToken);
      setPlaces((current) =>
        current.map((candidate) =>
          candidate.id === place.id ? updated : candidate,
        ),
      );
    } catch {
      setPlaces(previous);
      setError("Could not save place status.");
    }
  }

  async function runBuildTrip() {
    if (!trip || workflowBusy) return;

    setError("");
    setBuildRun({ ...emptyRun, busy: true, status: "queued" });
    activateMobileTab("activity");

    try {
      const started = await enqueueBuildTrip(
        trip.id,
        createIdempotencyKey("build-trip"),
        getToken,
      );
      const run = await pollAgentRun(
        trip.id,
        started.agent_run_id,
        getToken,
        (current) => {
          setBuildRun(runStateFromAgentRun(current, true));
        },
      );

      setBuildRun(runStateFromAgentRun(run, false));
      if (run.status === "completed") {
        await refreshWorkspace();
      } else if (run.status === "failed") {
        setError(
          run.error_message || "Build My Trip failed. Please try again.",
        );
      }
    } catch {
      setBuildRun((current) => ({ ...current, busy: false, status: "failed" }));
      setError("Build My Trip failed. Please try again.");
    }
  }

  async function runRegenerateDay(event: FormEvent) {
    event.preventDefault();
    const instruction = regenerateInstruction.trim();
    if (!trip || !regenerateDay || !instruction || workflowBusy) return;

    setError("");
    setRegenerateRun({ ...emptyRun, busy: true, status: "queued" });
    activateMobileTab("activity");

    try {
      const started = await enqueueRegenerateDay(
        trip.id,
        regenerateDay.id,
        instruction,
        createIdempotencyKey("regenerate-day"),
        getToken,
      );
      const run = await pollAgentRun(
        trip.id,
        started.agent_run_id,
        getToken,
        (current) => {
          setRegenerateRun(runStateFromAgentRun(current, true));
        },
      );

      setRegenerateRun(runStateFromAgentRun(run, false));
      if (run.status === "completed") {
        await refreshWorkspace();
        setRegenerateDay(null);
        setRegenerateInstruction("");
      } else if (run.status === "failed") {
        setError(
          run.error_message || "Day regeneration failed. Please try again.",
        );
      }
    } catch {
      setRegenerateRun((current) => ({
        ...current,
        busy: false,
        status: "failed",
      }));
      setError("Day regeneration failed. Please try again.");
    }
  }

  async function publishCurrentShare() {
    if (!trip || shareBusy) return;
    setShareBusy(true);
    setShareCopied(false);
    setError("");
    try {
      const status = await publishShare(trip.id, getToken);
      setShareStatus(status);
      const [workspace, trips] = await Promise.all([
        loadWorkspaceData(trip.id, getToken),
        loadTrips(getToken),
      ]);
      setTrip(workspace.trip);
      void trips;
    } catch {
      setError("Could not publish this share page.");
    } finally {
      setShareBusy(false);
    }
  }

  async function unpublishCurrentShare() {
    if (!trip || shareBusy) return;
    setShareBusy(true);
    setShareCopied(false);
    setError("");
    try {
      const status = await unpublishShare(trip.id, getToken);
      setShareStatus(status);
      const workspace = await loadWorkspaceData(trip.id, getToken);
      setTrip(workspace.trip);
    } catch {
      setError("Could not unpublish this share page.");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    const url = absoluteShareUrl(shareStatus?.share_path);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setError("Could not copy the share link.");
    }
  }

  if (loading && !trip) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center p-6 text-center">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            Trip unavailable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "This trip could not be loaded."}
          </p>
          <Button
            className="mt-5"
            render={<Link href="/trips" />}
            variant="outline"
          >
            Back to trips
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <header className="flex flex-col gap-3 border-b bg-card px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/trips" />}
            aria-label="Back to dashboard"
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-serif text-xl font-semibold">
                {trip.title}
              </h1>
              <Badge variant="secondary">{trip.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateRange(trip)} · {trip.destination} · private workspace
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareControls
            shareStatus={shareStatus}
            busy={shareBusy}
            copied={shareCopied}
            onPublish={publishCurrentShare}
            onCopy={copyShareLink}
            onUnpublish={unpublishCurrentShare}
          />
        </div>
      </header>

      {error && (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <nav
        className="grid grid-cols-6 border-b bg-background lg:hidden"
        aria-label="Workspace panels"
      >
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => activateMobileTab(tab)}
            className={`min-w-0 px-1 py-3 text-[11px] font-semibold capitalize ${mobileTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="grid flex-1 lg:grid-cols-[280px_minmax(380px,1fr)_320px] 2xl:grid-cols-[340px_minmax(520px,1fr)_390px]">
        <section
          className={`${mobileTab === "chat" ? "block" : "hidden"} min-h-0 border-r bg-card lg:block`}
        >
          <ChatPanel
            messages={messages}
            input={chatInput}
            setInput={setChatInput}
            streaming={streaming}
            onSubmit={sendMessage}
          />
        </section>

        <section
          className={`${mobileTab === "itinerary" ? "block" : "hidden"} min-w-0 bg-background lg:block`}
        >
          <ItineraryPanel
            trip={trip}
            days={itineraryDays}
            workflowBusy={workflowBusy}
            buildRun={buildRun}
            regenerateRun={regenerateRun}
            onBuildTrip={runBuildTrip}
            onOpenRegenerate={setRegenerateDay}
            onUpdateItem={updateItem}
          />
        </section>

        <aside
          className={`${["places", "budget", "tasks", "activity"].includes(mobileTab) ? "block" : "hidden"} min-h-0 border-l bg-card lg:block`}
        >
          <SidePanel
            active={sidePanel}
            setActive={setSidePanel}
            trip={trip}
            places={places}
            checklist={checklist}
            agentEvents={agentEvents}
            buildRun={buildRun}
            regenerateRun={regenerateRun}
            budgetTotal={budgetTotal}
            budgetCurrency={budget?.currency || "USD"}
            budgetCategories={budget?.categories || []}
            budgetNotes={budget?.notes || []}
            onUpdatePlace={updatePlace}
          />
        </aside>
      </div>

      <Dialog
        open={!!regenerateDay}
        onOpenChange={(open) =>
          !open && !regenerateRun.busy && setRegenerateDay(null)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Regenerate day {regenerateDay?.day_number}
            </DialogTitle>
            <DialogDescription>
              Describe what should change. Locked and booked items remain
              protected by the backend workflow.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={runRegenerateDay}>
            <Textarea
              value={regenerateInstruction}
              onChange={(event) => setRegenerateInstruction(event.target.value)}
              placeholder="Make this day slower, keep dinner booked, and reduce cross-town transit..."
              disabled={regenerateRun.busy}
              className="min-h-28 resize-none"
            />
            <Button
              type="submit"
              disabled={regenerateRun.busy || !regenerateInstruction.trim()}
            >
              <WandSparkles data-icon="inline-start" />
              {regenerateRun.busy ? "Regenerating..." : "Regenerate day"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChatPanel({
  messages,
  input,
  setInput,
  streaming,
  onSubmit,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  streaming: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[580px] flex-col lg:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-sm font-semibold">Trip-aware assistant</h2>
          <p className="text-[11px] text-muted-foreground">
            Uses itinerary, places, budget, and prior messages.
          </p>
        </div>
        {streaming && <Badge variant="secondary">Streaming</Badge>}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`flex flex-col gap-1 ${message.role === "user" ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {message.role === "user" ? "You" : "Wayfinder"}
              </span>
              <p
                className={`max-w-[92%] rounded-md p-3 text-xs leading-relaxed ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {message.content || "Preparing the first notes..."}
              </p>
            </div>
          ))}
          {!messages.length && (
            <p className="rounded-md bg-secondary p-3 text-xs leading-6 text-muted-foreground">
              Ask Wayfinder to shape this trip, compare options, or audit the
              itinerary against your saved context.
            </p>
          )}
        </div>
      </div>
      <form className="border-t p-3" onSubmit={onSubmit}>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask about this trip..."
          disabled={streaming}
          className="min-h-20 resize-none"
        />
        <div className="mt-2 flex justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Context-aware chat persists to the backend.
          </p>
          <Button type="submit" size="sm" disabled={streaming || !input.trim()}>
            <Send data-icon="inline-end" />
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

function ItineraryPanel({
  trip,
  days,
  workflowBusy,
  buildRun,
  regenerateRun,
  onBuildTrip,
  onOpenRegenerate,
  onUpdateItem,
}: {
  trip: Trip;
  days: ItineraryDay[];
  workflowBusy: boolean;
  buildRun: RunState;
  regenerateRun: RunState;
  onBuildTrip: () => void;
  onOpenRegenerate: (day: ItineraryDay) => void;
  onUpdateItem: (item: ItineraryItem, patch: Partial<ItineraryItem>) => void;
}) {
  return (
    <div>
      <div className="sticky top-16 z-10 flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">Itinerary</h2>
          <p className="text-xs text-muted-foreground">
            {trip.progress}% ready · {days.length} saved days · item toggles
            persist
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline">
            <CalendarDays data-icon="inline-start" />
            {formatDateRange(trip)}
          </Button>
          <Button size="sm" onClick={onBuildTrip} disabled={workflowBusy}>
            <Sparkles data-icon="inline-start" />
            {buildRun.busy ? "Building..." : "Build My Trip"}
          </Button>
        </div>
      </div>

      {(buildRun.status || regenerateRun.status) && (
        <div className="border-b bg-card px-4 py-3">
          <WorkflowProgress buildRun={buildRun} regenerateRun={regenerateRun} />
        </div>
      )}

      <div className="flex flex-col gap-4 p-3 md:p-5">
        {days.map((day) => (
          <article
            key={day.id}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <header className="flex flex-col gap-3 border-b bg-secondary/35 p-4 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="text-[9px] uppercase">Day</span>
                <strong className="text-base leading-none">
                  {day.day_number}
                </strong>
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-semibold">
                  {day.title || `Day ${day.day_number}`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDayDate(day.date)} ·{" "}
                  {day.summary || "Details still being shaped"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenRegenerate(day)}
                disabled={workflowBusy || !day.items.length}
              >
                <WandSparkles data-icon="inline-start" />
                Regenerate
              </Button>
            </header>
            <div>
              {day.items.map((item) => (
                <div
                  key={item.id}
                  className="group flex gap-3 border-b p-3 last:border-b-0 md:items-center"
                >
                  <div className="w-11 shrink-0 text-xs font-semibold tabular-nums">
                    {formatTime(item.start_time)}
                  </div>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <MapPin className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.is_booked && (
                        <Badge className="bg-success text-success-foreground">
                          <Check className="size-3" />
                          Booked
                        </Badge>
                      )}
                      {item.is_locked && (
                        <Badge variant="outline">
                          <Lock className="size-3" />
                          Locked
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.category || "Plan"} ·{" "}
                      {item.description || "No notes yet"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        onUpdateItem(item, { is_locked: !item.is_locked })
                      }
                      aria-label={item.is_locked ? "Unlock item" : "Lock item"}
                    >
                      <Lock
                        className={
                          item.is_locked
                            ? "text-primary"
                            : "text-muted-foreground"
                        }
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        onUpdateItem(item, { is_booked: !item.is_booked })
                      }
                      aria-label={
                        item.is_booked ? "Mark unbooked" : "Mark booked"
                      }
                    >
                      <CheckCircle2
                        className={
                          item.is_booked
                            ? "text-success"
                            : "text-muted-foreground"
                        }
                      />
                    </Button>
                  </div>
                </div>
              ))}
              {!day.items.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  No itinerary items saved for this day yet.
                </p>
              )}
            </div>
          </article>
        ))}

        {!days.length && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h3 className="font-serif text-2xl font-semibold">
              No itinerary yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Use Build My Trip or chat to generate structured trip artifacts
              from the current workspace state.
            </p>
            <Button
              className="mt-5"
              onClick={onBuildTrip}
              disabled={workflowBusy}
            >
              <Sparkles data-icon="inline-start" />
              Build My Trip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SidePanel({
  active,
  setActive,
  trip,
  places,
  checklist,
  agentEvents,
  buildRun,
  regenerateRun,
  budgetTotal,
  budgetCurrency,
  budgetCategories,
  budgetNotes,
  onUpdatePlace,
}: {
  active: "places" | "budget" | "tasks" | "activity";
  setActive: (value: "places" | "budget" | "tasks" | "activity") => void;
  trip: Trip;
  places: TripPlace[];
  checklist: ChecklistItem[];
  agentEvents: AgentEvent[];
  buildRun: RunState;
  regenerateRun: RunState;
  budgetTotal: string | number | null | undefined;
  budgetCurrency: string;
  budgetCategories: Array<{ name: string; amount: string | number }>;
  budgetNotes: string[];
  onUpdatePlace: (place: TripPlace, status: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[580px] flex-col">
      <div className="grid grid-cols-4 gap-1 border-b p-3">
        {(["places", "budget", "tasks", "activity"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`rounded-md px-2 py-2 text-xs font-semibold capitalize ${active === tab ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {active === "places" && (
          <PlacesPanel places={places} onUpdatePlace={onUpdatePlace} />
        )}
        {active === "budget" && (
          <BudgetPanel
            trip={trip}
            total={budgetTotal}
            currency={budgetCurrency}
            categories={budgetCategories}
            notes={budgetNotes}
          />
        )}
        {active === "tasks" && <ChecklistPanel checklist={checklist} />}
        {active === "activity" && (
          <ActivityPanel
            agentEvents={agentEvents}
            buildRun={buildRun}
            regenerateRun={regenerateRun}
          />
        )}
      </div>
    </div>
  );
}

function PlacesPanel({
  places,
  onUpdatePlace,
}: {
  places: TripPlace[];
  onUpdatePlace: (place: TripPlace, status: string) => void;
}) {
  return (
    <div>
      <PanelTitle
        icon={MapPin}
        title="Place board"
        sub={`${places.length} saved places`}
      />
      <div className="grid gap-3">
        {places.map((tripPlace, index) => (
          <div key={tripPlace.id} className="rounded-md border p-3">
            <div className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {tripPlace.place.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tripPlace.place.category || "Place"} ·{" "}
                  {tripPlace.notes ||
                    tripPlace.place.city ||
                    tripPlace.place.country ||
                    "Saved for review"}
                </p>
              </div>
            </div>
            <select
              className="mt-3 h-8 w-full rounded-md border bg-background px-2 text-xs"
              value={tripPlace.status}
              onChange={(event) => onUpdatePlace(tripPlace, event.target.value)}
            >
              {["suggested", "interested", "booked", "skipped"].map(
                (status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ),
              )}
            </select>
          </div>
        ))}
        {!places.length && (
          <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            No saved places yet.
          </p>
        )}
      </div>
    </div>
  );
}

function BudgetPanel({
  trip,
  total,
  currency,
  categories,
  notes,
}: {
  trip: Trip;
  total: string | number | null | undefined;
  currency: string;
  categories: Array<{ name: string; amount: string | number }>;
  notes: string[];
}) {
  return (
    <div>
      <PanelTitle
        icon={CircleDollarSign}
        title={formatBudget(total ?? trip.budget_amount, currency)}
        sub="Current estimate"
      />
      <Progress value={trip.progress} className="my-4" />
      <div className="grid gap-2">
        {categories.map((category) => (
          <div
            key={category.name}
            className="flex items-center justify-between border-b py-3 text-sm"
          >
            <span>{category.name}</span>
            <strong>{formatBudget(category.amount, currency)}</strong>
          </div>
        ))}
        {!categories.length && (
          <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            No category estimate yet.
          </p>
        )}
      </div>
      {notes.map((note) => (
        <p
          key={note}
          className="mt-3 rounded-md border p-3 text-xs leading-5 text-muted-foreground"
        >
          {note}
        </p>
      ))}
    </div>
  );
}

function ChecklistPanel({ checklist }: { checklist: ChecklistItem[] }) {
  return (
    <div>
      <PanelTitle
        icon={ClipboardList}
        title="Checklist"
        sub={`${checklist.filter((item) => !item.is_completed).length} open tasks`}
      />
      {checklist.map((item) => (
        <div key={item.id} className="flex items-start gap-3 border-b py-3">
          <span
            className={`mt-0.5 flex size-5 items-center justify-center rounded border ${item.is_completed ? "bg-success text-success-foreground" : "bg-background"}`}
          >
            {item.is_completed && <Check className="size-3" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">
              {item.due_label || formatStatus(item.priority || "medium")}
            </span>
          </span>
        </div>
      ))}
      {!checklist.length && (
        <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
          No checklist items yet.
        </p>
      )}
      <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
        Checklist items are read-only in v0.9 because the backend currently
        exposes retrieval but not checklist mutation endpoints.
      </p>
    </div>
  );
}

function ActivityPanel({
  agentEvents,
  buildRun,
  regenerateRun,
}: {
  agentEvents: AgentEvent[];
  buildRun: RunState;
  regenerateRun: RunState;
}) {
  const activeEvents = [...buildRun.events, ...regenerateRun.events];
  const events = activeEvents.length ? activeEvents : agentEvents;

  return (
    <div>
      <PanelTitle
        icon={Bot}
        title="Activity"
        sub={
          buildRun.busy || regenerateRun.busy
            ? "Workflow running"
            : "Recent agent events"
        }
      />
      <WorkflowProgress buildRun={buildRun} regenerateRun={regenerateRun} />
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {event.title || event.event_type || "Agent event"}
              </p>
              <Badge variant="outline">{event.status}</Badge>
            </div>
            {event.detail && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {event.detail}
              </p>
            )}
          </div>
        ))}
        {!events.length && (
          <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            No workflow events yet.
          </p>
        )}
      </div>
    </div>
  );
}

function WorkflowProgress({
  buildRun,
  regenerateRun,
}: {
  buildRun: RunState;
  regenerateRun: RunState;
}) {
  const active = buildRun.status
    ? buildRun
    : regenerateRun.status
      ? regenerateRun
      : null;
  if (!active) return null;

  const value =
    active.status === "completed"
      ? 100
      : active.status === "failed"
        ? 100
        : active.status === "queued"
          ? 20
          : 62;
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold">Workflow status</span>
        <Badge variant="secondary">{active.status}</Badge>
      </div>
      <Progress value={value} />
      {active.summary && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {active.summary}
        </p>
      )}
    </div>
  );
}

function ShareControls({
  shareStatus,
  busy,
  copied,
  onPublish,
  onCopy,
  onUnpublish,
}: {
  shareStatus: TripShareStatus | null;
  busy: boolean;
  copied: boolean;
  onPublish: () => void;
  onCopy: () => void;
  onUnpublish: () => void;
}) {
  if (!shareStatus?.share_enabled) {
    return (
      <Button variant="outline" size="sm" onClick={onPublish} disabled={busy}>
        <Share2 data-icon="inline-start" />
        {busy ? "Publishing..." : "Publish share page"}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={onCopy} disabled={busy}>
        <Share2 data-icon="inline-start" />
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        render={<Link href={shareStatus.share_path || "#"} target="_blank" />}
      >
        <ExternalLink data-icon="inline-start" />
        Open
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onUnpublish}
        disabled={busy}
      >
        {busy ? "Unpublishing..." : "Unpublish"}
      </Button>
    </>
  );
}

function PanelTitle({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof MapPin;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="size-4 text-primary" />
      </span>
      <div>
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function optimisticMessage(
  tripId: string,
  role: "user" | "assistant",
  content: string,
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    trip_id: tripId,
    role,
    content,
    created_at: new Date().toISOString(),
  };
}

function runStateFromAgentRun(run: AgentRun, busy: boolean): RunState {
  return {
    busy,
    status: run.status,
    summary: run.output_summary || run.error_message || "",
    events: run.events,
  };
}
