import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const WORKFLOWS = ["Optimize itinerary", "Find alternatives", "Budget audit", "Booking readiness"];
const PLACE_STATUSES = ["suggested", "interested", "booked", "skipped"];
const WORKFLOW_TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);
const WORKSPACE_MOBILE_TABS = ["chat", "itinerary", "places", "budget", "tasks", "activity"];

const FALLBACK_ACTIVITIES = [
  {
    workflow: "Itinerary Optimizer completed",
    detail: "Reduced transit by 48 minutes across days 2-4.",
    time: "Recently",
    status: "Complete",
  },
  {
    workflow: "Restaurant Scout needs review",
    detail: "Found dinner options matching the saved trip context.",
    time: "Saved",
    status: "Review",
  },
  {
    workflow: "Booking Monitor is watching",
    detail: "Lightweight agent events will become durable in a later release.",
    time: "Beta",
    status: "Active",
  },
];

async function api(path, options = {}, getToken) {
  const token = getToken ? await getToken() : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

function getShareSlugFromPath() {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function absoluteShareUrl(sharePath) {
  if (!sharePath) return "";
  return `${window.location.origin}${sharePath}`;
}

function formatDateRange(trip) {
  if (!trip.start_date && !trip.end_date) return "Dates not set";
  if (trip.start_date && trip.end_date) return `${formatDate(trip.start_date)}-${formatDate(trip.end_date)}`;
  return formatDate(trip.start_date || trip.end_date);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDayDate(value) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatTime(value) {
  if (!value) return "TBD";
  return value.slice(0, 5);
}

function formatBudget(value, currency = "USD") {
  if (value === null || value === undefined) return "Budget TBD";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatStatus(value) {
  if (!value) return "";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createIdempotencyKey(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRunEvents(run) {
  return (run.events || []).map((event) => ({
    event: event.event_type,
    payload: event.payload || {},
    status: event.status,
  }));
}

export default function App() {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const publicShareSlug = getShareSlugFromPath();
  const currentUser = useMemo(() => {
    if (!clerkUser) return null;
    return {
      display_name: clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress || "Wayfinder user",
      email: clerkUser.primaryEmailAddress?.emailAddress || "",
      avatar_url: clerkUser.imageUrl || null,
    };
  }, [clerkUser]);
  const [view, setView] = useState(publicShareSlug ? "share" : "landing");
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activePanel, setActivePanel] = useState("places");
  const [mobileWorkspacePanel, setMobileWorkspacePanel] = useState("itinerary");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [itineraryDays, setItineraryDays] = useState([]);
  const [tripPlaces, setTripPlaces] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [buildTripStreaming, setBuildTripStreaming] = useState(false);
  const [buildTripEvents, setBuildTripEvents] = useState([]);
  const [buildTripSummary, setBuildTripSummary] = useState("");
  const [buildTripStatus, setBuildTripStatus] = useState("");
  const [regenerateDayStreaming, setRegenerateDayStreaming] = useState(false);
  const [regenerateDayEvents, setRegenerateDayEvents] = useState([]);
  const [regenerateDaySummary, setRegenerateDaySummary] = useState("");
  const [regenerateDayStatus, setRegenerateDayStatus] = useState("");
  const [regenerateDayTarget, setRegenerateDayTarget] = useState(null);
  const [regenerateInstruction, setRegenerateInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedTripId = selectedTrip?.id;

  const clearPrivateState = useCallback(() => {
    setTrips([]);
    setSelectedTrip(null);
    setShareStatus(null);
    setShareCopied(false);
    setActivePanel("places");
    setMobileWorkspacePanel("itinerary");
    setChatInput("");
    setMessages([]);
    setItineraryDays([]);
    setTripPlaces([]);
    setChecklistItems([]);
    setAgentEvents([]);
    setStreaming(false);
    setBuildTripStreaming(false);
    setBuildTripEvents([]);
    setBuildTripSummary("");
    setBuildTripStatus("");
    setRegenerateDayStreaming(false);
    setRegenerateDayEvents([]);
    setRegenerateDaySummary("");
    setRegenerateDayStatus("");
    setRegenerateDayTarget(null);
    setRegenerateInstruction("");
    setError("");
  }, []);

  const handleSignOut = useCallback(async () => {
    clearPrivateState();
    setView("landing");
    await signOut();
  }, [clearPrivateState, signOut]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view, selectedTripId]);

  const loadTrips = useCallback(async () => {
    const data = await api("/trips", {}, getToken);
    setTrips(data);
    return data;
  }, [getToken]);

  const loadWorkspace = useCallback(async (tripId) => {
    setLoading(true);
    setError("");

    try {
      const [trip, savedMessages, itinerary, places, checklist, events, share] = await Promise.all([
        api(`/trips/${tripId}`, {}, getToken),
        api(`/trips/${tripId}/messages`, {}, getToken),
        api(`/trips/${tripId}/itinerary`, {}, getToken),
        api(`/trips/${tripId}/places`, {}, getToken),
        api(`/trips/${tripId}/checklist`, {}, getToken),
        api(`/trips/${tripId}/agent-events`, {}, getToken),
        api(`/trips/${tripId}/share`, {}, getToken),
      ]);

      setSelectedTrip(trip);
      setShareStatus(share);
      setShareCopied(false);
      setMessages(savedMessages.map((message) => ({ ...message, text: message.content })));
      setItineraryDays(itinerary);
      setTripPlaces(places);
      setChecklistItems(checklist);
      setAgentEvents(events);
      setView("workspace");
    } catch (err) {
      setError("Could not load this trip workspace.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (publicShareSlug) return;
    if (!isLoaded) return;

    let cancelled = false;

    if (!isSignedIn) {
      clearPrivateState();
      setView("landing");
      return () => {
        cancelled = true;
      };
    }

    async function restoreSession() {
      setLoading(true);
      setError("");
      try {
        await loadTrips();
        if (!cancelled) setView("dashboard");
      } catch (err) {
        if (!cancelled) setError("Could not load your private workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [clearPrivateState, isLoaded, isSignedIn, loadTrips, publicShareSlug]);

  async function createTrip() {
    setLoading(true);
    setError("");

    try {
      const trip = await api("/trips", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled trip",
          destination: "New destination",
          status: "Draft",
          progress: 0,
        }),
      }, getToken);
      await loadTrips();
      await loadWorkspace(trip.id);
    } catch (err) {
      setError("Could not create a trip.");
    } finally {
      setLoading(false);
    }
  }

  async function sendChatMessage(e) {
    e.preventDefault();

    const text = chatInput.trim();
    if (!text || streaming || !selectedTripId) return;

    setChatInput("");
    setError("");
    setStreaming(true);

    const optimisticUser = { role: "user", text, content: text };
    const assistantDraft = { role: "assistant", text: "", content: "" };

    setMessages((current) => [...current, optimisticUser, assistantDraft]);

    let assistantText = "";
    let streamFailed = false;

    try {
      const res = await fetch(`${API_URL}/trips/${selectedTripId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line);

          if (event.type === "delta") {
            assistantText += event.text;
            setMessages((current) =>
              current.map((message, index) =>
                index === current.length - 1 ? { ...message, text: assistantText, content: assistantText } : message,
              ),
            );
          }

          if (event.type === "error") {
            streamFailed = true;
            setError(event.message || "Something went wrong. Please try again.");
          }

          if (event.type === "done") {
            const savedMessages = await api(`/trips/${selectedTripId}/messages`, {}, getToken);
            setMessages(savedMessages.map((message) => ({ ...message, text: message.content })));
          }
        }
      }

      if (streamFailed) {
        const savedMessages = await api(`/trips/${selectedTripId}/messages`, {}, getToken);
        setMessages(savedMessages.map((message) => ({ ...message, text: message.content })));
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  async function runBuildTrip() {
    if (!selectedTripId || buildTripStreaming || regenerateDayStreaming || streaming) return;

    setError("");
    setBuildTripStreaming(true);
    setBuildTripEvents([]);
    setBuildTripSummary("");
    setBuildTripStatus("queued");
    setActivePanel("activity");
    setMobileWorkspacePanel("activity");

    try {
      const startedRun = await api(`/trips/${selectedTripId}/agent/build-trip`, {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("build-trip") },
      }, getToken);

      let run = await api(`/trips/${selectedTripId}/agent-runs/${startedRun.agent_run_id}`, {}, getToken);
      setBuildTripStatus(run.status);
      setBuildTripEvents(normalizeRunEvents(run));
      setBuildTripSummary(run.output_summary || "");

      while (!WORKFLOW_TERMINAL_STATUSES.has(run.status)) {
        await sleep(1000);
        run = await api(`/trips/${selectedTripId}/agent-runs/${startedRun.agent_run_id}`, {}, getToken);
        setBuildTripStatus(run.status);
        setBuildTripEvents(normalizeRunEvents(run));
        setBuildTripSummary(run.output_summary || "");
      }

      setBuildTripStatus(run.status);
      setBuildTripEvents(normalizeRunEvents(run));
      setBuildTripSummary(run.output_summary || "");

      if (run.status === "completed") {
        await loadWorkspace(selectedTripId);
      } else if (run.status === "failed") {
        setError(run.error_message || "Build My Trip failed. Please try again.");
      }
    } catch (err) {
      setError("Build My Trip failed. Please try again.");
    } finally {
      setBuildTripStreaming(false);
    }
  }

  async function runRegenerateDay(e) {
    e.preventDefault();

    const instruction = regenerateInstruction.trim();
    if (!selectedTripId || !regenerateDayTarget || !instruction || regenerateDayStreaming || buildTripStreaming) return;

    setError("");
    setRegenerateDayStreaming(true);
    setRegenerateDayEvents([]);
    setRegenerateDaySummary("");
    setRegenerateDayStatus("queued");
    setActivePanel("activity");
    setMobileWorkspacePanel("activity");

    try {
      const startedRun = await api(`/trips/${selectedTripId}/agent/regenerate-day/${regenerateDayTarget.id}`, {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("regenerate-day") },
        body: JSON.stringify({ instruction }),
      }, getToken);

      let run = await api(`/trips/${selectedTripId}/agent-runs/${startedRun.agent_run_id}`, {}, getToken);
      setRegenerateDayStatus(run.status);
      setRegenerateDayEvents(normalizeRunEvents(run));
      setRegenerateDaySummary(run.output_summary || "");

      while (!WORKFLOW_TERMINAL_STATUSES.has(run.status)) {
        await sleep(1000);
        run = await api(`/trips/${selectedTripId}/agent-runs/${startedRun.agent_run_id}`, {}, getToken);
        setRegenerateDayStatus(run.status);
        setRegenerateDayEvents(normalizeRunEvents(run));
        setRegenerateDaySummary(run.output_summary || "");
      }

      setRegenerateDayStatus(run.status);
      setRegenerateDayEvents(normalizeRunEvents(run));
      setRegenerateDaySummary(run.output_summary || "");

      if (run.status === "completed") {
        await loadWorkspace(selectedTripId);
        setRegenerateDayTarget(null);
        setRegenerateInstruction("");
      } else if (run.status === "failed") {
        setError(run.error_message || "Day regeneration failed. Please try again.");
      }
    } catch (err) {
      setError("Day regeneration failed. Please try again.");
    } finally {
      setRegenerateDayStreaming(false);
    }
  }

  async function updateItineraryItem(itemId, patch) {
    const previous = itineraryDays;
    setItineraryDays((days) =>
      days.map((day) => ({
        ...day,
        items: day.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      })),
    );

    try {
      const updated = await api(`/itinerary-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }, getToken);

      setItineraryDays((days) =>
        days.map((day) => ({
          ...day,
          items: day.items.map((item) => (item.id === itemId ? updated : item)),
        })),
      );
    } catch (err) {
      setItineraryDays(previous);
      setError("Could not save itinerary change.");
    }
  }

  async function updateTripPlace(tripPlaceId, patch) {
    const previous = tripPlaces;
    setTripPlaces((places) => places.map((place) => (place.id === tripPlaceId ? { ...place, ...patch } : place)));

    try {
      const updated = await api(`/trip-places/${tripPlaceId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }, getToken);
      setTripPlaces((places) => places.map((place) => (place.id === tripPlaceId ? updated : place)));
    } catch (err) {
      setTripPlaces(previous);
      setError("Could not save place status.");
    }
  }

  async function publishSharePage() {
    if (!selectedTripId || shareBusy) return;

    setShareBusy(true);
    setShareCopied(false);
    setError("");

    try {
      const status = await api(`/trips/${selectedTripId}/share`, { method: "POST" }, getToken);
      setShareStatus(status);
      const [trip, tripsData] = await Promise.all([api(`/trips/${selectedTripId}`, {}, getToken), loadTrips()]);
      setSelectedTrip(trip);
      setTrips(tripsData);
    } catch (err) {
      setError("Could not publish this share page.");
    } finally {
      setShareBusy(false);
    }
  }

  async function unpublishSharePage() {
    if (!selectedTripId || shareBusy) return;

    setShareBusy(true);
    setShareCopied(false);
    setError("");

    try {
      const status = await api(`/trips/${selectedTripId}/share`, { method: "DELETE" }, getToken);
      setShareStatus(status);
      const [trip, tripsData] = await Promise.all([api(`/trips/${selectedTripId}`, {}, getToken), loadTrips()]);
      setSelectedTrip(trip);
      setTrips(tripsData);
    } catch (err) {
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
    } catch (err) {
      setError("Could not copy the share link.");
    }
  }

  function openSharePage() {
    const url = absoluteShareUrl(shareStatus?.share_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (view === "share") {
    return (
      <main className="app">
        <PublicSharePage shareSlug={publicShareSlug} />
      </main>
    );
  }

  if (view === "landing") {
    return (
      <main className="app">
        <LandingPage
          isLoaded={isLoaded}
          isSignedIn={isSignedIn}
          onEnterApp={async () => {
            setLoading(true);
            setError("");
            try {
              await loadTrips();
              setView("dashboard");
            } catch (err) {
              setError("Could not load your private workspace.");
              setView("access");
            } finally {
              setLoading(false);
            }
          }}
        />
      </main>
    );
  }

  if (view === "access") {
    return (
      <main className="app">
        <AccessScreen loading={loading} error={error} onBack={() => setView("landing")} />
      </main>
    );
  }

  return (
    <main className="app">
      {view === "dashboard" ? (
        <TripsDashboard
          trips={trips}
          user={currentUser}
          loading={loading}
          error={error}
          onCreateTrip={createTrip}
          onOpenTrip={loadWorkspace}
          onSignOut={handleSignOut}
        />
      ) : (
        <TripWorkspace
          trip={selectedTrip}
          itineraryDays={itineraryDays}
          tripPlaces={tripPlaces}
          checklistItems={checklistItems}
          agentEvents={agentEvents}
          buildTripStreaming={buildTripStreaming}
          buildTripEvents={buildTripEvents}
          buildTripSummary={buildTripSummary}
          buildTripStatus={buildTripStatus}
          regenerateDayStreaming={regenerateDayStreaming}
          regenerateDayEvents={regenerateDayEvents}
          regenerateDaySummary={regenerateDaySummary}
          regenerateDayStatus={regenerateDayStatus}
          regenerateDayTarget={regenerateDayTarget}
          regenerateInstruction={regenerateInstruction}
          setRegenerateInstruction={setRegenerateInstruction}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          mobileWorkspacePanel={mobileWorkspacePanel}
          setMobileWorkspacePanel={setMobileWorkspacePanel}
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          streaming={streaming}
          loading={loading}
          error={error}
          shareStatus={shareStatus}
          shareBusy={shareBusy}
          shareCopied={shareCopied}
          onPublishShare={publishSharePage}
          onCopyShare={copyShareLink}
          onOpenShare={openSharePage}
          onUnpublishShare={unpublishSharePage}
          onSendMessage={sendChatMessage}
          onBuildTrip={runBuildTrip}
          onOpenRegenerateDay={setRegenerateDayTarget}
          onCloseRegenerateDay={() => {
            if (!regenerateDayStreaming) {
              setRegenerateDayTarget(null);
              setRegenerateInstruction("");
            }
          }}
          onRegenerateDay={runRegenerateDay}
          onUpdateItineraryItem={updateItineraryItem}
          onUpdateTripPlace={updateTripPlace}
          onSignOut={handleSignOut}
          onBack={async () => {
            await loadTrips();
            setView("dashboard");
          }}
        />
      )}
    </main>
  );
}

function LandingPage({ isLoaded, isSignedIn, onEnterApp }) {
  return (
    <section className="landing-page" aria-label="Wayfinder OS public landing page">
      <header className="landing-nav">
        <BrandStamp />
        <div className="header-meta">
          <span className="version-badge">v0.8</span>
          {isLoaded && isSignedIn ? (
            <button className="secondary-action compact" type="button" onClick={onEnterApp}>
              Enter app
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="secondary-action compact" type="button">
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">Travel planning workspace</p>
          <h1>Trips you can shape, edit, and share.</h1>
          <p className="hero-copy">
            Wayfinder OS helps you shape trip ideas into a durable workspace with chat, itinerary days, saved places,
            budgets, checklists, editable regeneration, and read-only share pages.
          </p>
          <div className="landing-actions">
            {isLoaded && isSignedIn ? (
              <button className="primary-action" type="button" onClick={onEnterApp}>
                Enter app
              </button>
            ) : (
              <>
                <SignUpButton mode="modal">
                  <button className="primary-action" type="button">
                    Create account
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button className="secondary-action" type="button">
                    Sign in
                  </button>
                </SignInButton>
              </>
            )}
          </div>
        </div>

        <div className="landing-preview" aria-label="Wayfinder OS interface preview">
          <div className="preview-toolbar">
            <span />
            <span />
            <span />
            <strong>Tokyo in spring</strong>
          </div>
          <div className="preview-grid">
            <div className="preview-chat">
              <span>Wayfinder</span>
              <p>Build a slower day around Meiji Jingu, Harajuku, and one booked dinner.</p>
              <span>You</span>
              <p>Keep the reservation locked and reduce transit.</p>
            </div>
            <div className="preview-itinerary">
              <div>
                <small>Day 2</small>
                <strong>Meiji and Harajuku</strong>
              </div>
              <ul>
                <li>
                  <time>08:30</time>
                  <span>Meiji Jingu morning walk</span>
                </li>
                <li>
                  <time>11:00</time>
                  <span>Nezu Museum and garden</span>
                </li>
                <li>
                  <time>19:30</time>
                  <span>Booked dinner protected</span>
                </li>
              </ul>
            </div>
            <div className="preview-artifacts">
              <strong>Artifacts</strong>
              <span>Places</span>
              <span>Budget</span>
              <span>Checklist</span>
              <span>Share page</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-label="Current capabilities">
        <div className="section-heading plain">
          <div>
            <p className="eyebrow">Current capabilities</p>
            <h2>Built for the current beta</h2>
          </div>
        </div>
        <div className="landing-card-grid">
          {[
            ["Trip workspace", "Open durable trips with itinerary, places, budget, checklist, and activity panels."],
            ["Trip-aware AI chat", "Ask for changes using the saved trip context and prior messages."],
            ["Build My Trip", "Generate structured planning artifacts from the current workspace state."],
            ["Editable regeneration", "Regenerate itinerary days while preserving locked or booked items."],
            ["Persistent trips", "Trips, messages, places, checklist items, and workflow events survive refreshes."],
            ["Share pages", "Publish read-only itinerary pages for travelers to review."],
            ["Private accounts", "Each signed-in user sees only trips owned by their account."],
          ].map(([title, detail]) => (
            <article className="landing-card" key={title}>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-band" aria-label="How Wayfinder OS works">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Sign in, open a private trip, then shape it through chat and structured controls.</h2>
        </div>
        <div className="step-list">
          <div>
            <strong>1</strong>
            <p>Start from your private dashboard.</p>
          </div>
          <div>
            <strong>2</strong>
            <p>Use chat, Build My Trip, and regeneration to refine the plan.</p>
          </div>
          <div>
            <strong>3</strong>
            <p>Publish a read-only share page when the itinerary is ready to review.</p>
          </div>
        </div>
      </section>

      <section className="landing-section beta-limitations" aria-label="Beta limitations">
        <div>
          <p className="eyebrow">Beta limitations</p>
          <h2>Honest status</h2>
        </div>
        <ul>
          <li>Private trip ownership is enforced by the backend.</li>
          <li>Generated plans should be reviewed before booking travel.</li>
          <li>Public share links are read-only and do not expose private chat.</li>
          <li>Billing, credits, payments, and real travel bookings are not live.</li>
        </ul>
      </section>

      <footer className="landing-footer">
        <BrandStamp />
        <span>Wayfinder OS v0.8</span>
      </footer>
    </section>
  );
}

function AccessScreen({ loading, error, onBack }) {
  return (
    <section className="access-screen" aria-label="Wayfinder OS account access">
      <div className="access-card">
        <AppHeader version="v0.8" />
        <p className="eyebrow">Account required</p>
        <h1>Sign in to open your private trip workspace.</h1>
        <p className="hero-copy">Wayfinder OS uses real accounts for private trips and backend-enforced ownership.</p>
        {error && <p className="error">{error}</p>}
        <SignInButton mode="modal">
          <button className="primary-action" type="button" disabled={loading}>
            Sign in
          </button>
        </SignInButton>
        <button className="secondary-action access-back" type="button" onClick={onBack} disabled={loading}>
          Back to landing page
        </button>
      </div>
    </section>
  );
}

function TripsDashboard({ trips, user, loading, error, onCreateTrip, onOpenTrip, onSignOut }) {
  const activeBudget = useMemo(
    () => trips.reduce((sum, trip) => sum + Number(trip.budget_amount || 0), 0),
    [trips],
  );

  return (
    <section className="dashboard" aria-label="Wayfinder OS trips dashboard">
      <AppHeader user={user} onSignOut={onSignOut} />

      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Trip control center</p>
          <h1>Plan, shape, and track every trip in one workspace.</h1>
          <p className="hero-copy">
            Wayfinder OS v0.8 adds real accounts, private trips, and backend-enforced ownership.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onCreateTrip} disabled={loading}>
          <span aria-hidden="true">+</span>
          Plan a new trip
        </button>
      </div>

      {error && <p className="error dashboard-error">{error}</p>}

      <section className="metric-grid" aria-label="Account usage summary">
        <MetricCard label="Workspace" value="Private" detail="Authenticated account" />
        <MetricCard label="Durable trips" value={trips.length} detail="Loaded from PostgreSQL" />
        <MetricCard label="Agent runs" value="Beta" detail="Lightweight events only" />
        <MetricCard label="Active budget" value={formatBudget(activeBudget)} detail="Across saved trips" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Your trips</h2>
              <p>Plans, readiness, places, and next actions from the backend.</p>
            </div>
          </div>

          <div className="trip-list">
            {trips.map((trip, index) => (
              <button className="trip-row" key={trip.id} type="button" onClick={() => onOpenTrip(trip.id)}>
                <span className={`trip-marker ${index % 2 === 0 ? "blue" : "green"}`} aria-hidden="true">
                  {trip.destination.slice(0, 1)}
                </span>
                <span className="trip-main">
                  <span className="trip-title-line">
                    <strong>{trip.title}</strong>
                    <StatusPill>{trip.status}</StatusPill>
                  </span>
                  <span>
                    {trip.destination} · {formatDateRange(trip)}
                  </span>
                  <span className="next-action">Saved: {formatDate(trip.updated_at.slice(0, 10))}</span>
                </span>
                <span className="trip-readiness">
                  <span>
                    <span>Trip readiness</span>
                    <strong>{trip.progress}%</strong>
                  </span>
                  <ProgressBar value={trip.progress} />
                </span>
                <span className="trip-stats">
                  <strong>{formatBudget(trip.budget_amount)}</strong>
                  <span>Private workspace</span>
                </span>
                <span className="trip-open-indicator">Open workspace</span>
              </button>
            ))}

            {!trips.length && (
              <div className="empty-state">
                <strong>No trips yet</strong>
                <p>Create your first durable trip for this account.</p>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-side">
          <AgentActivityFeed />
          <div className="agent-callout">
            <p className="eyebrow">Suggested next</p>
            <h2>Open a saved trip</h2>
            <p>Chat, itinerary toggles, and place status changes now survive refreshes.</p>
            <button type="button" onClick={() => trips[0] && onOpenTrip(trips[0].id)} disabled={!trips.length}>
              Review workspace
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function TripWorkspace({
  trip,
  itineraryDays,
  tripPlaces,
  checklistItems,
  agentEvents,
  buildTripStreaming,
  buildTripEvents,
  buildTripSummary,
  buildTripStatus,
  regenerateDayStreaming,
  regenerateDayEvents,
  regenerateDaySummary,
  regenerateDayStatus,
  regenerateDayTarget,
  regenerateInstruction,
  setRegenerateInstruction,
  activePanel,
  setActivePanel,
  mobileWorkspacePanel,
  setMobileWorkspacePanel,
  messages,
  chatInput,
  setChatInput,
  streaming,
  loading,
  error,
  shareStatus,
  shareBusy,
  shareCopied,
  onPublishShare,
  onCopyShare,
  onOpenShare,
  onUnpublishShare,
  onSendMessage,
  onBuildTrip,
  onOpenRegenerateDay,
  onCloseRegenerateDay,
  onRegenerateDay,
  onUpdateItineraryItem,
  onUpdateTripPlace,
  onSignOut,
  onBack,
}) {
  if (!trip) return null;

  function selectMobilePanel(panel) {
    setMobileWorkspacePanel(panel);
    if (["places", "budget", "tasks", "activity"].includes(panel)) {
      setActivePanel(panel);
    }
  }

  return (
    <section className="workspace-view" aria-label={`${trip.title} workspace`}>
      <header className="workspace-header">
        <div className="workspace-title">
          <button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">
            ←
          </button>
          <div>
            <div className="title-line">
              <h1>{trip.title}</h1>
              <StatusPill>{trip.status}</StatusPill>
            </div>
            <p>
              {formatDateRange(trip)} · {trip.destination} · saved to your private workspace
            </p>
          </div>
        </div>
        <div className="workspace-actions">
          <span className="credits-pill">Private</span>
          <ShareControls
            shareStatus={shareStatus}
            shareBusy={shareBusy}
            shareCopied={shareCopied}
            onPublishShare={onPublishShare}
            onCopyShare={onCopyShare}
            onOpenShare={onOpenShare}
            onUnpublishShare={onUnpublishShare}
          />
          <button className="secondary-action compact" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error workspace-error">{error}</p>}

      <nav className="workspace-mobile-tabs" aria-label="Workspace panels">
        {WORKSPACE_MOBILE_TABS.map((tab) => (
          <button
            className={mobileWorkspacePanel === tab ? "active" : ""}
            type="button"
            key={tab}
            onClick={() => selectMobilePanel(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="workspace-grid">
        <div className={`workspace-panel-slot ${mobileWorkspacePanel === "chat" ? "mobile-active" : ""}`}>
          <ChatPanel
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            streaming={streaming}
            error=""
            onSendMessage={onSendMessage}
          />
        </div>

        <div className={`workspace-panel-slot ${mobileWorkspacePanel === "itinerary" ? "mobile-active" : ""}`}>
          <ItineraryTimeline
            trip={trip}
            itineraryDays={itineraryDays}
            loading={loading}
            buildTripStreaming={buildTripStreaming}
            buildTripEvents={buildTripEvents}
            buildTripSummary={buildTripSummary}
            buildTripStatus={buildTripStatus}
            regenerateDayStreaming={regenerateDayStreaming}
            regenerateDayEvents={regenerateDayEvents}
            regenerateDaySummary={regenerateDaySummary}
            regenerateDayStatus={regenerateDayStatus}
            regenerateDayTarget={regenerateDayTarget}
            regenerateInstruction={regenerateInstruction}
            setRegenerateInstruction={setRegenerateInstruction}
            onBuildTrip={onBuildTrip}
            onOpenRegenerateDay={onOpenRegenerateDay}
            onCloseRegenerateDay={onCloseRegenerateDay}
            onRegenerateDay={onRegenerateDay}
            onUpdateItineraryItem={onUpdateItineraryItem}
          />
        </div>

        <div className={`workspace-panel-slot ${["places", "budget", "tasks", "activity"].includes(mobileWorkspacePanel) ? "mobile-active" : ""}`}>
          <ArtifactPanel
            activePanel={activePanel}
            setActivePanel={(panel) => {
              setActivePanel(panel);
              setMobileWorkspacePanel(panel);
            }}
            trip={trip}
            tripPlaces={tripPlaces}
            checklistItems={checklistItems}
            agentEvents={agentEvents}
            onUpdateTripPlace={onUpdateTripPlace}
          />
        </div>
      </div>
    </section>
  );
}

function ShareControls({
  shareStatus,
  shareBusy,
  shareCopied,
  onPublishShare,
  onCopyShare,
  onOpenShare,
  onUnpublishShare,
}) {
  if (!shareStatus?.share_enabled) {
    return (
      <button className="secondary-action" type="button" onClick={onPublishShare} disabled={shareBusy}>
        {shareBusy ? "Publishing..." : "Publish share page"}
      </button>
    );
  }

  return (
    <div className="share-controls">
      <button className="secondary-action compact" type="button" onClick={onCopyShare} disabled={shareBusy}>
        {shareCopied ? "Copied" : "Copy link"}
      </button>
      <button className="secondary-action compact" type="button" onClick={onOpenShare} disabled={shareBusy}>
        Open
      </button>
      <button className="secondary-action compact danger" type="button" onClick={onUnpublishShare} disabled={shareBusy}>
        {shareBusy ? "Unpublishing..." : "Unpublish"}
      </button>
    </div>
  );
}

function PublicSharePage({ shareSlug }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicTrip() {
      setLoading(true);
      setUnavailable(false);

      try {
        const res = await fetch(`${API_URL}/public/trips/${encodeURIComponent(shareSlug)}`);
        if (res.status === 404) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) setTrip(data);
      } catch (err) {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPublicTrip();
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  if (loading) {
    return (
      <section className="share-page share-centered" aria-label="Loading shared trip">
        <BrandStamp />
        <p className="eyebrow">Shared itinerary</p>
        <h1>Loading trip page...</h1>
      </section>
    );
  }

  if (unavailable || !trip) {
    return (
      <section className="share-page share-centered" aria-label="Unavailable shared trip">
        <BrandStamp />
        <p className="eyebrow">Shared itinerary</p>
        <h1>This trip page is unavailable.</h1>
        <p className="hero-copy">The link may have been unpublished or may no longer exist.</p>
      </section>
    );
  }

  const budget = trip.budget;
  const totalBudget = budget?.total_estimate || trip.budget_amount;
  const totalItems = trip.itinerary_days.reduce((sum, day) => sum + day.items.length, 0);
  const visiblePlaces = trip.places.filter((place) => place.status !== "skipped");
  const openChecklist = trip.checklist_items.filter((item) => !item.is_completed).length;

  return (
    <section className="share-page" aria-label={`${trip.title} shared itinerary`}>
      <header className="share-topbar">
        <BrandStamp />
        <span className="version-badge">Read-only share page</span>
      </header>

      <article className="share-packet">
        <section className="share-hero">
          <div>
            <p className="eyebrow">{trip.destination}</p>
            <h1>{trip.title}</h1>
            <p className="share-meta">
              {formatDateRange(trip)} · {trip.status} · Last updated {formatDate(trip.updated_at.slice(0, 10))}
            </p>
            {trip.summary && <p className="share-summary">{trip.summary}</p>}
          </div>
          <div className="share-metrics" aria-label="Trip summary">
            <MetricCard label="Readiness" value={`${trip.progress}%`} detail="Planning status" />
            <MetricCard label="Places" value={visiblePlaces.length} detail="Saved recommendations" />
            <MetricCard label="Plan items" value={totalItems} detail="Across itinerary days" />
            <MetricCard label="Budget" value={formatBudget(totalBudget, budget?.currency || "USD")} detail="Estimate" />
          </div>
        </section>

        <div className="share-layout">
          <section className="share-main">
            <ShareSectionTitle title="Itinerary" sub={`${trip.itinerary_days.length} days planned`} />
            <div className="share-days">
              {trip.itinerary_days.map((day) => (
                <article className="share-day" key={`day-${day.day_number}`}>
                  <header>
                    <span className="day-number">
                      <small>Day</small>
                      <strong>{day.day_number}</strong>
                    </span>
                    <div>
                      <h2>{day.title || `Day ${day.day_number}`}</h2>
                      <p>
                        {formatDayDate(day.date)} · {day.summary || "Details still being shaped"}
                      </p>
                    </div>
                  </header>
                  <div className="share-timeline">
                    {day.items.map((item, index) => (
                      <div className="share-timeline-item" key={`${day.day_number}-${item.title}-${index}`}>
                        <time>{formatTime(item.start_time)}</time>
                        <span className="type-chip">{item.category || "Plan"}</span>
                        <div>
                          <strong>
                            {item.title}
                            {item.is_booked && <span> · Booked</span>}
                          </strong>
                          {item.description && <p>{item.description}</p>}
                        </div>
                      </div>
                    ))}
                    {!day.items.length && <p className="empty-inline">No items saved for this day yet.</p>}
                  </div>
                </article>
              ))}
              {!trip.itinerary_days.length && (
                <div className="empty-state">
                  <strong>No itinerary has been published yet</strong>
                  <p>The trip exists, but it does not have saved itinerary days.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="share-side">
            <section className="share-side-section">
              <ShareSectionTitle title="Places" sub={`${visiblePlaces.length} saved`} />
              <div className="share-place-list">
                {visiblePlaces.map((place, index) => (
                  <div className="share-place" key={`${place.name}-${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{place.name}</strong>
                      <p>
                        {place.category || "Place"} · {place.notes || place.city || place.country || "Saved for review"}
                      </p>
                    </div>
                  </div>
                ))}
                {!visiblePlaces.length && <p className="empty-inline">No places saved yet.</p>}
              </div>
            </section>

            <section className="share-side-section">
              <ShareSectionTitle
                title="Budget"
                sub={totalBudget ? formatBudget(totalBudget, budget?.currency || "USD") : "Estimate pending"}
              />
              <div className="budget-list">
                {(budget?.categories || []).map((category) => (
                  <div className="budget-row" key={category.name}>
                    <span>{category.name}</span>
                    <strong>{formatBudget(category.amount, budget.currency)}</strong>
                  </div>
                ))}
                {!budget?.categories?.length && <p className="empty-inline">No category estimate yet.</p>}
              </div>
              {budget?.notes?.map((note) => (
                <p className="budget-note" key={note}>
                  {note}
                </p>
              ))}
            </section>

            <section className="share-side-section">
              <ShareSectionTitle title="Checklist" sub={`${openChecklist} open`} />
              {trip.checklist_items.map((item, index) => (
                <div className="share-task" key={`${item.title}-${index}`}>
                  <span aria-hidden="true">{item.is_completed ? "✓" : ""}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.due_label || formatStatus(item.priority || "medium")}</p>
                  </div>
                </div>
              ))}
              {!trip.checklist_items.length && <p className="empty-inline">No checklist items yet.</p>}
            </section>

            {!!(trip.assumptions.length || trip.warnings.length) && (
              <section className="share-side-section">
                <ShareSectionTitle title="Notes" sub="Assumptions and warnings" />
                {[...trip.assumptions, ...trip.warnings].map((note, index) => (
                  <p className="share-note" key={`${note}-${index}`}>
                    {note}
                  </p>
                ))}
              </section>
            )}
          </aside>
        </div>

        <footer className="share-footer">
          <span>Planned with Wayfinder OS</span>
          <span>{trip.generated_at ? `Generated ${formatDate(trip.generated_at.slice(0, 10))}` : "Live trip artifact"}</span>
        </footer>
      </article>
    </section>
  );
}

function BrandStamp() {
  return (
    <div className="brand-lockup" aria-label="Wayfinder OS">
      <span className="brand-mark" aria-hidden="true" />
      <div>
        <p className="brand-name">Wayfinder</p>
        <p className="brand-subtitle">OS</p>
      </div>
    </div>
  );
}

function ShareSectionTitle({ title, sub }) {
  return (
    <div className="share-section-title">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

function AppHeader({ user, version = "v0.8", onSignOut }) {
  return (
    <header className="app-header">
      <BrandStamp />
      <div className="header-meta">
        {user && <span className="version-badge">{user.display_name}</span>}
        <span className="version-badge">{version}</span>
        {user && (
          <>
            <button className="secondary-action compact" type="button" onClick={onSignOut}>
              Sign out
            </button>
            <UserButton afterSignOutUrl="/" />
          </>
        )}
      </div>
    </header>
  );
}

function ChatPanel({ messages, chatInput, setChatInput, streaming, error, onSendMessage }) {
  return (
    <aside className="chat-panel">
      <div className="panel-header">
        <div>
          <h2>Trip-aware assistant</h2>
          <p>Using this trip's itinerary, places, budget, and chat history.</p>
        </div>
        {streaming && <span className="streaming-pill">Streaming</span>}
      </div>

      <div className="message-list" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={message.id || `${message.role}-${index}`}>
            <span>{message.role === "user" ? "You" : "Wayfinder"}</span>
            <p>{message.text || "Preparing the first notes..."}</p>
          </div>
        ))}
        {error && <p className="error">{error}</p>}
      </div>

      <form className="chat-composer" onSubmit={onSendMessage}>
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask Wayfinder to adjust the itinerary, compare areas, or audit the budget..."
          disabled={streaming}
        />
        <div className="composer-row">
          <p>Context: itinerary, places, budget, and prior messages.</p>
          <button className="primary-action compact" type="submit" disabled={streaming || !chatInput.trim()}>
            {streaming ? "Planning..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}

function ItineraryTimeline({
  trip,
  itineraryDays,
  loading,
  buildTripStreaming,
  buildTripEvents,
  buildTripSummary,
  buildTripStatus,
  regenerateDayStreaming,
  regenerateDayEvents,
  regenerateDaySummary,
  regenerateDayStatus,
  regenerateDayTarget,
  regenerateInstruction,
  setRegenerateInstruction,
  onBuildTrip,
  onOpenRegenerateDay,
  onCloseRegenerateDay,
  onRegenerateDay,
  onUpdateItineraryItem,
}) {
  const workflowBusy = buildTripStreaming || regenerateDayStreaming || loading;

  return (
    <section className="itinerary-panel">
      <div className="panel-header sticky-panel-header">
        <div>
          <h2>Itinerary</h2>
          <p>
            {trip.progress}% ready · {itineraryDays.length} saved days · item toggles persist
          </p>
        </div>
        <button className="secondary-action" type="button" disabled>
          {formatDateRange(trip)}
        </button>
      </div>

      <div className="workflow-strip" aria-label="Agent workflow concepts">
        <button className="build-trip-button" type="button" onClick={onBuildTrip} disabled={workflowBusy}>
          {buildTripStreaming ? "Building trip..." : "Build My Trip"}
        </button>
        {WORKFLOWS.map((workflow) => (
          <button type="button" key={workflow} disabled>
            {workflow}
          </button>
        ))}
      </div>

      {(buildTripStreaming || buildTripEvents.length > 0 || buildTripSummary) && (
        <WorkflowProgress
          events={buildTripEvents}
          streaming={buildTripStreaming}
          summary={buildTripSummary}
          status={buildTripStatus}
          activeTitle="Build My Trip is updating this workspace"
          completeTitle="Build My Trip completed"
          failedTitle="Build My Trip failed"
        />
      )}

      {(regenerateDayStreaming || regenerateDayEvents.length > 0 || regenerateDaySummary) && (
        <WorkflowProgress
          events={regenerateDayEvents}
          streaming={regenerateDayStreaming}
          summary={regenerateDaySummary}
          status={regenerateDayStatus}
          activeTitle="Wayfinder is regenerating this day"
          completeTitle="Day regeneration completed"
          failedTitle="Day regeneration failed"
        />
      )}

      <div className="timeline">
        {itineraryDays.map((day) => (
          <article className="day-card" key={day.id}>
            <header>
              <span className="day-number">
                <small>Day</small>
                <strong>{day.day_number}</strong>
              </span>
              <div>
                <h3>{day.title || `Day ${day.day_number}`}</h3>
                <p>
                  {formatDayDate(day.date)} · {day.summary || "No summary yet"}
                </p>
              </div>
              <div className="day-actions">
                <StatusPill>{day.items.length} items</StatusPill>
                <button
                  className="secondary-action compact"
                  type="button"
                  onClick={() => onOpenRegenerateDay(day)}
                  disabled={workflowBusy}
                >
                  Regenerate
                </button>
              </div>
            </header>
            <div className="timeline-items">
              {day.items.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <time>{formatTime(item.start_time)}</time>
                  <span className="type-chip">{item.category || "Plan"}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description || "No notes yet"}</p>
                  </div>
                  <div className="item-toggles">
                    <label>
                      <input
                        type="checkbox"
                        checked={item.is_locked}
                        disabled={loading}
                        aria-label={`${item.is_locked ? "Unlock" : "Lock"} ${item.title}`}
                        onChange={(e) => onUpdateItineraryItem(item.id, { is_locked: e.target.checked })}
                      />
                      {item.is_locked ? "Locked" : "Lock"}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.is_booked}
                        disabled={loading}
                        aria-label={`${item.is_booked ? "Unmark booked" : "Mark booked"} ${item.title}`}
                        onChange={(e) => onUpdateItineraryItem(item.id, { is_booked: e.target.checked })}
                      />
                      {item.is_booked ? "Booked" : "Mark booked"}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}

        {!itineraryDays.length && (
          <div className="empty-state">
            <strong>No itinerary yet</strong>
            <p>Add days through the API or seed data, then this workspace will render them here.</p>
          </div>
        )}
      </div>

      {regenerateDayTarget && (
        <RegenerateDayDialog
          day={regenerateDayTarget}
          instruction={regenerateInstruction}
          setInstruction={setRegenerateInstruction}
          streaming={regenerateDayStreaming}
          onClose={onCloseRegenerateDay}
          onSubmit={onRegenerateDay}
        />
      )}
    </section>
  );
}

function formatEventName(value) {
  if (!value) return "Agent event";
  return value
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ");
}

function formatEventDetail(payload) {
  if (!payload || !Object.keys(payload).length) return "";
  return Object.entries(payload)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
    .join(" · ");
}

function WorkflowProgress({ events, streaming, summary, status, activeTitle, completeTitle, failedTitle }) {
  const title = status === "failed" ? failedTitle : streaming ? activeTitle : completeTitle;

  return (
    <div className="build-trip-progress" aria-live="polite">
      <div>
        <strong>{title}</strong>
        <p>Progress is loaded from durable workflow events saved with this trip.</p>
      </div>
      <div className="build-event-list">
        {events.slice(-6).map((event, index) => (
          <div className="build-event-row" key={`${event.event}-${index}`}>
            <span className="activity-dot active" />
            <span>
              <strong>{formatEventName(event.event)}</strong>
              {formatEventDetail(event.payload) && <small>{formatEventDetail(event.payload)}</small>}
            </span>
          </div>
        ))}
      </div>
      {summary && <p className="build-summary">{summary}</p>}
    </div>
  );
}

function RegenerateDayDialog({ day, instruction, setInstruction, streaming, onClose, onSubmit }) {
  const protectedCount = day.items.filter((item) => item.is_locked || item.is_booked).length;
  const editableCount = day.items.length - protectedCount;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="regenerate-day-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Editable regeneration</p>
            <h2 id="regenerate-day-title">Regenerate Day {day.day_number}</h2>
            <p>
              {protectedCount} locked/booked preserved · {editableCount} unlocked can change
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={streaming} aria-label="Close">
            ×
          </button>
        </div>

        <form className="regenerate-form" onSubmit={onSubmit}>
          <label htmlFor="regenerate-instruction">What should Wayfinder change?</label>
          <textarea
            id="regenerate-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Make this day more relaxed and avoid taxis."
            disabled={streaming}
            autoFocus
          />
          <p>Locked or booked items are protected. Wayfinder will only replace unlocked items in this day.</p>
          <div className="modal-actions">
            <button className="secondary-action" type="button" onClick={onClose} disabled={streaming}>
              Cancel
            </button>
            <button className="primary-action compact" type="submit" disabled={streaming || !instruction.trim()}>
              {streaming ? "Regenerating..." : "Regenerate day"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ArtifactPanel({ activePanel, setActivePanel, trip, tripPlaces, checklistItems, agentEvents, onUpdateTripPlace }) {
  const tabs = ["places", "budget", "tasks", "activity"];

  return (
    <aside className="artifact-panel">
      <div className="tabs" role="tablist" aria-label="Trip artifact panels">
        {tabs.map((tab) => (
          <button className={activePanel === tab ? "active" : ""} type="button" key={tab} onClick={() => setActivePanel(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activePanel === "places" && <PlacesPanel tripPlaces={tripPlaces} onUpdateTripPlace={onUpdateTripPlace} />}
      {activePanel === "budget" && <BudgetPanel trip={trip} />}
      {activePanel === "tasks" && <TasksPanel checklistItems={checklistItems} />}
      {activePanel === "activity" && <AgentActivityFeed activities={agentEvents} />}
    </aside>
  );
}

function PlacesPanel({ tripPlaces, onUpdateTripPlace }) {
  return (
    <div className="artifact-content">
      <PanelTitle title="Place board" sub="Suggested, interested, booked, and skipped places." />
      {tripPlaces.map((tripPlace, index) => (
        <div className="place-row" key={tripPlace.id}>
          <span>{index + 1}</span>
          <div>
            <strong>{tripPlace.place.name}</strong>
            <p>
              {tripPlace.place.category || "Place"} · {tripPlace.notes || tripPlace.place.city || "No notes yet"}
            </p>
          </div>
          <select
            className="status-select"
            value={tripPlace.status}
            onChange={(e) => onUpdateTripPlace(tripPlace.id, { status: e.target.value })}
            aria-label={`Status for ${tripPlace.place.name}`}
          >
            {PLACE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
      ))}

      {!tripPlaces.length && (
        <div className="empty-state compact">
          <strong>No places yet</strong>
          <p>Add a place through the API to start the board.</p>
        </div>
      )}
    </div>
  );
}

function BudgetPanel({ trip }) {
  const budget = trip?.planning_context?.build_trip?.budget;
  const currency = budget?.currency || "USD";
  const rows = budget?.categories?.length
    ? budget.categories.map((category) => [
        category.name,
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(Number(category.amount || 0)),
        "Estimate",
      ])
    : [
        ["Flights", "TBD", "Estimate"],
        ["Stays", "TBD", "Estimate"],
        ["Food", "TBD", "Estimate"],
        ["Transit", "TBD", "Estimate"],
        ["Activities", "TBD", "Estimate"],
      ];

  return (
    <div className="artifact-content">
      <PanelTitle
        title="Budget forecast"
        sub={
          budget?.total_estimate
            ? `Build My Trip estimated ${formatBudget(budget.total_estimate, currency)}.`
            : "Build My Trip will persist category estimates here."
        }
      />
      <ProgressBar value={budget?.total_estimate ? 72 : 24} />
      <div className="budget-list">
        {rows.map(([label, value, share]) => (
          <div className="budget-row" key={label}>
            <span>{label}</span>
            <strong>
              {value} <small>{share}</small>
            </strong>
          </div>
        ))}
      </div>
      {budget?.notes?.map((note) => (
        <p className="budget-note" key={note}>
          {note}
        </p>
      ))}
    </div>
  );
}

function TasksPanel({ checklistItems }) {
  return (
    <div className="artifact-content">
      <PanelTitle title="Booking checklist" sub="Generated checklist items persist with the trip." />
      {checklistItems.map((task) => (
        <label className="task-row" key={task.id}>
          <input type="checkbox" checked={task.is_completed} readOnly />
          <span>
            <strong>{task.title}</strong>
            <small>{task.due_label || "No due label"}</small>
          </span>
          <StatusPill>{formatStatus(task.priority || "medium")}</StatusPill>
        </label>
      ))}

      {!checklistItems.length && (
        <div className="empty-state compact">
          <strong>No checklist yet</strong>
          <p>Run Build My Trip to generate booking and preparation tasks.</p>
        </div>
      )}
    </div>
  );
}

function AgentActivityFeed({ activities = FALLBACK_ACTIVITIES }) {
  const rows = activities.length
    ? activities.map((activity) => ({
        workflow: activity.title || activity.workflow || formatEventName(activity.event_type),
        detail: activity.detail || formatEventDetail(activity.payload),
        time: activity.created_at ? formatDate(activity.created_at.slice(0, 10)) : activity.time,
        status: activity.status || "active",
      }))
    : FALLBACK_ACTIVITIES;

  return (
    <div className="panel activity-panel">
      <div className="section-heading compact-heading">
        <div>
          <h2>Agent activity</h2>
          <p>Durable workflow events saved with this trip.</p>
        </div>
      </div>
      {rows.map((activity, index) => (
        <div className="activity-row" key={`${activity.workflow}-${index}`}>
          <span className={`activity-dot ${activity.status.toLowerCase()}`} />
          <div>
            <strong>{activity.workflow}</strong>
            <p>{activity.detail}</p>
          </div>
          <time>{activity.time || `#${index + 1}`}</time>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, detail, progress }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      {typeof progress === "number" && <ProgressBar value={progress} />}
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <span className="progress-bar" aria-label={`${value}%`}>
      <span style={{ width: `${value}%` }} />
    </span>
  );
}

function PanelTitle({ title, sub }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

function StatusPill({ children }) {
  return <span className="status-pill">{children}</span>;
}
