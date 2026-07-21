export type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  progress: number;
  budget_amount: string | number | null;
  planning_context: PlanningContext | null;
  share_slug: string | null;
  share_enabled: boolean;
  share_created_at: string | null;
  share_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningContext = {
  build_trip?: {
    trip_summary?: string;
    budget?: TripBudget;
    assumptions?: string[];
    warnings?: string[];
    last_built_at?: string;
  };
  [key: string]: unknown;
};

export type TripBudget = {
  currency?: string;
  total_estimate?: string | number | null;
  notes?: string[];
  categories?: Array<{
    name: string;
    amount: string | number;
    [key: string]: unknown;
  }>;
};

export type ChatMessage = {
  id: string;
  trip_id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  created_at: string;
};

export type ItineraryItem = {
  id: string;
  itinerary_day_id: string;
  place_id: string | null;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  is_locked: boolean;
  is_booked: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ItineraryDay = {
  id: string;
  trip_id: string;
  day_number: number;
  date: string | null;
  title: string | null;
  summary: string | null;
  items: ItineraryItem[];
};

export type Place = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export type TripPlace = {
  id: string;
  trip_id: string;
  place_id: string;
  status: "suggested" | "interested" | "booked" | "skipped" | string;
  notes: string | null;
  priority: number | null;
  created_at: string;
  updated_at: string;
  place: Place;
};

export type ChecklistItem = {
  id: string;
  trip_id: string;
  title: string;
  due_label: string | null;
  priority: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type AgentEvent = {
  id: string;
  trip_id: string;
  agent_run_id: string | null;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  title: string;
  detail: string | null;
  status: string;
  created_at: string;
};

export type AgentRun = {
  id: string;
  trip_id: string;
  user_id: string;
  run_type: string;
  status: string;
  job_id: string | null;
  input_text: string;
  output_summary: string | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string;
  finished_at: string | null;
  events: AgentEvent[];
};

export type TripShareStatus = {
  share_enabled: boolean;
  share_slug: string | null;
  share_path: string | null;
  share_created_at: string | null;
  share_updated_at: string | null;
};

export type PublicSharedTrip = {
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  progress: number;
  summary: string | null;
  budget_amount: string | number | null;
  budget: TripBudget | null;
  itinerary_days: Array<{
    day_number: number;
    date: string | null;
    title: string | null;
    summary: string | null;
    items: Array<{
      title: string;
      description: string | null;
      start_time: string | null;
      end_time: string | null;
      category: string | null;
      is_booked: boolean;
    }>;
  }>;
  places: Array<{
    name: string;
    category: string | null;
    city: string | null;
    country: string | null;
    status: string;
    notes: string | null;
    priority: number | null;
  }>;
  checklist_items: Array<{
    title: string;
    due_label: string | null;
    priority: string | null;
    is_completed: boolean;
  }>;
  assumptions: string[];
  warnings: string[];
  generated_at: string | null;
  updated_at: string;
};

export type WorkspaceData = {
  trip: Trip;
  messages: ChatMessage[];
  itineraryDays: ItineraryDay[];
  places: TripPlace[];
  checklist: ChecklistItem[];
  events: AgentEvent[];
  share: TripShareStatus;
};

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message?: string }
  | { type: "agent_event"; event: string; payload?: Record<string, unknown> };
