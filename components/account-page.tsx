"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Bell, Globe2, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AccountPage({ type }: { type: "profile" | "settings" }) {
  if (type === "profile") return <Profile />;
  return <Settings />;
}

function Header({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function Profile() {
  const { user } = useUser();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-5 md:p-10">
      <Header
        eyebrow="Account"
        title="Travel profile"
        sub="Wayfinder OS v0.9 uses your authenticated account for private trip ownership."
      />
      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-4 border-b p-6">
          <UserButton />
          <div>
            <h2 className="font-serif text-xl font-semibold">
              {user?.fullName || "Wayfinder user"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress ||
                "Signed in with Clerk"}
            </p>
          </div>
          <Badge className="ml-auto" variant="secondary">
            Private workspace
          </Badge>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Info label="Authentication" value="Clerk session" />
          <Info
            label="Trip visibility"
            value="Owner-only by backend enforcement"
          />
          <Info
            label="Public sharing"
            value="Only published read-only share pages"
          />
          <Info
            label="Beta scope"
            value="No billing, credits, or collaboration in v0.9"
          />
        </div>
      </section>
    </div>
  );
}

function Settings() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-5 md:p-10">
      <Header
        eyebrow="Workspace"
        title="Settings"
        sub="Current v0.9 settings reflect account privacy and frontend behavior."
      />
      <section className="overflow-hidden rounded-lg border bg-card">
        <Setting
          icon={UserRound}
          title="Account identity"
          sub="Managed by Clerk through the account menu."
        />
        <Setting
          icon={Bell}
          title="Notifications"
          sub="Workflow notifications are not part of this beta."
        />
        <Setting
          icon={Globe2}
          title="Locale and currency"
          sub="Displayed from browser locale and saved trip budget data."
        />
        <Setting
          icon={ShieldCheck}
          title="Privacy"
          sub="Private routes use authenticated API calls; share pages are public only when published."
        />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function Setting({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof UserRound;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b p-5 last:border-b-0">
      <span className="flex size-9 items-center justify-center rounded-md bg-secondary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
