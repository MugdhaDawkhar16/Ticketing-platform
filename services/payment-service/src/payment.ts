import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import Razorpay from "razorpay";
import crypto from "node:crypto";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(currentDir, "../.env"),
});

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://ticketing:ticketing_password@127.0.0.1:55432/ticketing",
});

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error("Missing Razorpay test API credentials in .env");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export async function initializePaymentTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      razorpay_order_id TEXT UNIQUE,
      razorpay_payment_id TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migrate the table created by your previous mock implementation.
  await pool.query(`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
      ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT
  `);

  console.log("Payment table ready");
}


async function getBooking(bookingId: string, authToken: string) {
  const eventServiceUrl = (
    process.env.EVENT_SERVICE_URL || "http://localhost:3001"
  ).replace(/\/+$/, "");

  const response = await fetch(
    `${eventServiceUrl}/bookings/${encodeURIComponent(bookingId)}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );


  const booking = await response.json();

  if (!response.ok) {
    throw new Error(booking.message || "Booking not found");
  }

  if (booking.status !== "PENDING") {
    throw new Error(`Booking is ${booking.status}, not PENDING`);
  }

  const amount = Number(booking.totalAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid booking amount");
  }

  return { amount };
}

export async function createRazorpayOrder(bookingId: string, authToken: string) {
  const { amount } = await getBooking(bookingId, authToken);

  const existing = await pool.query(
    "SELECT * FROM payments WHERE booking_id = $1",
    [bookingId]
  );

  if (existing.rows.length > 0) {
    const payment = existing.rows[0];

    if (payment.status === "CONFIRMED") {
      throw new Error("This booking has already been paid");
    }

    if (Number(payment.amount) !== amount) {
      throw new Error("Booking amount does not match existing payment");
    }

    // Reuse an existing order instead of creating duplicates.
    if (payment.razorpay_order_id) {
      return {
        keyId,
        orderId: payment.razorpay_order_id,
        amount: Math.round(amount * 100),
        currency: "INR",
      };
    }
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: bookingId,
  });

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE payments
       SET razorpay_order_id = $2,
           updated_at = NOW()
       WHERE booking_id = $1`,
      [bookingId, order.id]
    );
  } else {
    await pool.query(
      `INSERT INTO payments
         (booking_id, amount, status, razorpay_order_id)
       VALUES ($1, $2, 'PENDING', $3)`,
      [bookingId, amount, order.id]
    );
  }

  return {
    keyId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  };
}

export async function verifyRazorpayPayment(input: {
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const {
    bookingId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = input;

  const result = await pool.query(
    "SELECT * FROM payments WHERE booking_id = $1",
    [bookingId]
  );

  const record = result.rows[0];

  if (!record || !record.razorpay_order_id) {
    throw new Error("No Razorpay order exists for this booking");
  }

  if (record.razorpay_order_id !== razorpay_order_id) {
    throw new Error("Razorpay order does not match this booking");
  }

  if (record.status === "CONFIRMED") {
    if (record.razorpay_payment_id === razorpay_payment_id) {
      return {
        paymentId: record.id,
        bookingId,
        amount: Number(record.amount),
        alreadyConfirmed: true,
      };
    }

    throw new Error("This booking has already been paid");
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret!)
    .update(`${record.razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(razorpay_signature, "hex");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("Invalid Razorpay payment signature");
  }

  // Verify the payment details with Razorpay itself as well.
  const payment = await razorpay.payments.fetch(razorpay_payment_id);

  if (
    payment.order_id !== record.razorpay_order_id ||
    Number(payment.amount) !== Math.round(Number(record.amount) * 100) ||
    payment.currency !== "INR" ||
    payment.status !== "captured"
  ) {
    throw new Error(
      "Razorpay payment is not captured or its details do not match"
    );
  }

  const updated = await pool.query(
    `UPDATE payments
     SET status = 'CONFIRMED',
         razorpay_payment_id = $2,
         updated_at = NOW()
     WHERE booking_id = $1
       AND status = 'PENDING'
     RETURNING *`,
    [bookingId, razorpay_payment_id]
  );

  if (!updated.rows.length) {
    throw new Error("Payment status changed; check the payment record");
  }

  return {
    paymentId: updated.rows[0].id,
    bookingId,
    amount: Number(updated.rows[0].amount),
    alreadyConfirmed: false,
  };
}
