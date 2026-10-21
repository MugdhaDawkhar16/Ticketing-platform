
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import type { AuthenticatedRequest } from "../middleware/authMiddleware.js";
const router = Router();

// Every route in this file requires a valid login and ADMIN role.
router.use(requireAuth, requireAdmin);

// GET /admin/overview
router.get("/overview", async (_req, res) => {
  try {
    const [
      totalUsers,
      totalEvents,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      failedBookings,
      expiredBookings,
      revenue,
      totalSeats,
      soldSeats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.booking.count({ where: { status: "PENDING" } }),
      prisma.booking.count({ where: { status: "FAILED" } }),
      prisma.booking.count({ where: { status: "EXPIRED" } }),
      prisma.booking.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { totalAmount: true },
      }),
      prisma.seat.count(),
      prisma.seat.count({ where: { status: "SOLD" } }),
    ]);

    res.json({
      totalUsers,
      totalEvents,
      totalBookings,
      bookings: {
        confirmed: confirmedBookings,
        pending: pendingBookings,
        failed: failedBookings,
        expired: expiredBookings,
      },
      confirmedRevenue: Number(revenue._sum.totalAmount ?? 0),
      totalSeats,
      soldSeats,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ message: "Failed to load admin overview" });
  }
});

// GET /admin/users
router.get("/users", async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const role =
      req.query.role === "USER" || req.query.role === "ADMIN"
        ? req.query.role
        : undefined;

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { events: true, bookings: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ users });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

// PATCH /admin/users/:id/role
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body ?? {};
    const targetId = req.params.id;
    const currentUserId = (req as AuthenticatedRequest).authUser?.id;

    if (role !== "USER" && role !== "ADMIN") {
      res.status(400).json({ message: "Role must be USER or ADMIN" });
      return;
    }

    // Do not allow an administrator to remove their own admin access.
    if (targetId === currentUserId && role !== "ADMIN") {
      res.status(400).json({
        message: "You cannot remove your own administrator role",
      });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });

    if (!target) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.json({ message: "User role updated", user });
  } catch (error) {
    console.error("Admin role update error:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

// GET /admin/events
router.get("/events", async (_req, res) => {
  try {
    const events = await prisma.event.findMany({
      select: {
        id: true,
        name: true,
        venue: true,
        location: true,
        category: true,
        date: true,
        createdAt: true,
        organizer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { seats: true, bookings: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ events });
  } catch (error) {
    console.error("Admin events error:", error);
    res.status(500).json({ message: "Failed to load events" });
  }
});

// GET /admin/bookings
router.get("/bookings", async (req, res) => {
  try {
    const status =
      typeof req.query.status === "string" &&
      ["PENDING", "CONFIRMED", "FAILED", "EXPIRED"].includes(req.query.status)
        ? (req.query.status as
            | "PENDING"
            | "CONFIRMED"
            | "FAILED"
            | "EXPIRED")
        : undefined;

    const bookings = await prisma.booking.findMany({
      where: status ? { status } : {},
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true, date: true } },
        _count: { select: { seats: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({
      bookings: bookings.map((booking) => ({
        ...booking,
        totalAmount: Number(booking.totalAmount),
      })),
    });
  } catch (error) {
    console.error("Admin bookings error:", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

export default router;
