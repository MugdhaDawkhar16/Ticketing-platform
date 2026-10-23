import express from "express";
import cors from "cors";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "./payment.js";

const app = express();

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "payment-service" });
});

app.post("/payments/orders", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authorization token required" });
      return;
    }

    const { bookingId } = req.body as { bookingId?: string };

    if (!bookingId) {
      res.status(400).json({ message: "bookingId is required" });
      return;
    }

    const result = await createRazorpayOrder(
      bookingId,
      authHeader.slice("Bearer ".length),
    );

    res.json(result);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unable to create payment order";

    res.status(400).json({ message });
  }
});

app.post("/payments/verify", async (req, res) => {
  try {
    const result = await verifyRazorpayPayment(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Payment verification failed";

    res.status(400).json({ message });
  }
});

export default app;
