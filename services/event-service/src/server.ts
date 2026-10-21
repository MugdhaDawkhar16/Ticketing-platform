import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import eventRoutes from "./routes/events.js";
import bookingRoutes from "./routes/bookings.js";
import { connectRedis } from "./lib/redis.js";
import { releaseExpiredHolds } from "./workers/hold-expiration.js";
import { connectKafka } from "./lib/kafka.js";
import { startPaymentConsumer } from "./workers/payment-consumer.js";
import analyticsRoutes from "./routes/analytics.js";
import attendeesRoutes from "./routes/attendees.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
dotenv.config();

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

const PORT = process.env.PORT || 3001;

Promise.all([connectRedis(), connectKafka()  ,startPaymentConsumer()
])
  .then(() => {
    console.log("Infrastructure connected");

    app.listen(PORT, () => {
      console.log(`Event service running on port ${PORT}`);
    });

    // Check for expired seat holds every 10 seconds
    setInterval(async () => {
      try {
        await releaseExpiredHolds();
      } catch (error) {
        console.error("Hold expiration worker error:", error);
      }
    }, 10_000);
  })
  .catch((error) => {
    console.error("Failed to connect to infrastructure:", error);
    process.exit(1);
  });