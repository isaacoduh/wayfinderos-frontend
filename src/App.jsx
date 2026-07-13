import React, { useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const MOCK_TRIPS = [
  {
    id: "tokyo-spring",
    title: "Tokyo in spring",
    destination: "Tokyo, Japan",
    dates: "Apr 18-27, 2027",
    status: "Planning",
    progress: 72,
    budget: "$4,820",
    places: 28,
    travelers: 2,
    next: "Book Shinkansen seats",
    accent: "blue",
  },
  {
    id: "lisbon-week",
    title: "Lisbon food week",
    destination: "Lisbon, Portugal",
    dates: "Sep 5-12, 2026",
    status: "Ready",
    progress: 94,
    budget: "$2,340",
    places: 19,
    travelers: 1,
    next: "Share final itinerary",
    accent: "green",
  },
  {
    id: "patagonia-basecamp",
    title: "Patagonia basecamp",
    destination: "Chile",
    dates: "Nov 8-20, 2026",
    status: "Draft",
    progress: 31,
    budget: "$6,100",
    places: 11,
    travelers: 3,
    next: "Compare flight routes",
    accent: "amber",
  },
];

const ITINERARY_DAYS = [
  {
    day: 1,
    date: "Sat, Apr 18",
    area: "Arrival and Shibuya",
    note: "Easy pace after a long flight",
    items: [
      { time: "15:30", title: "Arrive at Haneda", meta: "Terminal 3 · 35 min transfer", type: "Transit", state: "Booked" },
      { time: "17:00", title: "Check in at Trunk Hotel", meta: "Cat Street · confirmation saved", type: "Stay", state: "Booked" },
      { time: "19:30", title: "Dinner at Uobei Shibuya", meta: "$ · 8 min walk · no booking", type: "Food", state: "Suggested" },
    ],
  },
  {
    day: 2,
    date: "Sun, Apr 19",
    area: "Meiji and Harajuku",
    note: "Architecture, gardens, and design",
    items: [
      { time: "08:30", title: "Meiji Jingu morning walk", meta: "Quietest before 10 · 75 min", type: "Place", state: "Interested" },
      { time: "11:00", title: "Nezu Museum and garden", meta: "$12 · timed entry recommended", type: "Culture", state: "Suggested" },
      { time: "14:30", title: "Koffee Mameya", meta: "$$ · Omotesando · 25 min", type: "Food", state: "Interested" },
    ],
  },
  {
    day: 3,
    date: "Mon, Apr 20",
    area: "Tsukiji and Ginza",
    note: "Early start, polished afternoon",
    items: [
      { time: "07:15", title: "Tsukiji outer market", meta: "$$ · breakfast crawl · 2 hrs", type: "Food", state: "Interested" },
      { time: "11:30", title: "Hamarikyu Gardens", meta: "$3 · tea house stop", type: "Place", state: "Suggested" },
      { time: "18:30", title: "Sushi Ishiyama", meta: "$$$$ · deposit paid", type: "Food", state: "Booked" },
    ],
  },
];

const PLACES = [
  { name: "Meiji Jingu", kind: "Culture", detail: "Ancient forest shrine", status: "Interested" },
  { name: "Nezu Museum", kind: "Museum", detail: "Art and garden", status: "Suggested" },
  { name: "Tsukiji Market", kind: "Food", detail: "Morning market crawl", status: "Interested" },
  { name: "Yanaka Ginza", kind: "Walk", detail: "Old Tokyo streets", status: "Suggested" },
  { name: "Sushi Ishiyama", kind: "Dinner", detail: "Reservation deposit paid", status: "Booked" },
];

const TASKS = [
  { title: "Reserve Sushi Ishiyama", due: "Due Feb 18", priority: "High", completed: false },
  { title: "Buy Ghibli Museum tickets", due: "Due Mar 10", priority: "High", completed: false },
  { title: "Choose Hakone ryokan", due: "Before departure", priority: "Medium", completed: false },
  { title: "Activate eSIM", due: "Before departure", priority: "Low", completed: true },
];

const ACTIVITIES = [
  {
    workflow: "Itinerary Optimizer completed",
    detail: "Reduced transit by 48 minutes across days 2-4.",
    time: "12 min ago",
    status: "Complete",
  },
  {
    workflow: "Restaurant Scout needs review",
    detail: "Found 6 dinner options matching your budget.",
    time: "Yesterday",
    status: "Review",
  },
  {
    workflow: "Booking Monitor is watching",
    detail: "Sushi Ishiyama reservation window opens Feb 18.",
    time: "2 days ago",
    status: "Active",
  },
];

const WORKFLOWS = ["Optimize itinerary", "Find alternatives", "Budget audit", "Booking readiness"];

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedTripId, setSelectedTripId] = useState(MOCK_TRIPS[0].id);
  const [activePanel, setActivePanel] = useState("places");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I can help shape this trip workspace. Ask me to adjust the itinerary, compare neighborhoods, audit budget, or find alternatives.",
    },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const selectedTrip = useMemo(
    () => MOCK_TRIPS.find((trip) => trip.id === selectedTripId) || MOCK_TRIPS[0],
    [selectedTripId],
  );

  async function sendChatMessage(e) {
    e.preventDefault();

    const text = chatInput.trim();
    if (!text || streaming) return;

    setChatInput("");
    setError("");
    setStreaming(true);

    const assistantIndex = messages.length + 1;

    setMessages((current) => [
      ...current,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);

    try {
      const res = await fetch(`${API_URL}/travel-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
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
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex
                  ? { ...message, text: message.text + event.text }
                  : message,
              ),
            );
          }

          if (event.type === "error") {
            setError(event.message || "Something went wrong. Please try again.");
          }
        }
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="app">
      {view === "dashboard" ? (
        <TripsDashboard
          trips={MOCK_TRIPS}
          onOpenTrip={(tripId) => {
            setSelectedTripId(tripId);
            setView("workspace");
          }}
        />
      ) : (
        <TripWorkspace
          trip={selectedTrip}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          streaming={streaming}
          error={error}
          onSendMessage={sendChatMessage}
          onBack={() => setView("dashboard")}
        />
      )}
    </main>
  );
}

function TripsDashboard({ trips, onOpenTrip }) {
  return (
    <section className="dashboard" aria-label="Wayfinder OS trips dashboard">
      <AppHeader />

      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Trip control center</p>
          <h1>Plan, shape, and track every trip in one workspace.</h1>
          <p className="hero-copy">
            Wayfinder OS v0.1 introduces durable-looking trip artifacts while the
            underlying data stays local and lightweight.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={() => onOpenTrip(trips[0].id)}>
          <span aria-hidden="true">+</span>
          Plan a new trip
        </button>
      </div>

      <section className="metric-grid" aria-label="Account usage summary">
        <MetricCard label="Mock plan" value="Pro preview" detail="No billing connected" />
        <MetricCard label="Credits" value="68" detail="32 used this cycle" progress={68} />
        <MetricCard label="Agent runs" value="7" detail="2 need review" />
        <MetricCard label="Active budget" value="$13,260" detail="Across mock trips" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Your trips</h2>
              <p>Plans, readiness, places, and next actions.</p>
            </div>
          </div>

          <div className="trip-list">
            {trips.map((trip) => (
              <button
                className="trip-row"
                key={trip.id}
                type="button"
                onClick={() => onOpenTrip(trip.id)}
              >
                <span className={`trip-marker ${trip.accent}`} aria-hidden="true">
                  {trip.destination.slice(0, 1)}
                </span>
                <span className="trip-main">
                  <span className="trip-title-line">
                    <strong>{trip.title}</strong>
                    <StatusPill>{trip.status}</StatusPill>
                  </span>
                  <span>{trip.destination} · {trip.dates}</span>
                  <span className="next-action">Next: {trip.next}</span>
                </span>
                <span className="trip-readiness">
                  <span>
                    <span>Trip readiness</span>
                    <strong>{trip.progress}%</strong>
                  </span>
                  <ProgressBar value={trip.progress} />
                </span>
                <span className="trip-stats">
                  <strong>{trip.budget}</strong>
                  <span>{trip.places} places · {trip.travelers} travelers</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-side">
          <AgentActivityFeed />
          <div className="agent-callout">
            <p className="eyebrow">Suggested next</p>
            <h2>Resolve Tokyo booking gaps</h2>
            <p>Three time-sensitive reservations open within the next 14 days.</p>
            <button type="button" onClick={() => onOpenTrip("tokyo-spring")}>
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
  activePanel,
  setActivePanel,
  messages,
  chatInput,
  setChatInput,
  streaming,
  error,
  onSendMessage,
  onBack,
}) {
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
            <p>{trip.dates} · {trip.destination} · last saved locally</p>
          </div>
        </div>
        <div className="workspace-actions">
          <span className="credits-pill">68 credits</span>
          <button className="secondary-action" type="button">Share preview</button>
        </div>
      </header>

      <div className="workspace-grid">
        <ChatPanel
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          streaming={streaming}
          error={error}
          onSendMessage={onSendMessage}
        />

        <ItineraryTimeline trip={trip} />

        <ArtifactPanel activePanel={activePanel} setActivePanel={setActivePanel} />
      </div>
    </section>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <div className="brand-lockup" aria-label="Wayfinder OS">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <p className="brand-name">Wayfinder</p>
          <p className="brand-subtitle">OS</p>
        </div>
      </div>
      <span className="version-badge">v0.1</span>
    </header>
  );
}

function ChatPanel({ messages, chatInput, setChatInput, streaming, error, onSendMessage }) {
  return (
    <aside className="chat-panel">
      <div className="panel-header">
        <div>
          <h2>Planning assistant</h2>
          <p>Streaming from the existing travel endpoint.</p>
        </div>
        {streaming && <span className="streaming-pill">Streaming</span>}
      </div>

      <div className="message-list" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
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
          <p>Travel planning only in this release.</p>
          <button className="primary-action compact" type="submit" disabled={streaming || !chatInput.trim()}>
            {streaming ? "Planning..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}

function ItineraryTimeline({ trip }) {
  return (
    <section className="itinerary-panel">
      <div className="panel-header sticky-panel-header">
        <div>
          <h2>Itinerary</h2>
          <p>{trip.progress}% ready · balanced pace · mock artifact</p>
        </div>
        <button className="secondary-action" type="button">Apr 18-27</button>
      </div>

      <div className="workflow-strip" aria-label="Agent workflow concepts">
        {WORKFLOWS.map((workflow) => (
          <button type="button" key={workflow}>
            {workflow}
          </button>
        ))}
      </div>

      <div className="timeline">
        {ITINERARY_DAYS.map((day) => (
          <article className="day-card" key={day.day}>
            <header>
              <span className="day-number">
                <small>Day</small>
                <strong>{day.day}</strong>
              </span>
              <div>
                <h3>{day.area}</h3>
                <p>{day.date} · {day.note}</p>
              </div>
              <StatusPill>Easy pace</StatusPill>
            </header>
            <div className="timeline-items">
              {day.items.map((item) => (
                <div className="timeline-item" key={`${day.day}-${item.title}`}>
                  <time>{item.time}</time>
                  <span className="type-chip">{item.type}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.meta}</p>
                  </div>
                  <StatusPill>{item.state}</StatusPill>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtifactPanel({ activePanel, setActivePanel }) {
  const tabs = ["places", "budget", "tasks", "activity"];

  return (
    <aside className="artifact-panel">
      <div className="tabs" role="tablist" aria-label="Trip artifact panels">
        {tabs.map((tab) => (
          <button
            className={activePanel === tab ? "active" : ""}
            type="button"
            key={tab}
            onClick={() => setActivePanel(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activePanel === "places" && <PlacesPanel />}
      {activePanel === "budget" && <BudgetPanel />}
      {activePanel === "tasks" && <TasksPanel />}
      {activePanel === "activity" && <AgentActivityFeed />}
    </aside>
  );
}

function PlacesPanel() {
  return (
    <div className="artifact-content">
      <PanelTitle title="Place board" sub="Suggested, interested, booked, and skipped places." />
      {PLACES.map((place, index) => (
        <div className="place-row" key={place.name}>
          <span>{index + 1}</span>
          <div>
            <strong>{place.name}</strong>
            <p>{place.kind} · {place.detail}</p>
          </div>
          <StatusPill>{place.status}</StatusPill>
        </div>
      ))}
    </div>
  );
}

function BudgetPanel() {
  const rows = [
    ["Flights", "$1,420", "29%"],
    ["Stays", "$1,760", "36%"],
    ["Food", "$820", "17%"],
    ["Transit", "$340", "7%"],
    ["Activities", "$480", "10%"],
  ];

  return (
    <div className="artifact-content">
      <PanelTitle title="$4,820 forecast" sub="$180 under your target." />
      <ProgressBar value={76} />
      <div className="budget-list">
        {rows.map(([label, value, share]) => (
          <div className="budget-row" key={label}>
            <span>{label}</span>
            <strong>{value} <small>{share}</small></strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPanel() {
  return (
    <div className="artifact-content">
      <PanelTitle title="Booking checklist" sub="Local task state for the workspace shell." />
      {TASKS.map((task) => (
        <label className="task-row" key={task.title}>
          <input type="checkbox" defaultChecked={task.completed} />
          <span>
            <strong>{task.title}</strong>
            <small>{task.due}</small>
          </span>
          <StatusPill>{task.priority}</StatusPill>
        </label>
      ))}
    </div>
  );
}

function AgentActivityFeed() {
  return (
    <div className="panel activity-panel">
      <div className="section-heading compact-heading">
        <div>
          <h2>Agent activity</h2>
          <p>Visible workflow concepts for future agent events.</p>
        </div>
      </div>
      {ACTIVITIES.map((activity) => (
        <div className="activity-row" key={activity.workflow}>
          <span className={`activity-dot ${activity.status.toLowerCase()}`} />
          <div>
            <strong>{activity.workflow}</strong>
            <p>{activity.detail}</p>
          </div>
          <time>{activity.time}</time>
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
