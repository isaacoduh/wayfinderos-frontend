import React, { useState } from "react";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const STARTER_PROMPTS = [
  "Plan a 3-day food-focused trip to Lisbon under $900.",
  "Compare spring vs fall for a first trip to Kyoto.",
  "Build a calm 5-day Paris itinerary with one museum per day.",
  "What should I pack for Iceland in late September?",
];

export default function App() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery || loading) return;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch(`${API_URL}/travel-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
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
            setAnswer((current) => current + event.text);
          }

          if (event.type === "error") {
            setError(event.message || "Something went wrong. Please try again.");
          }
        }
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function useStarterPrompt(prompt) {
    if (loading) return;
    setQuery(prompt);
    setError("");
  }

  const hasResult = answer || loading || error;

  return (
    <main className="page">
      <section className="workspace" aria-label="Wayfinder OS travel assistant">
        <header className="app-header">
          <div className="brand-lockup" aria-label="Wayfinder OS">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <p className="brand-name">Wayfinder</p>
              <p className="brand-subtitle">OS</p>
            </div>
          </div>
          <span className="version-badge">v0.000001 Seed</span>
        </header>

        <section className="intro">
          <p className="eyebrow">AI travel planning assistant</p>
          <h1>Ask a focused travel planning question.</h1>
          <p className="product-line">A focused travel planning assistant.</p>
        </section>

        <section className="planner-shell">
          <form className="composer" onSubmit={submit}>
            <label htmlFor="travel-query">Travel prompt</label>
            <textarea
              id="travel-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plan a 3-day food-focused trip to Lisbon under $900..."
              disabled={loading}
            />

            <div className="composer-footer">
              <p className="scope-note">
                Wayfinder only handles travel planning in this seed release.
              </p>
              <button className="ask-button" disabled={loading || !query.trim()}>
                {loading ? "Planning..." : "Ask Wayfinder"}
              </button>
            </div>
          </form>

          <div className="starter-prompts" aria-label="Suggested starter prompts">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                className="starter-prompt"
                key={prompt}
                onClick={() => useStarterPrompt(prompt)}
                disabled={loading}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <section className={`answer-panel ${hasResult ? "is-active" : ""}`} aria-live="polite">
          <div className="answer-header">
            <div>
              <p className="answer-kicker">Wayfinder response</p>
              <h2>{loading ? "Streaming plan" : "Answer"}</h2>
            </div>
            {loading && <span className="streaming-pill">Streaming</span>}
          </div>

          {error && <p className="error">{error}</p>}

          {answer ? (
            <TravelAnswer answer={answer} />
          ) : (
            <p className="empty-state">
              {loading
                ? "Preparing the first notes..."
                : "Your streamed travel answer will appear here."}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function TravelAnswer({ answer }) {
  const sections = parseTravelAnswer(answer);

  if (!sections.length) {
    return null;
  }

  return (
    <div className="answer-board">
      {sections.map((section, index) => (
        <AnswerSection section={section} key={`${section.title}-${index}`} />
      ))}
    </div>
  );
}

function AnswerSection({ section }) {
  if (section.kind === "summary") {
    return (
      <article className="summary-card">
        <p className="section-label">Summary</p>
        <p>{section.body}</p>
      </article>
    );
  }

  if (section.kind === "day") {
    return (
      <article className="day-card">
        <header className="day-header">
          <span className="day-number">
            <span>Day</span>
            <strong>{section.day}</strong>
          </span>
          <div>
            <h3>{section.title}</h3>
            <p>Balanced pace</p>
          </div>
        </header>

        <div className="activity-list">
          {section.items.map((item, index) => (
            <div className="activity-row" key={`${item.label}-${index}`}>
              <span className="activity-marker">{index + 1}</span>
              <div>
                {item.label && <p className="activity-label">{item.label}</p>}
                <p className="activity-text">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="note-card">
      <header>
        <p className="section-label">{section.label}</p>
        <h3>{section.title}</h3>
      </header>

      <div className="note-list">
        {section.items.map((item, index) => (
          <div className="note-row" key={`${item.text}-${index}`}>
            <span className="note-marker">{index + 1}</span>
            <p>
              {item.label && <strong>{item.label}: </strong>}
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function parseTravelAnswer(answer) {
  const lines = answer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "---");

  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("### ") || line.startsWith("## ")) {
      if (current) sections.push(current);
      current = sectionFromHeading(line.replace(/^#{2,3}\s+/, ""));
      continue;
    }

    if (!current) {
      current = { kind: "summary", title: "Summary", body: "" };
    }

    if (current.kind === "summary") {
      const text = stripMarkdown(line.replace(/^Summary:?/i, "").trim());
      current.body = [current.body, text].filter(Boolean).join(" ");
      continue;
    }

    const item = parseListItem(line);
    if (item) {
      current.items.push(item);
    }
  }

  if (current) sections.push(current);

  return sections.filter((section) => {
    if (section.kind === "summary") return section.body;
    return section.items.length;
  });
}

function sectionFromHeading(rawTitle) {
  const title = stripMarkdown(rawTitle);
  const dayMatch = title.match(/^Day\s+(\d+)\s*[—-]\s*(.+)$/i);

  if (title.toLowerCase() === "summary") {
    return { kind: "summary", title: "Summary", body: "" };
  }

  if (dayMatch) {
    return {
      kind: "day",
      day: dayMatch[1],
      title: dayMatch[2],
      items: [],
    };
  }

  return {
    kind: "notes",
    label: title.toLowerCase().includes("recommendation")
      ? "Recommendations"
      : "Planning notes",
    title,
    items: [],
  };
}

function parseListItem(line) {
  const normalized = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");

  if (normalized === line && !line.includes(":")) {
    return null;
  }

  const cleaned = stripMarkdown(normalized);
  const labelMatch = cleaned.match(/^([^:]+):\s+(.+)$/);

  if (labelMatch) {
    return {
      label: labelMatch[1],
      text: labelMatch[2],
    };
  }

  return {
    label: "",
    text: cleaned,
  };
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
