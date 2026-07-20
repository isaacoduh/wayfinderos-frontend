import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const BETA_USER_KEY = "wayfinder_beta_user_id";

const WORKFLOWS = ["Optimize itinerary", "Find alternatives", "Budget audit", "Booking readiness"];
const PLACE_STATUSES = ["suggested", "interested", "booked", "skipped"];

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

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
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

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("access");
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [activePanel, setActivePanel] = useState("places");
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
  const [regenerateDayStreaming, setRegenerateDayStreaming] = useState(false);
  const [regenerateDayEvents, setRegenerateDayEvents] = useState([]);
  const [regenerateDaySummary, setRegenerateDaySummary] = useState("");
  const [regenerateDayTarget, setRegenerateDayTarget] = useState(null);
  const [regenerateInstruction, setRegenerateInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedTripId = selectedTrip?.id;

  const loadTrips = useCallback(async () => {
    const data = await api("/trips");
    setTrips(data);
    return data;
  }, []);

  const loadWorkspace = useCallback(async (tripId) => {
    setLoading(true);
    setError("");

    try {
      const [trip, savedMessages, itinerary, places, checklist, events] = await Promise.all([
        api(`/trips/${tripId}`),
        api(`/trips/${tripId}/messages`),
        api(`/trips/${tripId}/itinerary`),
        api(`/trips/${tripId}/places`),
        api(`/trips/${tripId}/checklist`),
        api(`/trips/${tripId}/agent-events`),
      ]);

      setSelectedTrip(trip);
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
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(BETA_USER_KEY)) return;

    let cancelled = false;
    async function restoreSession() {
      setLoading(true);
      try {
        const session = await api("/dev/session");
        if (cancelled) return;

        setUser(session);
        await loadTrips();
        if (!cancelled) setView("dashboard");
      } catch (err) {
        localStorage.removeItem(BETA_USER_KEY);
        if (!cancelled) setView("access");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [loadTrips]);

  async function continueAsBetaTester() {
    setLoading(true);
    setError("");

    try {
      const betaUser = await api("/dev/login", { method: "POST" });
      localStorage.setItem(BETA_USER_KEY, betaUser.id);
      setUser(betaUser);
      await loadTrips();
      setView("dashboard");
    } catch (err) {
      setError("Could not enter the shared beta workspace.");
    } finally {
      setLoading(false);
    }
  }

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
      });
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
        headers: { "Content-Type": "application/json" },
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
            const savedMessages = await api(`/trips/${selectedTripId}/messages`);
            setMessages(savedMessages.map((message) => ({ ...message, text: message.content })));
          }
        }
      }

      if (streamFailed) {
        const savedMessages = await api(`/trips/${selectedTripId}/messages`);
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
    setActivePanel("activity");

    let summary = "";

    try {
      const res = await fetch(`${API_URL}/trips/${selectedTripId}/agent/build-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

          if (event.type === "agent_event") {
            setBuildTripEvents((current) => [
              ...current,
              {
                event: event.event,
                payload: event.payload || {},
              },
            ]);
          }

          if (event.type === "delta") {
            summary += event.text;
            setBuildTripSummary(summary);
          }

          if (event.type === "error") {
            setError(event.message || "Build My Trip failed. Please try again.");
          }

          if (event.type === "done") {
            await loadWorkspace(selectedTripId);
          }
        }
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
    setActivePanel("activity");

    let summary = "";

    try {
      const res = await fetch(`${API_URL}/trips/${selectedTripId}/agent/regenerate-day/${regenerateDayTarget.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
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

          if (event.type === "agent_event") {
            setRegenerateDayEvents((current) => [
              ...current,
              {
                event: event.event,
                payload: event.payload || {},
              },
            ]);
          }

          if (event.type === "delta") {
            summary += event.text;
            setRegenerateDaySummary(summary);
          }

          if (event.type === "error") {
            setError(event.message || "Day regeneration failed. Please try again.");
          }

          if (event.type === "done") {
            await loadWorkspace(selectedTripId);
            setRegenerateDayTarget(null);
            setRegenerateInstruction("");
          }
        }
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
      });

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
      });
      setTripPlaces((places) => places.map((place) => (place.id === tripPlaceId ? updated : place)));
    } catch (err) {
      setTripPlaces(previous);
      setError("Could not save place status.");
    }
  }

  if (view === "access") {
    return (
      <main className="app">
        <AccessScreen loading={loading} error={error} onContinue={continueAsBetaTester} />
      </main>
    );
  }

  return (
    <main className="app">
      {view === "dashboard" ? (
        <TripsDashboard
          trips={trips}
          user={user}
          loading={loading}
          error={error}
          onCreateTrip={createTrip}
          onOpenTrip={loadWorkspace}
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
          regenerateDayStreaming={regenerateDayStreaming}
          regenerateDayEvents={regenerateDayEvents}
          regenerateDaySummary={regenerateDaySummary}
          regenerateDayTarget={regenerateDayTarget}
          regenerateInstruction={regenerateInstruction}
          setRegenerateInstruction={setRegenerateInstruction}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          streaming={streaming}
          loading={loading}
          error={error}
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
          onBack={async () => {
            await loadTrips();
            setView("dashboard");
          }}
        />
      )}
    </main>
  );
}

