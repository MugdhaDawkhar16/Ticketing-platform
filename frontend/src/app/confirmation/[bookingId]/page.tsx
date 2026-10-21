"use client";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Booking = {
  id: string;
  status: string;
  totalAmount: number | string;
};

function ConfirmationContent() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    let active = true;

    async function loadBooking() {
  try {
    const token = getAuthToken();

    if (!token) {
      router.replace(
        `/login?next=${encodeURIComponent(`/confirmation/${bookingId}`)}`
      );
      return;
    }

    const response = await fetch(
      `${API_URL}/bookings/${encodeURIComponent(bookingId)}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401) {
      router.replace(
        `/login?next=${encodeURIComponent(`/confirmation/${bookingId}`)}`
      );
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not load booking status");
    }

    if (active) {
      setBooking(data as Booking);
      setError("");
    }
  } catch {
    if (active) {
      setError("Unable to load booking status. Retrying...");
    }
  } finally {
    if (active) setLoading(false);
  }
}
    loadBooking();
    const timer = setInterval(loadBooking, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bookingId,router]);

  const confirmed = booking?.status === "CONFIRMED";
  const failed = booking?.status === "FAILED";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-5xl">
          {confirmed ? "✓" : failed ? "✕" : "…"}
        </div>

        <h1 className="mt-4 text-3xl font-bold">
          {confirmed
            ? "Ticket Confirmed!"
            : failed
              ? "Payment Failed"
              : "Confirming Your Booking"}
        </h1>

        <p className="mt-3 text-slate-300">
          {loading
            ? "Loading booking details..."
            : error ||
              (confirmed
                ? "Your booking is confirmed."
                : failed
                  ? "Your booking was not completed."
                  : "Waiting for payment confirmation. This page updates automatically.")}
        </p>

        {booking && (
          <div className="mt-6 space-y-2 text-left">
            <p className="break-all text-sm text-slate-400">
              Booking ID: {booking.id}
            </p>
            <p>
              Amount: ₹{Number(booking.totalAmount).toFixed(2)}
            </p>
            <p>
              Status: <strong>{booking.status}</strong>
            </p>
          </div>
        )}

        <a
          href="/"
          className="mt-6 inline-block rounded-xl bg-indigo-500 px-5 py-3 font-semibold"
        >
          Back to Events
        </a>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-white">Loading confirmation...</main>}>
      <ConfirmationContent />
    </Suspense>
  );
}