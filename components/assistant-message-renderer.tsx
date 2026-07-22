"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Lightbulb,
  ListChecks,
  Map,
  Route,
} from "lucide-react";

type AssistantMessageRendererProps = {
  content: string;
  streaming?: boolean;
};

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const sectionStyles: Record<
  string,
  { icon: typeof Lightbulb; label: string; className: string }
> = {
  summary: {
    icon: Lightbulb,
    label: "Summary",
    className: "border-primary/20 bg-primary/5",
  },
  itinerary: {
    icon: Route,
    label: "Itinerary",
    className: "border-primary/20 bg-card",
  },
  budget: {
    icon: CircleDollarSign,
    label: "Budget",
    className: "border-success/25 bg-success/5",
  },
  transport: {
    icon: Map,
    label: "Transport",
    className: "border-primary/20 bg-card",
  },
  recommendations: {
    icon: ListChecks,
    label: "Recommendations",
    className: "border-primary/20 bg-card",
  },
  assumptions: {
    icon: AlertTriangle,
    label: "Assumptions",
    className: "border-warning/35 bg-warning/10",
  },
  warnings: {
    icon: AlertTriangle,
    label: "Review Notes",
    className: "border-warning/35 bg-warning/10",
  },
  "next steps": {
    icon: CheckCircle2,
    label: "Next Steps",
    className: "border-success/25 bg-success/5",
  },
};

export function AssistantMessageRenderer({
  content,
  streaming,
}: AssistantMessageRendererProps) {
  const blocks = parseBlocks(content);

  if (!blocks.length) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        {streaming ? "Preparing planning notes..." : "No response yet."}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {blocks.map((block, index) => (
        <MessageBlock block={block} key={`${block.type}-${index}`} />
      ))}
    </div>
  );
}

function MessageBlock({ block }: { block: Block }) {
  if (block.type === "heading") {
    const section = sectionFor(block.text);
    const Icon = section?.icon;

    return (
      <div
        className={`rounded-md border p-3 ${section?.className || "bg-card"}`}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-primary" />}
          <h3 className="text-sm font-semibold">
            {section?.label || cleanInlineText(block.text)}
          </h3>
        </div>
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="grid gap-2">
        {block.items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="grid grid-cols-[18px_1fr] gap-2 text-sm leading-6"
          >
            <span className="mt-2 size-1.5 rounded-full bg-primary" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <p className="text-sm leading-6">{renderInline(block.text)}</p>;
}

function parseBlocks(content: string): Block[] {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, (match) =>
      match.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""),
    )
    .trim();

  if (!normalized) return [];

  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  }

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: cleanInlineText(heading[2]) });
      continue;
    }

    const boldHeading = line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (boldHeading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: cleanInlineText(boldHeading[1]) });
      continue;
    }

    const listItem = line.match(/^([-*•]|\d+\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(stripLooseMarkdown(listItem[2]));
      continue;
    }

    flushList();
    paragraph.push(stripLooseMarkdown(line));
  }

  flushParagraph();
  flushList();
  return blocks;
}

function sectionFor(text: string) {
  const key = text.toLowerCase().replace(/[:.]/g, "").trim();
  if (sectionStyles[key]) return sectionStyles[key];
  if (key.includes("warning")) return sectionStyles.warnings;
  if (key.includes("assumption")) return sectionStyles.assumptions;
  if (key.includes("budget")) return sectionStyles.budget;
  if (key.includes("transport")) return sectionStyles.transport;
  if (key.includes("recommend")) return sectionStyles.recommendations;
  if (key.includes("itinerary") || key.match(/^day\s+\d+/))
    return sectionStyles.itinerary;
  if (key.includes("next")) return sectionStyles["next steps"];
  if (key.includes("summary")) return sectionStyles.summary;
  return null;
}

function cleanInlineText(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function stripLooseMarkdown(value: string) {
  return value.replace(/^#+\s*/, "").trim();
}

function renderInline(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("__") && part.endsWith("__")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <span
          key={index}
          className="rounded bg-secondary px-1 py-0.5 text-[0.85em]"
        >
          {part.slice(1, -1)}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
