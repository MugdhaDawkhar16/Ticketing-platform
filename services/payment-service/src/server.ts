
import express from "express";
import { Kafka } from "kafkajs";
import cors from "cors";

import {
  initializePaymentTable,
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

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "payment-service",
  brokers,
});

const producer = kafka.producer();

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
    const message =
      error instanceof Error ? error.message : "Unable to create payment order";

    res.status(400).json({ message });
  }
});

app.post("/payments/verify", async (req, res) => {
  try {
    const result = await verifyRazorpayPayment(req.body);

    if (!result.alreadyConfirmed) {
      await producer.send({
        topic: "payment-events",
        messages: [
          {
            value: JSON.stringify({
              type: "PaymentConfirmed",
              bookingId: result.bookingId,
              paymentId: result.paymentId,
              amount: result.amount,
            }),
          },
        ],
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payment verification failed";

    res.status(400).json({ message });
  }
});

const PORT = Number(process.env.PORT) || 3002;

async function start() {
  await initializePaymentTable();
  await producer.connect();

  console.log("Kafka connected");

  app.listen(PORT, () => {
    console.log(`Payment service running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start payment service:", error);
  process.exitCode = 1;
});