function AccessScreen({ loading, error, onContinue }) {
  return (
    <section className="access-screen" aria-label="Wayfinder OS beta access">
      <div className="access-card">
        <AppHeader />
        <p className="eyebrow">Shared beta workspace</p>
        <h1>Continue into durable trip state.</h1>
        <p className="hero-copy">
          This beta uses one shared tester account. Trips, chat messages, itinerary changes, and place statuses are saved
          to the same workspace for everyone using this build.
        </p>
        {error && <p className="error">{error}</p>}
        <button className="primary-action" type="button" onClick={onContinue} disabled={loading}>
          {loading ? "Opening workspace..." : "Continue as beta tester"}
        </button>
      </div>
    </section>
  );
}

function TripsDashboard({ trips, user, loading, error, onCreateTrip, onOpenTrip }) {
  const activeBudget = useMemo(
    () => trips.reduce((sum, trip) => sum + Number(trip.budget_amount || 0), 0),
    [trips],
  );

  return (
    <section className="dashboard" aria-label="Wayfinder OS trips dashboard">
      <AppHeader user={user} />

      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Trip control center</p>
          <h1>Plan, shape, and track every trip in one workspace.</h1>
          <p className="hero-copy">
            Wayfinder OS v0.5 saves trips, protects locked details, and regenerates editable itinerary sections.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onCreateTrip} disabled={loading}>
          <span aria-hidden="true">+</span>
          Plan a new trip
        </button>
      </div>

      {error && <p className="error dashboard-error">{error}</p>}

      <section className="metric-grid" aria-label="Account usage summary">
        <MetricCard label="Workspace" value="Shared beta" detail="No private accounts yet" />
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
                  <span>Shared beta workspace</span>
                </span>
              </button>
            ))}

            {!trips.length && (
              <div className="empty-state">
                <strong>No trips yet</strong>
                <p>Create the first durable trip for this shared beta workspace.</p>
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
  regenerateDayStreaming,
  regenerateDayEvents,
  regenerateDaySummary,
  regenerateDayTarget,
  regenerateInstruction,
  setRegenerateInstruction,
  activePanel,
  setActivePanel,
  messages,
  chatInput,
  setChatInput,
  streaming,
  loading,
  error,
  onSendMessage,
  onBuildTrip,
  onOpenRegenerateDay,
  onCloseRegenerateDay,
  onRegenerateDay,
  onUpdateItineraryItem,
  onUpdateTripPlace,
  onBack,
}) {
  if (!trip) return null;

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
              {formatDateRange(trip)} · {trip.destination} · saved to shared beta workspace
            </p>
          </div>
        </div>
        <div className="workspace-actions">
          <span className="credits-pill">Shared beta</span>
          <button className="secondary-action" type="button" disabled>
            Share preview
          </button>
        </div>
      </header>

      {error && <p className="error workspace-error">{error}</p>}

      <div className="workspace-grid">
        <ChatPanel
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          streaming={streaming}
          error=""
          onSendMessage={onSendMessage}
        />

        <ItineraryTimeline
          trip={trip}
          itineraryDays={itineraryDays}
          loading={loading}
          buildTripStreaming={buildTripStreaming}
          buildTripEvents={buildTripEvents}
          buildTripSummary={buildTripSummary}
          regenerateDayStreaming={regenerateDayStreaming}
          regenerateDayEvents={regenerateDayEvents}
          regenerateDaySummary={regenerateDaySummary}
          regenerateDayTarget={regenerateDayTarget}
          regenerateInstruction={regenerateInstruction}
          setRegenerateInstruction={setRegenerateInstruction}
          onBuildTrip={onBuildTrip}
          onOpenRegenerateDay={onOpenRegenerateDay}
          onCloseRegenerateDay={onCloseRegenerateDay}
          onRegenerateDay={onRegenerateDay}
          onUpdateItineraryItem={onUpdateItineraryItem}
        />

        <ArtifactPanel
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          trip={trip}
          tripPlaces={tripPlaces}
          checklistItems={checklistItems}
          agentEvents={agentEvents}
          onUpdateTripPlace={onUpdateTripPlace}
        />
      </div>
    </section>
  );
}

function AppHeader({ user }) {
  return (
    <header className="app-header">
      <div className="brand-lockup" aria-label="Wayfinder OS">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <p className="brand-name">Wayfinder</p>
          <p className="brand-subtitle">OS</p>
        </div>
      </div>
      <div className="header-meta">
        {user && <span className="version-badge">{user.display_name}</span>}
        <span className="version-badge">v0.5</span>
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
  regenerateDayStreaming,
  regenerateDayEvents,
  regenerateDaySummary,
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
          activeTitle="Build My Trip is updating this workspace"
          completeTitle="Build My Trip completed"
        />
      )}

      {(regenerateDayStreaming || regenerateDayEvents.length > 0 || regenerateDaySummary) && (
        <WorkflowProgress
          events={regenerateDayEvents}
          streaming={regenerateDayStreaming}
          summary={regenerateDaySummary}
          activeTitle="Wayfinder is regenerating this day"
          completeTitle="Day regeneration completed"
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

function WorkflowProgress({ events, streaming, summary, activeTitle, completeTitle }) {
  return (
    <div className="build-trip-progress" aria-live="polite">
      <div>
        <strong>{streaming ? activeTitle : completeTitle}</strong>
        <p>Progress is streamed from the agent workflow and persisted as trip activity.</p>
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
