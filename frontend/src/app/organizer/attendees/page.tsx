
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const ORGANIZER_ID = "f79b0d30-ad18-4e75-8a09-23076bf6f41a";

type Seat = {
  row: string;
  number: number;
  price: number;
};

type Attendee = {
  bookingId: string;
  attendeeName: string;
  email: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  bookingDate: string;
  status: string;
  totalAmount: number;
  seats: Seat[];
};

export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAttendees() {
      try {
        const response = await fetch(
          `${API_URL}/attendees?organizerId=${encodeURIComponent(
            ORGANIZER_ID
          )}`
        );

        if (!response.ok) {
          throw new Error("Failed to load attendees.");
        }

        const data = await response.json();
        setAttendees(data.attendees ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadAttendees();
  }, []);

  const eventOptions = useMemo(() => {
    const uniqueEvents = new Map<string, string>();

    attendees.forEach((attendee) => {
      uniqueEvents.set(attendee.eventId, attendee.eventName);
    });

    return Array.from(uniqueEvents, ([id, name]) => ({ id, name }));
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    const term = search.trim().toLowerCase();

    return attendees.filter((attendee) => {
      const matchesEvent =
        selectedEvent === "ALL" ||
        attendee.eventId === selectedEvent;

      const matchesSearch =
        !term ||
        attendee.attendeeName.toLowerCase().includes(term) ||
        attendee.email.toLowerCase().includes(term) ||
        attendee.bookingId.toLowerCase().includes(term) ||
        attendee.eventName.toLowerCase().includes(term);

      return matchesEvent && matchesSearch;
    });
  }, [attendees, search, selectedEvent]);

  function exportCSV() {
    const columns = [
      "Attendee Name",
      "Email",
      "Event",
      "Event Date",
      "Booking ID",
      "Seats",
      "Amount",
      "Status",
      "Booking Date",
    ];

    const escapeCSV = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const rows = filteredAttendees.map((attendee) => [
      attendee.attendeeName,
      attendee.email,
      attendee.eventName,
      new Date(attendee.eventDate).toLocaleDateString("en-IN", {
        timeZone: "UTC",
      }),
      attendee.bookingId,
      attendee.seats
        .map((seat) => `${seat.row}${seat.number}`)
        .join(", "),
      attendee.totalAmount,
      attendee.status,
      new Date(attendee.bookingDate).toLocaleDateString("en-IN", {
        timeZone: "UTC",
      }),
    ]);

    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ticketflow-attendees.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const totalRevenue = filteredAttendees.reduce(
    (sum, attendee) => sum + attendee.totalAmount,
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              TicketFlow
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Attendee Management
            </h1>
            <p className="mt-2 text-slate-400">
              Search confirmed attendees and export booking details.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/organizer"
              className="rounded-xl border border-slate-700 px-4 py-2 hover:bg-slate-800"
            >
              ← Dashboard
            </Link>

            <button
              onClick={exportCSV}
              disabled={filteredAttendees.length === 0}
              className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
        </header>

        {loading && (
          <p className="mt-10 text-slate-300">
            Loading attendees...
          </p>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Confirmed bookings
                </p>
                <p className="mt-3 text-3xl font-bold">
                  {attendees.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Tickets assigned
                </p>
                <p className="mt-3 text-3xl font-bold">
                  {attendees.reduce(
                    (sum, attendee) => sum + attendee.seats.length,
                    0
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Revenue in current results
                </p>
                <p className="mt-3 text-3xl font-bold">
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="attendee-search"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Search attendees
                  </label>
                  <input
                    id="attendee-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, email, booking ID, or event..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="event-filter"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Filter by event
                  </label>
                  <select
                    id="event-filter"
                    value={selectedEvent}
                    onChange={(event) =>
                      setSelectedEvent(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All events</option>
                    {eventOptions.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-400">
                Showing {filteredAttendees.length} of {attendees.length}{" "}
                confirmed bookings.
              </p>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {filteredAttendees.length === 0 ? (
                <div className="p-10 text-center">
                  <h2 className="text-lg font-semibold">
                    No attendees found
                  </h2>
                  <p className="mt-2 text-slate-400">
                    Try another search or select a different event.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                      <tr>
                        <th className="px-5 py-4 font-medium">Attendee</th>
                        <th className="px-5 py-4 font-medium">Event</th>
                        <th className="px-5 py-4 font-medium">Seats</th>
                        <th className="px-5 py-4 font-medium">Amount</th>
                        <th className="px-5 py-4 font-medium">Booking ID</th>
                        <th className="px-5 py-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredAttendees.map((attendee) => (
                        <tr
                          key={attendee.bookingId}
                          className="hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold">
                              {attendee.attendeeName}
                            </p>
                            <p className="mt-1 text-slate-400">
                              {attendee.email}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p>{attendee.eventName}</p>
                            <p className="mt-1 text-slate-400">
                              {new Date(attendee.eventDate).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "UTC",
                                }
                              )}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {attendee.seats.length
                              ? attendee.seats
                                  .map((seat) => `${seat.row}${seat.number}`)
                                  .join(", ")
                              : "—"}
                          </td>
                          <td className="px-5 py-4 font-medium">
                            ₹{attendee.totalAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="max-w-48 break-all px-5 py-4 text-xs text-slate-400">
                            {attendee.bookingId}
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                              {attendee.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
