import type {
  AgentRun,
  ChatMessage,
  ChecklistItem,
  ItineraryDay,
  ItineraryItem,
  PublicSharedTrip,
  StreamEvent,
  Trip,
  TripPlace,
  TripShareStatus,
  WorkspaceData,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WORKFLOW_TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);

type GetToken = () => Promise<string | null>;

type ApiOptions = RequestInit & {
  getToken?: GetToken;
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function errorMessage(res: Response) {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (body.detail) return JSON.stringify(body.detail);
  } catch {
    // Fall back to status text below.
  }
  return res.statusText || `Request failed: ${res.status}`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { getToken, auth = true, headers, ...init } = options;
  const token = auth && getToken ? await getToken() : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(await errorMessage(res), res.status);
  }

  return res.json() as Promise<T>;
}

export async function loadTrips(getToken: GetToken) {
  return apiFetch<Trip[]>("/trips", { getToken });
}

export async function createTrip(getToken: GetToken) {
  return apiFetch<Trip>("/trips", {
    method: "POST",
    getToken,
    body: JSON.stringify({
      title: "Untitled trip",
      destination: "New destination",
      status: "Draft",
      progress: 0,
    }),
  });
}

export async function loadWorkspaceData(
  tripId: string,
  getToken: GetToken,
): Promise<WorkspaceData> {
  const [trip, messages, itineraryDays, places, checklist, events, share] =
    await Promise.all([
      apiFetch<Trip>(`/trips/${tripId}`, { getToken }),
      apiFetch<ChatMessage[]>(`/trips/${tripId}/messages`, { getToken }),
      apiFetch<ItineraryDay[]>(`/trips/${tripId}/itinerary`, { getToken }),
      apiFetch<TripPlace[]>(`/trips/${tripId}/places`, { getToken }),
      apiFetch<ChecklistItem[]>(`/trips/${tripId}/checklist`, { getToken }),
      apiFetch(`/trips/${tripId}/agent-events`, { getToken }),
      apiFetch<TripShareStatus>(`/trips/${tripId}/share`, { getToken }),
    ]);

  return {
    trip,
    messages,
    itineraryDays,
    places,
    checklist,
    events: events as WorkspaceData["events"],
    share,
  };
}

export async function patchItineraryItem(
  itemId: string,
  patch: Partial<ItineraryItem>,
  getToken: GetToken,
) {
  return apiFetch<ItineraryItem>(`/itinerary-items/${itemId}`, {
    method: "PATCH",
    getToken,
    body: JSON.stringify(patch),
  });
}

export async function patchTripPlace(
  tripPlaceId: string,
  patch: Partial<TripPlace>,
  getToken: GetToken,
) {
  return apiFetch<TripPlace>(`/trip-places/${tripPlaceId}`, {
    method: "PATCH",
    getToken,
    body: JSON.stringify(patch),
  });
}

export async function publishShare(tripId: string, getToken: GetToken) {
  return apiFetch<TripShareStatus>(`/trips/${tripId}/share`, {
    method: "POST",
    getToken,
  });
}

export async function unpublishShare(tripId: string, getToken: GetToken) {
  return apiFetch<TripShareStatus>(`/trips/${tripId}/share`, {
    method: "DELETE",
    getToken,
  });
}

export async function loadPublicTrip(shareSlug: string) {
  return apiFetch<PublicSharedTrip>(
    `/public/trips/${encodeURIComponent(shareSlug)}`,
    { auth: false },
  );
}

export async function streamTripChat(
  tripId: string,
  message: string,
  getToken: GetToken,
  onEvent: (event: StreamEvent) => void,
) {
  const token = await getToken();
  const res = await fetch(`${API_URL}/trips/${tripId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok || !res.body) {
    throw new ApiError(await errorMessage(res), res.status);
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
      onEvent(JSON.parse(line) as StreamEvent);
    }
  }
}

export async function enqueueBuildTrip(
  tripId: string,
  idempotencyKey: string,
  getToken: GetToken,
) {
  return apiFetch<{ agent_run_id: string; status: string }>(
    `/trips/${tripId}/agent/build-trip`,
    {
      method: "POST",
      getToken,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export async function enqueueRegenerateDay(
  tripId: string,
  dayId: string,
  instruction: string,
  idempotencyKey: string,
  getToken: GetToken,
) {
  return apiFetch<{ agent_run_id: string; status: string }>(
    `/trips/${tripId}/agent/regenerate-day/${dayId}`,
    {
      method: "POST",
      getToken,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ instruction }),
    },
  );
}

export async function loadAgentRun(
  tripId: string,
  runId: string,
  getToken: GetToken,
) {
  return apiFetch<AgentRun>(`/trips/${tripId}/agent-runs/${runId}`, {
    getToken,
  });
}

export async function pollAgentRun(
  tripId: string,
  runId: string,
  getToken: GetToken,
  onRun: (run: AgentRun) => void,
) {
  let run = await loadAgentRun(tripId, runId, getToken);
  onRun(run);

  while (!WORKFLOW_TERMINAL_STATUSES.has(run.status)) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    run = await loadAgentRun(tripId, runId, getToken);
    onRun(run);
  }

  return run;
}
