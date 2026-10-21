
"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = "http://localhost:3001";

type EventForm = {
  name: string;
  description: string;
  venue: string;
  location: string;
  category: string;
  date: string;
};

export default function EditEventPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl p-8">
          Loading edit page...
        </main>
      }
    >
      <EditEventForm />
    </Suspense>
  );
}

function EditEventForm() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;

  const [form, setForm] = useState<EventForm>({
    name: "",
    description: "",
    venue: "",
    location: "",
    category: "",
    date: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const response = await fetch(
          `${API_URL}/events/${eventId}`
        );

        if (!response.ok) {
          throw new Error("Could not load event details.");
        }

        const event = await response.json();
        const eventDate = new Date(event.date);

        if (Number.isNaN(eventDate.getTime())) {
          throw new Error("The event has an invalid date.");
        }

        const localDate = new Date(
          eventDate.getTime() -
            eventDate.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 16);

        setForm({
          name: event.name ?? "",
          description: event.description ?? "",
          venue: event.venue ?? "",
          location: event.location ?? "",
          category: event.category ?? "",
          date: localDate,
        });
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

    loadEvent();
  }, [eventId]);

  function updateField(
    field: keyof EventForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/events/${eventId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            date: new Date(form.date).toISOString(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to update event."
        );
      }

      setSuccess("Event updated successfully!");

      setTimeout(() => {
        router.push("/organizer");
        router.refresh();
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        Loading event details...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link
        href="/organizer"
        className="text-blue-600 hover:underline"
      >
        ← Back to Organizer Dashboard
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-bold">
        Edit Event
      </h1>

      <p className="mb-6 text-gray-600">
        Update your event details below.
      </p>

      {error && (
        <p className="mb-4 rounded bg-red-100 p-3 text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-4 rounded bg-green-100 p-3 text-green-700">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block font-medium">
            Event Name
          </label>
          <input
            required
            value={form.name}
            onChange={(e) =>
              updateField("name", e.target.value)
            }
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              updateField("description", e.target.value)
            }
            rows={4}
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Venue
          </label>
          <input
            required
            value={form.venue}
            onChange={(e) =>
              updateField("venue", e.target.value)
            }
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Location
          </label>
          <input
            required
            value={form.location}
            onChange={(e) =>
              updateField("location", e.target.value)
            }
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Category
          </label>
          <input
            required
            value={form.category}
            onChange={(e) =>
              updateField("category", e.target.value)
            }
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Event Date and Time
          </label>
          <input
            required
            type="datetime-local"
            value={form.date}
            onChange={(e) =>
              updateField("date", e.target.value)
            }
            className="w-full rounded border p-3"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving Changes..." : "Save Changes"}
        </button>
      </form>
    </main>
  );
}
