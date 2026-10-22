"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import Link from "next/dist/client/link";
type EventDetails = {
  id: string;
  name: string;
  description?: string | null;
  venue: string;
  location: string;
  category: string;
  date: string;
};

type Seat = {
  id: string;
  row: string;
  number: number;
  price: number | string;
  status: "AVAILABLE" | "HELD" | "SOLD";
};

type Booking = {
  id: string;
  status: string;
  totalAmount: number | string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";


function EventDetailsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;


  const [event, setEvent] = useState<EventDetails | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState("");
  const selectedSeat = seats.find(
    (seat) => seat.id === selectedSeatId && seat.status === "AVAILABLE"
  );
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError("");

      const [eventResponse, seatsResponse] = await Promise.all([
        fetch(`${API_URL}/events/${eventId}`),
        fetch(`${API_URL}/events/${eventId}/seats`),
      ]);

      if (!eventResponse.ok || !seatsResponse.ok) {
        throw new Error("Could not load event or seat information.");
      }

      const eventData: EventDetails = await eventResponse.json();
      const seatsData: Seat[] = await seatsResponse.json();

      setEvent(eventData);
      setSeats(seatsData);

      setSelectedSeatId((current) => {
        const selectedStillAvailable = seatsData.some(
          (seat) => seat.id === current && seat.status === "AVAILABLE"
        );
        return selectedStillAvailable ? current : "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
  const timeout = window.setTimeout(() => {
    void loadData();
  }, 0);

  // Refresh availability every five seconds.
  const interval = window.setInterval(() => {
    void loadData();
  }, 5000);

  return () => {
    window.clearTimeout(timeout);
    window.clearInterval(interval);
  };
}, [loadData]);

  async function holdSeat() {
  if (!selectedSeatId || booking) return;

  const token = getAuthToken();

  if (!token) {
    router.push(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
    return;
  }

  setBooking(true);
  setError("");
  setNotice("");

  try {
    const response = await fetch(`${API_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seatId: selectedSeatId }),
    });

    const data = await response.json();

    if (response.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not hold this seat.");
    }

    const createdBooking = data as Booking;

    sessionStorage.setItem(
      "ticketflow_booking",
      JSON.stringify({
        id: createdBooking.id,
        eventId,
        seatId: selectedSeatId,
        amount: Number(createdBooking.totalAmount),
      })
    );

    router.push(`/checkout/${createdBooking.id}`);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Booking failed.");
    setNotice("Refresh seat availability and try again.");
    await loadData();
  } finally {
    setBooking(false);
  }
}

  if (!event) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        {loading ? "Loading event..." : error || "Event not found."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="text-xl font-black">
            TICKETFLOW
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm text-violet-300 hover:text-violet-200">
          ← All events
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/80 to-slate-900 p-8 md:p-12">
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-300">
            {event.category}
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            {event.name}
          </h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            {event.description || "Choose your seat and reserve your spot."}
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
            <span>📍 {event.venue}, {event.location}</span>
            <span>
              📅{" "}
              {new Date(event.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto max-w-md rounded-t-[50%] border-t-4 border-violet-400/70 pt-4 text-xs font-bold uppercase tracking-[0.35em] text-slate-400">
                Stage
              </div>
            </div>

            <div className="mb-6 flex flex-wrap justify-center gap-4 text-xs text-slate-300">
              <span>🟩 Available</span>
              <span>🟪 Selected</span>
              <span>🟨 Held</span>
              <span>🟥 Sold</span>
            </div>

            <div className="space-y-4">
              {Array.from(new Set(seats.map((seat) => seat.row)))
                .sort()
                .map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-center gap-2"
                  >
                    <span className="w-5 text-sm font-bold text-slate-400">
                      {row}
                    </span>

                    <div className="flex flex-wrap justify-center gap-2">
                      {seats
                        .filter((seat) => seat.row === row)
                        .sort((a, b) => a.number - b.number)
                        .map((seat) => {
                          const selected = selectedSeatId === seat.id;
                          const unavailable =
                            seat.status !== "AVAILABLE";

                          let color =
                            "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20";

                          if (seat.status === "SOLD") {
                            color =
                              "cursor-not-allowed border-red-400/20 bg-red-400/10 text-red-300/60";
                          } else if (seat.status === "HELD") {
                            color =
                              "cursor-not-allowed border-amber-400/20 bg-amber-400/10 text-amber-300/60";
                          } else if (selected) {
                            color =
                              "border-violet-300 bg-violet-500 text-white ring-2 ring-violet-300/40";
                          }

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              disabled={unavailable}
                              aria-pressed={selected}
                              aria-label={`Row ${seat.row}, seat ${seat.number}, ${seat.status}`}
                              title={`${row}${seat.number} · ₹${Number(seat.price)}`}
                              onClick={() => {
                                setSelectedSeatId(seat.id);
                                setNotice("");
                              }}
                              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition disabled:opacity-70 ${color}`}
                            >
                              {seat.number}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>

            <p className="mt-8 text-center text-xs text-slate-500">
              Seat availability refreshes every 5 seconds. A seat is
              reserved only after the backend confirms the hold.
            </p>
          </div>

          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-bold">Your selection</h2>

            {selectedSeat ? (
              <>
                <div className="mt-5 rounded-xl bg-violet-400/10 p-4">
                  <p className="text-sm text-slate-400">Selected seat</p>
                  <p className="mt-1 text-2xl font-bold text-violet-300">
                    {selectedSeat.row}{selectedSeat.number}
                  </p>
                </div>

                <div className="mt-5 flex justify-between text-sm">
                  <span className="text-slate-400">Ticket price</span>
                  <span>₹{Number(selectedSeat.price).toFixed(2)}</span>
                </div>

                <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-bold">
                  <span>Total</span>
                  <span>₹{Number(selectedSeat.price).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                Select an available seat to continue.
              </p>
            )}

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-2 text-sm text-amber-300">{notice}</p>
            )}

            <button
              type="button"
              disabled={!selectedSeat || booking}
              onClick={holdSeat}
              className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {booking ? "Reserving..." : "Reserve seat →"}
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Reservation expires after 5 minutes.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
export default function EventDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-10 text-white">
          Loading event...
        </main>
      }
    >
      <EventDetailsContent />
    </Suspense>
  );
}
