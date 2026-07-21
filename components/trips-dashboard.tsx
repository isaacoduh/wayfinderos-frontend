"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createTrip, loadTrips } from "@/lib/api-client";
import { formatBudget, formatDate, formatDateRange } from "@/lib/formatters";
import type { Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function TripsDashboard() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await loadTrips(getToken);
        if (!cancelled) setTrips(data);
      } catch {
        if (!cancelled) setError("Could not load your private trips.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const activeBudget = useMemo(
    () => trips.reduce((sum, trip) => sum + Number(trip.budget_amount || 0), 0),
    [trips],
  );
  const displayName = user?.firstName || user?.fullName || "there";

  async function handleCreateTrip() {
    setCreating(true);
    setError("");
    try {
      const trip = await createTrip(getToken);
      router.push(`/trips/${trip.id}`);
    } catch {
      setError("Could not create a trip.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-4 md:p-8 lg:p-10">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Trip control center
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            Good morning, {displayName}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your private trips, saved artifacts, and agent activity are loaded
            from the Wayfinder backend.
          </p>
        </div>
        <Button onClick={handleCreateTrip} disabled={creating || loading}>
          <Plus data-icon="inline-start" />
          {creating ? "Creating..." : "Plan a new trip"}
        </Button>
      </section>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="grid border-y sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Workspace"
          value="Private"
          detail="Authenticated account"
        />
        <Metric
          label="Durable trips"
          value={String(trips.length)}
          detail="Owned by current user"
        />
        <Metric
          label="Agent workflows"
          value="Async"
          detail="Redis-backed jobs"
        />
        <Metric
          label="Active budget"
          value={formatBudget(activeBudget)}
          detail="Across saved trips"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Your trips</h2>
              <p className="text-sm text-muted-foreground">
                Plans, readiness, places, and next actions from PostgreSQL.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            {loading && (
              <div className="p-6 text-sm text-muted-foreground">
                Loading your trips...
              </div>
            )}

            {!loading &&
              trips.map((trip, index) => (
                <Link
                  href={`/trips/${trip.id}`}
                  key={trip.id}
                  className="group grid gap-5 border-b p-5 transition-colors last:border-b-0 hover:bg-secondary/40 md:grid-cols-[1.4fr_.8fr_.8fr_auto] md:items-center"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-md ${index % 2 === 0 ? "bg-primary/10 text-primary" : "bg-success/15 text-success"}`}
                    >
                      <MapPin className="size-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-xl font-semibold">
                          {trip.title}
                        </h3>
                        <Badge variant="secondary">{trip.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trip.destination} · {formatDateRange(trip)}
                      </p>
                      <p className="mt-2 text-xs font-medium">
                        Saved:{" "}
                        <span className="text-muted-foreground">
                          {formatDate(trip.updated_at)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span>Trip readiness</span>
                      <span className="tabular-nums text-muted-foreground">
                        {trip.progress}%
                      </span>
                    </div>
                    <Progress value={trip.progress} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center md:text-left">
                    <div>
                      <strong className="block text-sm">
                        {formatBudget(trip.budget_amount)}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        Budget
                      </span>
                    </div>
                    <div>
                      <strong className="block text-sm">
                        {trip.share_enabled ? "Published" : "Private"}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        Share page
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="hidden size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" />
                </Link>
              ))}

            {!loading && !trips.length && (
              <div className="grid gap-3 p-8 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-md bg-secondary">
                  <MapPin className="size-5 text-primary" />
                </span>
                <h3 className="font-serif text-2xl font-semibold">
                  No trips yet
                </h3>
                <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
                  Create your first durable trip for this account. It will be
                  private to your Clerk identity.
                </p>
                <div>
                  <Button onClick={handleCreateTrip} disabled={creating}>
                    <Plus data-icon="inline-start" />
                    {creating ? "Creating..." : "Plan a new trip"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="grid gap-6 content-start">
          <div className="rounded-lg border bg-card">
            <div className="border-b p-5">
              <h2 className="font-serif text-xl font-semibold">
                Agent activity
              </h2>
              <p className="text-xs text-muted-foreground">
                Open a trip to view durable workflow events.
              </p>
            </div>
            {[
              [
                "Build My Trip",
                "Creates itinerary, places, budget, checklist, and planning notes.",
                CheckCircle2,
              ],
              [
                "Regenerate Day",
                "Updates a day while preserving locked and booked items.",
                Clock3,
              ],
              [
                "Trip-aware chat",
                "Streams responses using the trip workspace context.",
                Bot,
              ],
            ].map(([title, detail, Icon]) => (
              <div
                key={String(title)}
                className="flex gap-4 border-b p-4 last:border-b-0"
              >
                <span className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-secondary">
                  <Icon className="size-4 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-medium">{String(title)}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {String(detail)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-primary p-6 text-primary-foreground">
            <Bot className="mb-5 size-6" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
              Suggested next
            </p>
            <h3 className="mt-2 font-serif text-2xl font-semibold">
              Open a saved trip
            </h3>
            <p className="mt-2 text-sm leading-relaxed opacity-75">
              Chat, itinerary toggles, place statuses, workflow events, and
              share links persist across refreshes.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b p-5 sm:border-r xl:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">
        {detail}
      </span>
      <strong className="font-serif text-2xl font-semibold">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
