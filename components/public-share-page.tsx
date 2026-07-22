"use client";

import Link from "next/link";
import { Compass, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError, loadPublicTrip } from "@/lib/api-client";
import {
  formatBudget,
  formatDate,
  formatDateRange,
  formatDayDate,
  formatStatus,
  formatTime,
} from "@/lib/formatters";
import type { PublicSharedTrip } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function PublicSharePage({ shareSlug }: { shareSlug: string }) {
  const [trip, setTrip] = useState<PublicSharedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setUnavailable(false);
      try {
        const data = await loadPublicTrip(shareSlug);
        if (!cancelled) setTrip(data);
      } catch (error) {
        if (!cancelled)
          setUnavailable(
            error instanceof ApiError && error.status === 404 ? true : true,
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  if (loading) {
    return (
      <CenteredShareState
        title="Loading trip page..."
        detail="Fetching this read-only itinerary from Wayfinder OS."
      />
    );
  }

  if (unavailable || !trip) {
    return (
      <CenteredShareState
        title="This trip page is unavailable."
        detail="The link may have been unpublished or may no longer exist."
      />
    );
  }

  return <SharedTripPacket trip={trip} />;
}

function SharedTripPacket({ trip }: { trip: PublicSharedTrip }) {
  const visiblePlaces = useMemo(
    () => trip.places.filter((place) => place.status !== "skipped"),
    [trip.places],
  );
  const openChecklist = trip.checklist_items.filter(
    (item) => !item.is_completed,
  ).length;
  const totalItems = trip.itinerary_days.reduce(
    (sum, day) => sum + day.items.length,
    0,
  );
  const budget = trip.budget;
  const totalBudget = budget?.total_estimate ?? trip.budget_amount;

  return (
    <main className="min-h-screen bg-secondary/40 text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b bg-card px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="font-serif text-lg font-semibold">Wayfinder</span>
          <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-muted-foreground">
            OS
          </span>
        </Link>
        <Badge variant="secondary">Read-only share page</Badge>
      </header>

      <article className="mx-auto max-w-6xl p-4 md:p-8">
        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="grid gap-6 border-b p-6 md:grid-cols-[1fr_360px] md:p-10">
            <div>
              <p className="text-sm font-medium text-primary">
                {trip.destination}
              </p>
              <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight md:text-6xl">
                {trip.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {formatDateRange(trip)} · {trip.status} · Last updated{" "}
                {formatDate(trip.updated_at)}
              </p>
              {trip.summary && (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {cleanSharedText(trip.summary)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              <ShareMetric label="Readiness" value={`${trip.progress}%`} />
              <ShareMetric
                label="Places"
                value={String(visiblePlaces.length)}
              />
              <ShareMetric label="Plan items" value={String(totalItems)} />
              <ShareMetric
                label="Budget"
                value={formatBudget(totalBudget, budget?.currency || "USD")}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_340px]">
            <section className="p-5 md:p-8">
              <h2 className="font-serif text-2xl font-semibold">Itinerary</h2>
              <div className="mt-6 grid gap-7">
                {trip.itinerary_days.map((day) => (
                  <article key={day.day_number}>
                    <div className="mb-3 flex flex-wrap items-baseline gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Day {day.day_number}
                      </span>
                      <h3 className="font-serif text-xl font-semibold">
                        {day.title || `Day ${day.day_number}`}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {formatDayDate(day.date)}
                      </span>
                    </div>
                    {day.summary && (
                      <p className="mb-3 text-sm leading-6 text-muted-foreground">
                        {cleanSharedText(day.summary)}
                      </p>
                    )}
                    <div>
                      {day.items.map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          className="grid grid-cols-[56px_1fr] gap-3 border-l py-2 pl-4"
                        >
                          <time className="text-xs font-semibold">
                            {formatTime(item.start_time)}
                          </time>
                          <div>
                            <p className="text-sm font-medium">
                              {item.title}
                              {item.is_booked && (
                                <span className="text-success"> · Booked</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.category || "Plan"} ·{" "}
                              {cleanSharedText(
                                item.description || "Details pending",
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                      {!day.items.length && (
                        <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                          No items saved for this day yet.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
                {!trip.itinerary_days.length && (
                  <p className="rounded-md bg-secondary p-4 text-sm text-muted-foreground">
                    No itinerary has been published yet.
                  </p>
                )}
              </div>
            </section>

            <aside className="border-l bg-secondary/30">
              <section className="border-b p-5">
                <SideTitle
                  title="Saved places"
                  sub={`${visiblePlaces.length} visible`}
                />
                <div className="grid gap-3">
                  {visiblePlaces.map((place, index) => (
                    <div key={`${place.name}-${index}`} className="flex gap-3">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{place.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {place.category || "Place"} ·{" "}
                          {cleanSharedText(
                            place.notes ||
                              place.city ||
                              place.country ||
                              formatStatus(place.status),
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!visiblePlaces.length && (
                    <p className="text-sm text-muted-foreground">
                      No places saved yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="border-b p-5">
                <SideTitle
                  title="Budget"
                  sub={formatBudget(totalBudget, budget?.currency || "USD")}
                />
                <Progress value={trip.progress} className="my-4" />
                {(budget?.categories || []).map((category) => (
                  <div
                    key={category.name}
                    className="flex justify-between border-b py-2 text-sm last:border-b-0"
                  >
                    <span>{category.name}</span>
                    <strong>
                      {formatBudget(category.amount, budget?.currency || "USD")}
                    </strong>
                  </div>
                ))}
                {!(budget?.categories || []).length && (
                  <p className="text-sm text-muted-foreground">
                    No category estimate yet.
                  </p>
                )}
              </section>

              <section className="border-b p-5">
                <SideTitle title="Checklist" sub={`${openChecklist} open`} />
                {trip.checklist_items.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="flex gap-3 border-b py-2 last:border-b-0"
                  >
                    <span
                      className={`mt-0.5 size-4 rounded border ${item.is_completed ? "bg-success" : "bg-card"}`}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.due_label ||
                          formatStatus(item.priority || "medium")}
                      </p>
                    </div>
                  </div>
                ))}
                {!trip.checklist_items.length && (
                  <p className="text-sm text-muted-foreground">
                    No checklist items yet.
                  </p>
                )}
              </section>

              {!!(trip.assumptions.length || trip.warnings.length) && (
                <section className="p-5">
                  <SideTitle title="Notes" sub="Assumptions and warnings" />
                  {[...trip.assumptions, ...trip.warnings].map(
                    (note, index) => (
                      <p
                        key={`${note}-${index}`}
                        className="mb-2 rounded-md border bg-card p-3 text-xs leading-5 text-muted-foreground"
                      >
                        {cleanSharedText(note)}
                      </p>
                    ),
                  )}
                </section>
              )}
            </aside>
          </div>
          <footer className="flex flex-col gap-2 border-t p-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Planned with Wayfinder OS</span>
            <span>
              {trip.generated_at
                ? `Generated ${formatDate(trip.generated_at)}`
                : "Live trip artifact"}
            </span>
          </footer>
        </section>
      </article>
    </main>
  );
}

function CenteredShareState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="font-serif text-lg font-semibold">Wayfinder OS</span>
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Shared itinerary
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </div>
    </main>
  );
}

function ShareMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4 text-center">
      <strong className="block font-serif text-2xl font-semibold">
        {value}
      </strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SideTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function cleanSharedText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}
