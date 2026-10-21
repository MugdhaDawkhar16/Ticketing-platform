
"use client";

import { useEffect, useMemo, useState } from "react";

type Event = {
  id: string;
  name: string;
  description?: string | null;
  venue: string;
  location: string;
  category: string;
  date: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await fetch(`${API_URL}/events`);

        if (!response.ok) {
          throw new Error("Could not load events.");
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected response from the event service.");
        }

        setEvents(data as Event[]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(events.map((event) => event.category))],
    [events]
  );

  const filteredEvents = events.filter((event) => {
    const query = search.toLowerCase();

    const matchesSearch = [
      event.name,
      event.location,
      event.venue,
      event.category,
    ].some((value) => value?.toLowerCase().includes(query));

    return (
      matchesSearch &&
      (category === "All" || event.category === category)
    );
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-black tracking-tight">
            TICKET<span className="text-violet-400">FLOW</span>
          </a>
          <span className="text-sm text-slate-400">
            Discover your next experience
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-10 pt-16 md:pt-24">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
          Live experiences. One platform.
        </p>

        <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
          Find your next
          <span className="text-violet-400"> unforgettable </span>
          experience.
        </h1>

        <p className="mt-5 max-w-xl text-lg text-slate-400">
          Discover events, choose your seats, and book your next
          experience with confidence.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, cities, or venues..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 outline-none transition focus:border-violet-400 sm:max-w-lg"
            aria-label="Search events"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-4 outline-none focus:border-violet-400"
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="text-sm text-violet-400">YOUR NEXT EXPERIENCE</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Explore events
            </h2>
          </div>
          {!loading && (
            <span className="text-sm text-slate-400">
              {filteredEvents.length} found
            </span>
          )}
        </div>

        {loading && (
          <p className="py-12 text-slate-400">Loading events...</p>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-6">
            <p className="font-semibold text-red-300">
              Unable to load events
            </p>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <p className="mt-2 text-sm text-slate-400">
              Check that the event service is running on port 3001.
            </p>
          </div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div className="rounded-xl border border-white/10 p-10 text-center">
            <p className="text-lg font-semibold">No events found</p>
            <p className="mt-2 text-slate-400">
              Try a different search or category.
            </p>
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <article
                key={event.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-1 hover:border-violet-400/50"
              >
                <div className="flex h-36 items-end bg-gradient-to-br from-violet-950 via-slate-900 to-indigo-950 p-6">
                  <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">
                    {event.category}
                  </span>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold transition group-hover:text-violet-300">
                    {event.name}
                  </h3>

                  <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-slate-400">
                    {event.description || "Join us for this live experience."}
                  </p>

                  <div className="mt-5 space-y-2 text-sm text-slate-300">
                    <p>📍 {event.venue}, {event.location}</p>
                    <p>
                      📅{" "}
                      {new Date(event.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <a
                    href={`/events/${event.id}`}
                    className="mt-6 block rounded-xl bg-violet-600 px-4 py-3 text-center font-semibold transition hover:bg-violet-500"
                  >
                    View event & seats →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-slate-500">
        TicketFlow · Built with Next.js, Node.js, PostgreSQL, Redis and Kafka
      </footer>
    </main>
  );
}
