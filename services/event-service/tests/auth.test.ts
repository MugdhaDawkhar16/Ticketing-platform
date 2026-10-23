import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import bcrypt from "bcryptjs";

const mockedPrisma = vi.mocked(prisma);
const mockedBcrypt = vi.mocked(bcrypt);

const testUser = {
  id: "test-user-1",
  name: "Test User",
  email: "test@example.com",
  passwordHash: "mock-password-hash",
  role: "USER",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Authentication API", () => {
  beforeEach(() => {
    process.env.JWT_SECRET =
      "test-only-secret-that-is-long-enough-for-jwt";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a new user and returns a token", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedBcrypt.hash.mockResolvedValue("mock-password-hash" as never);
    mockedPrisma.user.create.mockResolvedValue(testUser as never);

    const response = await request(app)
      .post("/auth/register")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "strong-password-123",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Registration successful");
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe("test@example.com");
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  it("normalizes the email during registration", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedBcrypt.hash.mockResolvedValue("mock-password-hash" as never);
    mockedPrisma.user.create.mockResolvedValue(testUser as never);

    await request(app).post("/auth/register").send({
      name: "Test User",
      email: "  TEST@EXAMPLE.COM ",
      password: "strong-password-123",
    });

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "test@example.com" },
      }),
    );
  });

  it("rejects registration with a short password", async () => {
    const response = await request(app).post("/auth/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(mockedPrisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects an already registered email", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: testUser.id,
    } as never);

    const response = await request(app).post("/auth/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "strong-password-123",
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Email is already registered");
  });

  it("logs in a user with valid credentials", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(testUser as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const response = await request(app).post("/auth/login").send({
      email: "TEST@EXAMPLE.COM",
      password: "strong-password-123",
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe("test@example.com");
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects invalid login credentials", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(testUser as never);
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const response = await request(app).post("/auth/login").send({
      email: "test@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });
});
