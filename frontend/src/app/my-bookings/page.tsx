
"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";


type Booking = {
  id: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
  event?: {
    id?: string;
    name?: string;
    date?: string;
    location?: string;
  } | null;
  seats?: {
    seat?: {
      id?: string;
      row?: string | number;
      number?: string | number;
    } | null;
  }[];
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
  let active = true;

  async function loadBookings() {
    try {
      const token = getAuthToken();

      if (!token) {
        router.replace(
          `/login?next=${encodeURIComponent("/my-bookings")}`
        );
        return;
      }

      const response = await fetch(`${API_URL}/bookings`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent("/my-bookings")}`
        );
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load your bookings");
      }

      if (active) {
        setBookings(Array.isArray(data) ? data : data.bookings ?? []);
      }
    } catch (err) {
      if (active) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      }
    } finally {
      if (active) setLoading(false);
    }
  }

  void loadBookings();

  return () => {
    active = false;
  };
}, [router]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white sm:p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="mt-2 text-slate-400">
          View your bookings, event details, and ticket status.
        </p>

        {loading && <p className="mt-8">Loading bookings...</p>}

        {error && (
          <p className="mt-8 text-red-400">{error}</p>
        )}

        {!loading && !error && bookings.length === 0 && (
          <p className="mt-8 text-slate-400">
            No bookings found yet.
          </p>
        )}

        <div className="mt-8 space-y-4">
          {bookings.map((booking) => (
            <article
              key={booking.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 className="text-xl font-semibold">
                {booking.event?.name || "Event booking"}
              </h2>

              {booking.event?.date && (
                <p className="mt-2 text-slate-300">
                  {new Date(booking.event.date).toLocaleString()}
                </p>
              )}

              {booking.event?.location && (
                <p className="mt-1 text-slate-400">
                  Venue: {booking.event.location}
                </p>
              )}

              {booking.seats && booking.seats.length > 0 && (
                <p className="mt-2 text-slate-300">
                  Seats:{" "}
                  {booking.seats
                    .map(({ seat }) =>
                      seat
                        ? [seat.row, seat.number]
                            .filter((value) => value !== undefined && value !== null)
                            .join("-") || seat.id
                        : null
                    )
                    .filter(Boolean)
                    .join(", ") || "Seat details unavailable"}
                </p>
              )}

              <p className="mt-4 break-all text-sm text-slate-500">
                Booking ID: {booking.id}
              </p>

              <p className="mt-3 text-xl font-semibold">
                ₹{Number(booking.totalAmount).toFixed(2)}
              </p>

              <p className="mt-2">
                Status:{" "}
                <span
                  className={
                    booking.status === "CONFIRMED"
                      ? "font-semibold text-green-400"
                      : booking.status === "FAILED"
                        ? "font-semibold text-red-400"
                        : "font-semibold text-amber-400"
                  }
                >
                  {booking.status}
                </span>
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {new Date(booking.createdAt).toLocaleString()}
              </p>

              {booking.status === "CONFIRMED" && (
                <a
                  href={`/confirmation/${booking.id}`}
                  className="mt-4 inline-block text-indigo-400 hover:text-indigo-300"
                >
                  View ticket confirmation →
                </a>
              )}
            </article>
          ))}
        </div>

        <a
          href="/"
          className="mt-8 inline-block rounded-xl bg-indigo-500 px-5 py-3 font-semibold hover:bg-indigo-400"
        >
          Browse Events
        </a>
      </div>
    </main>
  );
}
