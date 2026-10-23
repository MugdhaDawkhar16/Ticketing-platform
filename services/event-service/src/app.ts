
import express from "express";
import cors from "cors";
import eventRoutes from "./routes/events.js";
import bookingRoutes from "./routes/bookings.js";
import analyticsRoutes from "./routes/analytics.js";
import attendeesRoutes from "./routes/attendees.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "event-service",
  });
});

app.use("/admin", adminRoutes);
app.use("/auth", authRoutes);
app.use("/bookings", bookingRoutes);
app.use("/events", eventRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/attendees", attendeesRoutes);

export default app;
