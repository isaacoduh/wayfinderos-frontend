import { AppShell } from '@/components/app-shell'
import { TripWorkspace } from '@/components/trip-workspace'
export default async function TripPage({params}:{params:Promise<{tripId:string}>}){await params;return <AppShell><TripWorkspace/></AppShell>}
