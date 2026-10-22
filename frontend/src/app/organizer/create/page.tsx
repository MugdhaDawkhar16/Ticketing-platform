"use client";

import {  useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ORGANIZER_ID = "f79b0d30-ad18-4e75-8a09-23076bf6f41a";

export default function CreateEventPage() {
  const router = useRouter();
 const [minDate] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    venue: "",
    location: "",
    category: "",
    date: "",
    rows: "5",
    seatsPerRow: "10",
    price: "499",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateField(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organizerId: ORGANIZER_ID,
          rows: Number(form.rows),
          seatsPerRow: Number(form.seatsPerRow),
          price: Number(form.price),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create event");
      }

      setSuccess("Event created successfully!");
      router.push(`/events/${data.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push("/organizer")}
          className="mb-6 text-sm text-blue-600 hover:underline"
        >
          ← Back to dashboard
        </button>

        <h1 className="text-3xl font-bold">Create Event</h1>
        <p className="mt-2 mb-8 text-gray-600">
          Add event details and automatically generate your seating layout.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">
              Event name *
            </label>
            <input
              className={inputClass}
              name="name"
              value={form.name}
              onChange={updateField}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              className={inputClass}
              name="description"
              value={form.description}
              onChange={updateField}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Venue *
              </label>
              <input
                className={inputClass}
                name="venue"
                value={form.venue}
                onChange={updateField}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                City / Location *
              </label>
              <input
                className={inputClass}
                name="location"
                value={form.location}
                onChange={updateField}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Category *
              </label>
              <select
                className={inputClass}
                name="category"
                value={form.category}
                onChange={updateField}
                required
              >
                <option value="">Select category</option>
                <option value="Technology">Technology</option>
                <option value="Music">Music</option>
                <option value="Sports">Sports</option>
                <option value="Conference">Conference</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Event date and time *
              </label>
              <input
                className={inputClass}
                type="datetime-local"
                name="date"
                value={form.date}
                onChange={updateField}
                min={minDate || undefined}
                required
              />
            </div>
          </div>

          <div className="border-t pt-5">
            <h2 className="mb-4 text-lg font-semibold">
              Seating and pricing
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Rows *
                </label>
                <input
                  className={inputClass}
                  type="number"
                  name="rows"
                  min="1"
                  max="26"
                  value={form.rows}
                  onChange={updateField}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Seats per row *
                </label>
                <input
                  className={inputClass}
                  type="number"
                  name="seatsPerRow"
                  min="1"
                  max="100"
                  value={form.seatsPerRow}
                  onChange={updateField}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Price per seat (₹) *
                </label>
                <input
                  className={inputClass}
                  type="number"
                  name="price"
                  min="1"
                  step="1"
                  value={form.price}
                  onChange={updateField}
                  required
                />
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              Total seats: {Number(form.rows) * Number(form.seatsPerRow)}
              {" · "}Maximum potential revenue: ₹
              {(
                Number(form.rows) *
                Number(form.seatsPerRow) *
                Number(form.price)
              ).toLocaleString("en-IN")}
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating event..." : "Create Event"}
          </button>
        </form>
      </div>
    </main>
  );
}