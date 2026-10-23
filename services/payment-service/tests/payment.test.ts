import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/payment.js", () => ({
  createRazorpayOrder: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
}));

import app from "../src/app.js";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../src/payment.js";

describe("Payment API (mocked)", () => {
  afterEach(() => vi.resetAllMocks());

  it("returns health status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "payment-service",
    });
  });

  it("rejects order creation without authentication", async () => {
    const response = await request(app)
      .post("/payments/orders")
      .send({ bookingId: "booking-test-1" });

    expect(response.status).toBe(401);
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("rejects order creation without a booking ID", async () => {
    const response = await request(app)
      .post("/payments/orders")
      .set("Authorization", "Bearer test-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("bookingId is required");
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("returns a mocked payment order", async () => {
    vi.mocked(createRazorpayOrder).mockResolvedValue({
      keyId: "rzp_test_mock",
      orderId: "order_mock_123",
      amount: 49900,
      currency: "INR",
    });

    const response = await request(app)
      .post("/payments/orders")
      .set("Authorization", "Bearer test-token")
      .send({ bookingId: "booking-test-1" });

    expect(response.status).toBe(200);
    expect(response.body.orderId).toBe("order_mock_123");
    expect(response.body.amount).toBe(49900);
    expect(createRazorpayOrder).toHaveBeenCalledWith(
      "booking-test-1",
      "test-token",
    );
  });

  it("returns mocked successful verification", async () => {
    vi.mocked(verifyRazorpayPayment).mockResolvedValue({
      paymentId: "payment_mock_123",
      bookingId: "booking-test-1",
      amount: 499,
      alreadyConfirmed: false,
    });

    const response = await request(app)
      .post("/payments/verify")
      .send({
        bookingId: "booking-test-1",
        razorpay_order_id: "order_mock_123",
        razorpay_payment_id: "payment_mock_123",
        razorpay_signature: "mock-signature",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.amount).toBe(499);
  });

  it("rejects an invalid payment signature", async () => {
    vi.mocked(verifyRazorpayPayment).mockRejectedValue(
      new Error("Invalid Razorpay payment signature"),
    );

    const response = await request(app)
      .post("/payments/verify")
      .send({
        bookingId: "booking-test-1",
        razorpay_order_id: "order_mock_123",
        razorpay_payment_id: "payment_mock_123",
        razorpay_signature: "invalid-signature",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Invalid Razorpay payment signature",
    );
  });
});
