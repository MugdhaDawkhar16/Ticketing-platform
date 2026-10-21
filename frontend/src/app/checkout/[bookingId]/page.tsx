
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PAYMENT_URL =
  process.env.NEXT_PUBLIC_PAYMENT_URL || "http://localhost:3002";

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  totalAmount: number | string;
};

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: { color: string };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: string,
    callback: (response: {
      error?: { description?: string };
    }) => void
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existing.addEventListener("error", () => resolve(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutContent() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const bookingId = params.bookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

 async function loadBooking() {
  const token = getAuthToken();

  if (!token) {
    router.replace(
      `/login?next=${encodeURIComponent(`/checkout/${bookingId}`)}`
    );
    throw new Error("Please sign in to access your booking.");
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

  const data = await response.json();

  if (response.status === 401) {
    router.replace(
      `/login?next=${encodeURIComponent(`/checkout/${bookingId}`)}`
    );
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Could not load booking");
  }

  setBooking(data);
  return data as Booking;
}
  // Load the booking when this page opens.
 
useEffect(() => {
  let active = true;

  loadBooking()
    .then((data) => {
      if (active) setBooking(data);
    })
    .catch((err) => {
      if (active) {
        setError(
          err instanceof Error ? err.message : "Could not load booking"
        );
      }
    })
    .finally(() => {
      if (active) setLoading(false);
    });

  return () => {
    active = false;
  };
}, [bookingId]);


  async function handlePayment() {
    if (!booking || paying || booking.status !== "PENDING") return;

    setPaying(true);
    setError("");
    setMessage("Preparing secure checkout...");

    try {
      // The backend determines the amount from the actual booking.
      const orderResponse = await fetch(
        `${PAYMENT_URL}/payments/orders`,
        {
          method: "POST",
          headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAuthToken() ?? ""}`,
},
          body: JSON.stringify({ bookingId }),
        }
      );

      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.message || "Could not create payment order");
      }

      const loaded = await loadRazorpayScript();

      if (!loaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not load. Check your internet connection."
        );
      }

      setMessage("Complete your payment in the Razorpay window.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "TicketFlow",
        description: "Event ticket booking",
        order_id: order.orderId,
        theme: { color: "#6366f1" },

        handler: async (result) => {
          try {
            setMessage("Payment received. Verifying securely...");

            const verifyResponse = await fetch(
              `${PAYMENT_URL}/payments/verify`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bookingId,
                  razorpay_order_id: result.razorpay_order_id,
                  razorpay_payment_id: result.razorpay_payment_id,
                  razorpay_signature: result.razorpay_signature,
                }),
              }
            );

            const verification = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                verification.message || "Payment verification failed"
              );
            }

            // Kafka updates the event-service booking asynchronously.
            for (let attempt = 0; attempt < 20; attempt++) {
              const token = getAuthToken();

if (!token) {
  router.replace(
    `/login?next=${encodeURIComponent(`/checkout/${bookingId}`)}`
  );
  throw new Error("Please sign in again to check your booking.");
}

const statusResponse = await fetch(
  `${API_URL}/bookings/${encodeURIComponent(bookingId)}`,
  {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

              const current = await statusResponse.json();

              if (statusResponse.ok) {
                setBooking(current);
              }

              if (current.status === "CONFIRMED") {
                setMessage("Payment confirmed! Redirecting...");
                router.push(`/confirmation/${bookingId}`);
                return;
              }

              if (current.status === "FAILED") {
                throw new Error("The booking could not be confirmed.");
              }

              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            setMessage(
              "Payment was verified, but booking confirmation is delayed. Check My Bookings shortly."
            );
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not verify payment"
            );
          } finally {
            setPaying(false);
          }
        },

        modal: {
          ondismiss: () => {
            setPaying(false);
            setMessage("Checkout closed. Your booking remains pending.");
          },
        },
      });

      checkout.on("payment.failed", (response) => {
        setPaying(false);
        setError(
          response.error?.description || "Payment failed. Please try again."
        );
      });

      checkout.open();
    } catch (err) {
      setPaying(false);
      setError(
        err instanceof Error ? err.message : "Could not start payment"
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        Loading booking...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
          TicketFlow
        </p>

        <h1 className="mt-3 text-3xl font-bold">Secure Checkout</h1>

        {booking && (
          <div className="mt-6 rounded-xl bg-slate-800 p-5">
            <p className="text-sm text-slate-400">Amount to pay</p>
            <p className="mt-1 text-3xl font-bold">
              ₹{Number(booking.totalAmount).toFixed(2)}
            </p>

            <p className="mt-4 text-sm text-slate-400">Booking status</p>
            <p className="mt-1 font-semibold">{booking.status}</p>

            <p className="mt-4 break-all text-xs text-slate-400">
              Booking ID: {booking.id}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-5 rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-5 rounded-lg bg-slate-800 p-3 text-sm text-slate-200">
            {message}
          </p>
        )}

        {booking?.status === "PENDING" && (
          <button
            onClick={handlePayment}
            disabled={paying}
            className="mt-6 w-full rounded-xl bg-indigo-500 px-5 py-3 font-semibold hover:bg-indigo-400 disabled:opacity-50"
          >
            {paying ? "Processing..." : "Pay with Razorpay"}
          </button>
        )}

        {booking?.status === "CONFIRMED" && (
          <button
            onClick={() => router.push(`/confirmation/${bookingId}`)}
            className="mt-6 w-full rounded-xl bg-green-600 px-5 py-3 font-semibold hover:bg-green-500"
          >
            View Confirmation
          </button>
        )}

        <button
          onClick={() => router.push("/my-bookings")}
          className="mt-3 w-full rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:bg-slate-800"
        >
          My Bookings
        </button>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-8 text-white">
          Loading checkout...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
