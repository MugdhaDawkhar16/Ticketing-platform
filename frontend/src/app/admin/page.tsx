
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Overview = {
  totalUsers: number;
  totalEvents: number;
  totalBookings: number;
  bookings: {
    confirmed: number;
    pending: number;
    failed: number;
    expired: number;
  };
  confirmedRevenue: number;
  totalSeats: number;
  soldSeats: number;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  _count: { events: number; bookings: number };
};

type EventItem = {
  id: string;
  name: string;
  venue: string;
  location: string;
  category: string;
  date: string;
  createdAt: string;
  organizer: { id: string; name: string; email: string };
  _count: { seats: number; bookings: number };
};

type BookingItem = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";
  totalAmount: number;
  createdAt: string;
  user: { id: string; name: string; email: string };
  event: { id: string; name: string; date: string };
  _count: { seats: number };
};

type Tab = "overview" | "users" | "events" | "bookings";

const money = (amount: number) =>
  `₹${Number(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const date = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@ticketflow.local");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [search, setSearch] = useState("");
  const [bookingStatus, setBookingStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setLoggedIn(false);
          setToken("");
        }
        throw new Error(data.message ?? `Request failed (${response.status})`);
      }

      return data;
    },
    [token]
  );

  const loadTab = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (tab === "overview") {
        setOverview(await api("/admin/overview"));
      } else if (tab === "users") {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        const data = await api(`/admin/users?${query.toString()}`);
        setUsers(data.users ?? []);
      } else if (tab === "events") {
        const data = await api("/admin/events");
        setEvents(data.events ?? []);
      } else {
        const query = bookingStatus === "ALL"
          ? ""
          : `?status=${encodeURIComponent(bookingStatus)}`;
        const data = await api(`/admin/bookings${query}`);
        setBookings(data.bookings ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }, [api, token, tab, search, bookingStatus]);

  useEffect(() => {
  if (!loggedIn || !token) return;

  const timeout = window.setTimeout(() => {
    void loadTab();
  }, 0);

  return () => window.clearTimeout(timeout);
}, [loggedIn, token, loadTab]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Login failed.");
      }

      if (data.user?.role !== "ADMIN") {
        throw new Error("This account is not an administrator.");
      }

      setToken(data.token);
      setPassword("");
      setLoggedIn(true);
      setTab("overview");
      setMessage("Administrator login successful.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(user: UserItem) {
    const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    if (!window.confirm(`Change ${user.email} to ${nextRole}?`)) return;

    try {
      await api(`/admin/users/${encodeURIComponent(user.id)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setMessage(`Updated ${user.email} to ${nextRole}.`);
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed.");
    }
  }

  function logout() {
    setToken("");
    setLoggedIn(false);
    setOverview(null);
    setUsers([]);
    setEvents([]);
    setBookings([]);
    setPassword("");
    setMessage("");
    setError("");
  }

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 9,
    border: "1px solid #d1d5db",
    background: active ? "#172554" : "#fff",
    color: active ? "#fff" : "#1f2937",
    cursor: "pointer",
    fontWeight: 600,
  });

  const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 28,
  background: "#ffffff",
  color: "#111827",
};
  if (!loggedIn) {
    return (
      <main
  style={{
    maxWidth: 460,
    margin: "70px auto",
    padding: 24,
    color: "#111827",
    backgroundColor: "#f8fafc",
    minHeight: "70vh",
  }}
>
        <Link href="/" style={{ color: "#475569" }}>← TicketFlow home</Link>
       <section
  style={{
    ...cardStyle,
    marginTop: 20,
    color: "#111827",
    backgroundColor: "#ffffff",
  }}
>
          <h1 style={{ fontSize: 28, fontWeight: 750, marginTop: 0 }}>
            Admin sign in
          </h1>
          <p style={{ color: "#64748b" }}>
            Sign in with your TicketFlow administrator account.
          </p>
          <form onSubmit={login} style={{ display: "grid", gap: 14 }}>
            <label style={{ color: "#111827" }}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                style={inputStyle}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>
            {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
            <button disabled={loading} style={primaryButton}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <header style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <p style={{ color: "#64748b", marginBottom: 4 }}>TICKETFLOW</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>
            Admin dashboard
          </h1>
          <p style={{ color: "#64748b" }}>Platform overview and management</p>
        </div>
        <button onClick={logout} style={buttonStyle(false)}>Sign out</button>
      </header>

      <nav style={{
        display: "flex", flexWrap: "wrap", gap: 8,
        margin: "24px 0",
      }}>
        {(["overview", "users", "events", "bookings"] as Tab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)}
            style={buttonStyle(tab === item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {error && <p role="alert" style={noticeError}>{error}</p>}
      {message && <p role="status" style={noticeSuccess}>{message}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => void loadTab()} disabled={loading}
          style={buttonStyle(false)}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loading && <p>Loading dashboard data…</p>}

      {tab === "overview" && overview && (
        <>
          <div style={gridStyle}>
            <Stat title="Total users" value={overview.totalUsers} />
            <Stat title="Total events" value={overview.totalEvents} />
            <Stat title="Total bookings" value={overview.totalBookings} />
            <Stat title="Confirmed revenue" value={money(overview.confirmedRevenue)} />
            <Stat title="Total seats" value={overview.totalSeats} />
            <Stat title="Seats sold" value={overview.soldSeats} />
          </div>
          <section style={{ ...cardStyle, marginTop: 18 }}>
            <h2>Booking status</h2>
            <div style={gridStyle}>
              <Stat title="Confirmed" value={overview.bookings.confirmed} />
              <Stat title="Pending" value={overview.bookings.pending} />
              <Stat title="Failed" value={overview.bookings.failed} />
              <Stat title="Expired" value={overview.bookings.expired} />
            </div>
          </section>
        </>
      )}

      {tab === "users" && (
        <section style={cardStyle}>
          <h2>User management</h2>
          <form onSubmit={(e) => { e.preventDefault(); void loadTab(); }}
            style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email" style={{ ...inputStyle, flex: 1 }} />
            <button style={buttonStyle(false)}>Search</button>
          </form>
          <div style={scrollStyle}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={thStyle}>User</th><th style={thStyle}>Role</th>
                <th style={thStyle}>Events</th><th style={thStyle}>Bookings</th>
                <th style={thStyle}>Joined</th><th style={thStyle}>Action</th>
              </tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={tdStyle}>
                      <strong>{user.name}</strong><br />
                      <span style={{ color: "#64748b" }}>{user.email}</span>
                    </td>
                    <td style={tdStyle}>{user.role}</td>
                    <td style={tdStyle}>{user._count.events}</td>
                    <td style={tdStyle}>{user._count.bookings}</td>
                    <td style={tdStyle}>{date(user.createdAt)}</td>
                    <td style={tdStyle}>
                      <button style={buttonStyle(false)}
                        onClick={() => void updateRole(user)}>
                        Make {user.role === "ADMIN" ? "USER" : "ADMIN"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "events" && (
        <section style={cardStyle}>
          <h2>Event oversight</h2>
          <div style={scrollStyle}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={thStyle}>Event</th><th style={thStyle}>Organizer</th>
                <th style={thStyle}>Date</th><th style={thStyle}>Venue</th>
                <th style={thStyle}>Seats</th><th style={thStyle}>Bookings</th>
              </tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td style={tdStyle}>
                      <strong>{event.name}</strong><br />
                      <span style={{ color: "#64748b" }}>{event.category}</span>
                    </td>
                    <td style={tdStyle}>
                      {event.organizer.name}<br />
                      <span style={{ color: "#64748b" }}>{event.organizer.email}</span>
                    </td>
                    <td style={tdStyle}>{date(event.date)}</td>
                    <td style={tdStyle}>{event.venue}, {event.location}</td>
                    <td style={tdStyle}>{event._count.seats}</td>
                    <td style={tdStyle}>{event._count.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {events.length === 0 && !loading && <p>No events found.</p>}
        </section>
      )}

      {tab === "bookings" && (
        <section style={cardStyle}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ flex: 1 }}>Booking statistics</h2>
            <select value={bookingStatus}
              onChange={(e) => setBookingStatus(e.target.value)}
              style={inputStyle}>
              <option value="ALL">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
          <div style={scrollStyle}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={thStyle}>Booking ID</th><th style={thStyle}>Attendee</th>
                <th style={thStyle}>Event</th><th style={thStyle}>Status</th>
                <th style={thStyle}>Amount</th><th style={thStyle}>Seats</th>
                <th style={thStyle}>Created</th>
              </tr></thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td style={tdStyle}>{booking.id.slice(0, 8)}…</td>
                    <td style={tdStyle}>
                      {booking.user.name}<br />
                      <span style={{ color: "#64748b" }}>{booking.user.email}</span>
                    </td>
                    <td style={tdStyle}>{booking.event.name}</td>
                    <td style={tdStyle}>{booking.status}</td>
                    <td style={tdStyle}>{money(booking.totalAmount)}</td>
                    <td style={tdStyle}>{booking._count.seats}</td>
                    <td style={tdStyle}>{date(booking.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bookings.length === 0 && !loading && <p>No bookings found.</p>}
        </section>
      )}

      <footer style={{ marginTop: 28, color: "#64748b", fontSize: 13 }}>
        TicketFlow admin tools · <Link href="/">Back to home</Link>
      </footer>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <section style={statStyle}>
      <p style={{ color: "#64748b", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 27, fontWeight: 800, margin: "8px 0 0" }}>{value}</p>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginTop: 6,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: 16,
};

const primaryButton: React.CSSProperties = {
  padding: 12,
  border: 0,
  borderRadius: 8,
  background: "#172554",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 14,
};

const statStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 18,
  background: "#fff",
};

const scrollStyle: React.CSSProperties = {
  overflowX: "auto",
  width: "100%",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  textAlign: "left",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const noticeError: React.CSSProperties = {
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 8,
  padding: 12,
};

const noticeSuccess: React.CSSProperties = {
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 8,
  padding: 12,
};
