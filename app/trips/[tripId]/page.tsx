import { AppShell } from "@/components/app-shell";
import { TripWorkspace } from "@/components/trip-workspace";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <AppShell>
      <TripWorkspace tripId={tripId} />
    </AppShell>
  );
}
