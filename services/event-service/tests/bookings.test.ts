import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    seat: { findUnique: vi.fn() },
    booking: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/lib/redis.js", () => ({
  redis: {
    set: vi.fn(),
    eval: vi.fn(),
  },
}));

vi.mock("../src/lib/kafka.js", () => ({
  publishEvent: vi.fn(),
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { redis } from "../src/lib/redis.js";
import { publishEvent } from "../src/lib/kafka.js";
import jwt from "jsonwebtoken";

const secret = "test-secret-for-ticketflow-tests-32-characters";
process.env.JWT_SECRET = secret;

function authToken(userId = "user-1") {
  return jwt.sign({ sub: userId }, secret, { issuer: "ticketflow" });
}

describe("Booking API", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("creates a pending booking when a seat is available", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as never);

    vi.mocked(prisma.seat.findUnique).mockResolvedValue({
      id: "seat-1",
      eventId: "event-1",
      price: 499,
      status: "AVAILABLE",
    } as never);

    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    const booking = {
      id: "booking-1",
      userId: "user-1",
      eventId: "event-1",
      status: "PENDING",
      totalAmount: 499,
      seats: [{ seatId: "seat-1" }],
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: never) => {
      const tx = {
        seat: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        booking: { create: vi.fn().mockResolvedValue(booking) },
      };
      return (callback as (tx: typeof tx) => Promise<unknown>)(tx);
    });

    vi.mocked(publishEvent).mockResolvedValue(undefined);

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${authToken()}`)
      .send({ seatId: "seat-1" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("PENDING");
    expect(response.body.totalAmount).toBe(499);
    expect(redis.set).toHaveBeenCalled();
    expect(publishEvent).toHaveBeenCalled();
  });

  it("rejects a booking without authentication", async () => {
    const response = await request(app)
      .post("/bookings")
      .send({ seatId: "seat-1" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("returns 404 when the seat does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as never);

    vi.mocked(prisma.seat.findUnique).mockResolvedValue(null);

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${authToken()}`)
      .send({ seatId: "missing-seat" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Seat not found");
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("returns 409 when the Redis seat lock is already held", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as never);

    vi.mocked(prisma.seat.findUnique).mockResolvedValue({
      id: "seat-1",
      eventId: "event-1",
      price: 499,
      status: "AVAILABLE",
    } as never);

    vi.mocked(redis.set).mockResolvedValue(null as never);

    const response = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${authToken()}`)
      .send({ seatId: "seat-1" });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("currently being held");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
