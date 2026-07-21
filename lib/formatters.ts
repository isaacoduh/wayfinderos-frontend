import type { Trip } from "@/lib/types";

export function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function formatDayDate(value?: string | null) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function formatDateRange(trip: Pick<Trip, "start_date" | "end_date">) {
  if (!trip.start_date && !trip.end_date) return "Dates not set";
  if (trip.start_date && trip.end_date)
    return `${formatDate(trip.start_date)} to ${formatDate(trip.end_date)}`;
  return formatDate(trip.start_date || trip.end_date);
}

export function formatTime(value?: string | null) {
  if (!value) return "TBD";
  return value.slice(0, 5);
}

export function formatBudget(value?: string | number | null, currency = "USD") {
  if (value === null || value === undefined || value === "")
    return "Budget TBD";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatStatus(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function absoluteShareUrl(sharePath?: string | null) {
  if (!sharePath || typeof window === "undefined") return "";
  return `${window.location.origin}${sharePath}`;
}

export function createIdempotencyKey(prefix: string) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
