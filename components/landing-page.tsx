"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Lock,
  Share2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const capabilities = [
  [
    "Trip workspace",
    "Durable trips with itinerary, places, budget, checklist, and activity panels.",
  ],
  [
    "Trip-aware chat",
    "Ask for changes using saved trip context and prior messages.",
  ],
  [
    "Build My Trip",
    "Generate structured planning artifacts from the current workspace state.",
  ],
  [
    "Editable regeneration",
    "Regenerate itinerary days while preserving locked and booked items.",
  ],
  [
    "Private accounts",
    "Each signed-in user sees only trips owned by their account.",
  ],
  [
    "Share pages",
    "Publish read-only itinerary pages without exposing private chat.",
  ],
];

export function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between border-b px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="font-serif text-lg font-semibold">Wayfinder</span>
          <span className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-muted-foreground">
            OS
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-md border px-2 py-1 text-xs font-semibold text-muted-foreground sm:inline">
            v0.9 beta
          </span>
          {isLoaded && isSignedIn ? (
            <Button render={<Link href="/trips" />} size="sm">
              Enter app
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
          )}
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl items-center gap-8 px-4 py-8 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Travel planning workspace
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
            Wayfinder OS
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            A private trip workspace for shaping travel plans through chat,
            structured itinerary controls, async planning workflows, and
            read-only share pages.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {isLoaded && isSignedIn ? (
              <Button render={<Link href="/trips" />} size="lg">
                Open your trips
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <>
                <SignUpButton mode="modal">
                  <Button size="lg">
                    Create account
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button variant="outline" size="lg">
                    Sign in
                  </Button>
                </SignInButton>
              </>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b bg-secondary/40 px-4 py-3">
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <strong className="ml-2 text-xs">Tokyo in spring</strong>
          </div>
          <div className="grid border-b md:grid-cols-[0.85fr_1.15fr]">
            <div className="border-b p-5 md:border-b-0 md:border-r">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Wayfinder
              </p>
              <p className="mt-2 rounded-md bg-secondary p-3 text-sm leading-6">
                Build a slower day around Meiji Jingu, Harajuku, and one booked
                dinner.
              </p>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                You
              </p>
              <p className="mt-2 rounded-md bg-primary p-3 text-sm leading-6 text-primary-foreground">
                Keep the reservation locked and reduce transit.
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <small className="text-[9px] uppercase">Day</small>
                  <strong>2</strong>
                </span>
                <div>
                  <h2 className="font-serif text-xl font-semibold">
                    Meiji and Harajuku
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Balanced pace with booked dinner protected
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  "08:30 Meiji Jingu morning walk",
                  "11:00 Nezu Museum and garden",
                  "19:30 Booked dinner protected",
                ].map((item) => (
                  <div
                    key={item}
                    className="grid grid-cols-[56px_1fr] border-t pt-3 text-sm"
                  >
                    <time className="font-semibold text-primary">
                      {item.slice(0, 5)}
                    </time>
                    <span>{item.slice(6)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {[
              [WandSparkles, "Build My Trip"],
              [CheckCircle2, "Editable regeneration"],
              [Lock, "Private trips"],
              [Share2, "Read-only share"],
            ].map(([Icon, label]) => (
              <div
                key={String(label)}
                className="flex items-center gap-2 bg-card p-3 text-xs font-semibold"
              >
                <Icon className="size-4 text-primary" />
                {label as string}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 border-t px-4 py-8 md:grid-cols-3 md:px-8">
        {capabilities.map(([title, detail]) => (
          <article key={title} className="rounded-lg border bg-card p-5">
            <h2 className="font-serif text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {detail}
            </p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl border-t px-4 py-8 md:px-8">
        <div className="grid gap-4 rounded-lg bg-primary p-6 text-primary-foreground md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">
              Honest beta status
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">
              Planning assistance, not booking software.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 opacity-80">
              Generated plans should be reviewed before booking travel. Billing,
              credits, payments, collaboration, and real travel bookings are not
              part of v0.9.
            </p>
          </div>
          <Sparkles className="hidden size-10 opacity-70 md:block" />
        </div>
      </section>
    </main>
  );
}
