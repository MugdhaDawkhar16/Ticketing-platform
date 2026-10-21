"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const ORGANIZER_ID = "f79b0d30-ad18-4e75-8a09-23076bf6f41a";

type Seat = {
  id: string;
  status: "AVAILABLE" | "HELD" | "SOLD";
  price: number | string;
};

type EventItem = {
  id: string;
  name: string;
  venue: string;
  location: string;
  category: string;
  date: string;
  organizerId: string;
  seats?: Seat[];
};

type EventAnalytics = {
  id: string;
  name: string;
  date: string;
  location: string;
  totalSeats: number;
  confirmedBookings: number;
  ticketsSold: number;
  pendingBookings: number;
  failedBookings: number;
  expiredBookings: number;
  revenue: number;
};

type Analytics = {
  totals: {
    totalEvents: number;
    totalSeats: number;
    confirmedBookings: number;
    ticketsSold: number;
    pendingBookings: number;
    failedBookings: number;
    expiredBookings: number;
    revenue: number;
  };
  events: EventAnalytics[];
};

const money = (value: number) =>
  `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

export default function OrganizerPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [eventsResponse, analyticsResponse] = await Promise.all([
        fetch(`${API_URL}/events`),
        fetch(
          `${API_URL}/analytics?organizerId=${encodeURIComponent(
            ORGANIZER_ID
          )}`
        ),
      ]);

      if (!eventsResponse.ok) {
        throw new Error("Failed to load events.");
      }

      if (!analyticsResponse.ok) {
        throw new Error("Failed to load analytics.");
      }

      const data = await eventsResponse.json();
      const allEvents: EventItem[] = Array.isArray(data)
        ? data
        : data.value ?? data.events ?? [];

      const analyticsData: Analytics = await analyticsResponse.json();

      setEvents(
        allEvents.filter((event) => event.organizerId === ORGANIZER_ID)
      );
      setAnalytics(analyticsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function deleteEvent(event: EventItem) {
    if (
      !window.confirm(
        `Are you sure you want to delete "${event.name}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/events/${event.id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        window.alert(result.message || "Failed to delete event.");
        return;
      }

      window.alert("Event deleted successfully!");
      await loadDashboard();
    } catch {
      window.alert("Could not connect to the event service.");
    }
  }

  const totals = analytics?.totals;
  const analyticsByEvent = new Map(
    (analytics?.events ?? []).map((event) => [event.id, event])
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              TicketFlow
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Organizer Dashboard
            </h1>
            <p className="mt-2 text-slate-400">
              Manage events and track ticket sales and revenue.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/organizer/create"
              className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500"
            >
              + Create Event
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800"
            >
              Browse events
            </Link>
            <button
              onClick={() => void loadDashboard()}
              className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </header>

        {loading && (
          <p className="mt-10 text-slate-300">
            Loading your dashboard...
          </p>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-4">
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => void loadDashboard()}
              className="mt-3 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section>
              <h2 className="mt-10 text-xl font-semibold">
                Sales overview
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Revenue and booking figures from confirmed bookings.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Total events",
                    value: totals?.totalEvents ?? events.length,
                    detail: "Events created",
                  },
                  {
                    label: "Total seats",
                    value: totals?.totalSeats ?? 0,
                    detail: "Across your events",
                  },
                  {
                    label: "Tickets sold",
                    value: totals?.ticketsSold ?? 0,
                    detail: "Confirmed bookings only",
                  },
                  {
                    label: "Confirmed revenue",
                    value: money(totals?.revenue ?? 0),
                    detail: "From confirmed bookings",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <p className="text-sm text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-3 text-3xl font-bold">
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mt-10 text-xl font-semibold">
                Booking status
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Confirmed bookings",
                    value: totals?.confirmedBookings ?? 0,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Pending bookings",
                    value: totals?.pendingBookings ?? 0,
                    color: "text-amber-400",
                  },
                  {
                    label: "Failed bookings",
                    value: totals?.failedBookings ?? 0,
                    color: "text-red-400",
                  },
                  {
                    label: "Expired bookings",
                    value: totals?.expiredBookings ?? 0,
                    color: "text-slate-300",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <p className="text-sm text-slate-400">
                      {item.label}
                    </p>
                    <p className={`mt-3 text-3xl font-bold ${item.color}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    Your events
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Compare sales performance and manage each event.
                  </p>
                </div>
                <span className="text-sm text-slate-400">
                  {events.length} event{events.length === 1 ? "" : "s"}
                </span>
              </div>

              {events.length === 0 && (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <p className="text-slate-400">
                    No events found for this organizer.
                  </p>
                  <Link
                    href="/organizer/create"
                    className="mt-4 inline-block font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    Create your first event →
                  </Link>
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {events.map((event) => {
                  const stats = analyticsByEvent.get(event.id);
                  const seats = event.seats ?? [];
                  const totalSeats = stats?.totalSeats ?? seats.length;
                  const sold = stats?.ticketsSold ??
                    seats.filter((seat) => seat.status === "SOLD").length;
                  const percentage = totalSeats
                    ? Math.min(100, (sold / totalSeats) * 100)
                    : 0;

                  return (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {event.name}
                          </h3>
                          <p className="mt-2 text-slate-400">
                            {event.venue}, {event.location}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {new Date(event.date).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                timeZone: "UTC",
                              }
                            )}{" "}
                            · {event.category}
                          </p>
                        </div>
                        <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                          {stats?.confirmedBookings ?? 0} confirmed
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-slate-800/70 p-4">
                          <p className="text-xs text-slate-400">
                            Tickets sold
                          </p>
                          <p className="mt-1 text-xl font-bold">
                            {sold}/{totalSeats}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-800/70 p-4">
                          <p className="text-xs text-slate-400">
                            Confirmed revenue
                          </p>
                          <p className="mt-1 text-xl font-bold">
                            {money(stats?.revenue ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-800/70 p-3">
                          <p className="text-xs text-slate-400">Pending</p>
                          <p className="mt-1 font-semibold">
                            {stats?.pendingBookings ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-800/70 p-3">
                          <p className="text-xs text-slate-400">
                            Failed / expired
                          </p>
                          <p className="mt-1 font-semibold">
                            {(stats?.failedBookings ?? 0) +
                              (stats?.expiredBookings ?? 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {percentage.toFixed(0)}% of seats sold
                      </p>

                      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-4 text-sm">
                        <Link
                          href={`/events/${event.id}`}
                          className="font-medium text-indigo-400 hover:text-indigo-300"
                        >
                          View event →
                        </Link>
                        <Link
                          href={`/organizer/edit/${event.id}`}
                          className="font-medium text-blue-400 hover:text-blue-300"
                        >
                          Edit event
                        </Link>
                        <button
                          type="button"
                          onClick={() => void deleteEvent(event)}
                          className="font-medium text-red-400 hover:text-red-300"
                        >
                          Delete event
                        </button>
                        <Link
  href="/organizer/attendees"
  className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800"
>
  Manage Attendees
</Link>
                      </div>

                      <p className="mt-4 break-all text-xs text-slate-600">
                        Event ID: {event.id}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
