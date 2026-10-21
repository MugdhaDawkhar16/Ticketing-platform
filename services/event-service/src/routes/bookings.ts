import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { publishEvent } from "../lib/kafka.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";

const router = Router();


router.post("/", requireAuth, async (req, res) => {
  let lockKey: string | null = null;
  let lockValue: string | null = null;
  let bookingCreated = false;

  try {
    const authUser = (req as AuthenticatedRequest).authUser;
const { seatId } = req.body;
const userId = authUser?.id;

if (!userId) {
  return res.status(401).json({
    message: "Authentication required",
  });
}

    if (!userId || !seatId) {
      return res.status(400).json({
        message: "userId and seatId are required",
      });
    }

    const seat = await prisma.seat.findUnique({
      where: { id: seatId },
    });

    if (!seat) {
      return res.status(404).json({
        message: "Seat not found",
      });
    }

    lockKey = `seat:${seatId}:lock`;
    lockValue = `${userId}:${Date.now()}:${Math.random()}`;

    const lockAcquired = await redis.set(lockKey, lockValue, {
      NX: true,
      EX: 300,
    });

    if (lockAcquired !== "OK") {
      return res.status(409).json({
        message: "Seat is currently being held by another user",
      });
    }

    const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const booking = await prisma.$transaction(async (tx) => {
      const updated = await tx.seat.updateMany({
        where: {
          id: seatId,
          status: "AVAILABLE",
        },
        data: {
          status: "HELD",
          holdExpiresAt,
        },
      });

      if (updated.count !== 1) {
        throw new Error("SEAT_NOT_AVAILABLE");
      }

      return tx.booking.create({
        data: {
          userId,
          eventId: seat.eventId,
          status: "PENDING",
          totalAmount: seat.price,
          seats: {
            create: { seatId },
          },
        },
        include: { seats: true },
      });
    });

    bookingCreated = true;

    try {
      await publishEvent("seat-events", {
        type: "SeatHeld",
        bookingId: booking.id,
        seatId,
        eventId: seat.eventId,
        userId,
        holdExpiresAt: holdExpiresAt.toISOString(),
      });
    } catch (publishError) {
      console.error("Failed to publish SeatHeld event:", publishError);
      // Keep the booking and lock; do not pretend the booking failed.
      // The hold-expiry workflow must still clean up this pending booking.
    }

    return res.status(201).json(booking);
  } catch (error) {
    if (!bookingCreated && lockKey && lockValue) {
      // Release only our own lock, never another user's lock.
      try {
        await redis.eval(
          `if redis.call("GET", KEYS[1]) == ARGV[1] then
             return redis.call("DEL", KEYS[1])
           else
             return 0
           end`,
          {
            keys: [lockKey],
            arguments: [lockValue],
          }
        );
      } catch (releaseError) {
        console.error("Failed to release seat lock:", releaseError);
      }
    }

    if (error instanceof Error && error.message === "SEAT_NOT_AVAILABLE") {
      return res.status(409).json({
        message: "Seat is not available",
      });
    }

    console.error("CREATE BOOKING ERROR:", error);

    return res.status(500).json({
      message: "Failed to create booking",
    });
  }
});

router.get(
  "/:id",
  requireAuth,
  async (req, res) => {
  try {
    const bookingId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }
    const authUser = (req as AuthenticatedRequest).authUser;
if (!authUser) {
  return res.status(401).json({
    message: "Authentication required",
  });
}
   const booking = await prisma.booking.findUnique({
  where: { id: String(req.params.id) },
  select: {
    id: true,
    userId: true,
    status: true,
    totalAmount: true,
    createdAt: true,
  },
});

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.userId !== authUser.id && authUser.role !== "ADMIN") {
  return res.status(403).json({
    message: "You cannot access this booking",
  });
}
    return res.json(booking);
  } catch (error) {
    console.error("Failed to fetch booking:", error);
    return res.status(500).json({ message: "Failed to fetch booking" });
  }
});
router.get("/", requireAuth, async (req, res) => {
  try {
   const authUser = (req as AuthenticatedRequest).authUser;
if (!authUser) {
  return res.status(401).json({
    message: "Authentication required",
  });
}

const requestedUserId = String(req.query.userId ?? "");
const userId =
  authUser.role === "ADMIN" && requestedUserId
    ? requestedUserId
    : authUser.id;

    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
          },
        },
        seats: {
          include: {
            seat: {
              select: {
                id: true,
                row: true,
                number: true,
              },
            },
          },
        },
      },
    });

    return res.json(bookings);
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

export default router;