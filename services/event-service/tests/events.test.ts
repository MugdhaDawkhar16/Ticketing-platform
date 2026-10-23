import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
    },
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("GET /events", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns events including their seats", async () => {
    const events = [
      {
        id: "event-1",
        name: "Test Concert",
        venue: "Test Arena",
        seats: [
          { id: "seat-1", row: "A", number: 1, price: 499 },
        ],
      },
    ];

    vi.mocked(prisma.event.findMany).mockResolvedValue(events as never);

    const response = await request(app).get("/events");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(events);
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      include: { seats: true },
    });
  });

  it("returns an empty array when no events exist", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);

    const response = await request(app).get("/events");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns 500 when event retrieval fails", async () => {
    vi.mocked(prisma.event.findMany).mockRejectedValue(
      new Error("Test database error"),
    );

    const response = await request(app).get("/events");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Failed to fetch events",
    });
  });
});
