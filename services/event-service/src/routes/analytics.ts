
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const organizerId = String(req.query.organizerId ?? "");

    if (!organizerId) {
      return res.status(400).json({
        message: "organizerId is required",
      });
    }

    const organizer = await prisma.user.findUnique({
      where: { id: organizerId },
      select: { id: true },
    });

    if (!organizer) {
      return res.status(404).json({
        message: "Organizer not found",
      });
    }

    const events = await prisma.event.findMany({
      where: { organizerId },
      orderBy: { date: "asc" },
      include: {
        seats: {
          select: { id: true },
        },
        bookings: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            seats: {
              select: { seatId: true },
            },
          },
        },
      },
    });

    const eventAnalytics = events.map((event) => {
      const confirmed = event.bookings.filter(
        (booking) => booking.status === "CONFIRMED"
      );

      const pending = event.bookings.filter(
        (booking) => booking.status === "PENDING"
      );

      const failed = event.bookings.filter(
        (booking) => booking.status === "FAILED"
      );

      const expired = event.bookings.filter(
        (booking) => booking.status === "EXPIRED"
      );

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        totalSeats: event.seats.length,
        confirmedBookings: confirmed.length,
        ticketsSold: confirmed.reduce(
          (total, booking) => total + booking.seats.length,
          0
        ),
        pendingBookings: pending.length,
        failedBookings: failed.length,
        expiredBookings: expired.length,
        revenue: confirmed.reduce(
          (total, booking) => total + Number(booking.totalAmount),
          0
        ),
      };
    });

    const totals = eventAnalytics.reduce(
      (result, event) => ({
        totalEvents: result.totalEvents + 1,
        totalSeats: result.totalSeats + event.totalSeats,
        confirmedBookings:
          result.confirmedBookings + event.confirmedBookings,
        ticketsSold: result.ticketsSold + event.ticketsSold,
        pendingBookings:
          result.pendingBookings + event.pendingBookings,
        failedBookings:
          result.failedBookings + event.failedBookings,
        expiredBookings:
          result.expiredBookings + event.expiredBookings,
        revenue: result.revenue + event.revenue,
      }),
      {
        totalEvents: 0,
        totalSeats: 0,
        confirmedBookings: 0,
        ticketsSold: 0,
        pendingBookings: 0,
        failedBookings: 0,
        expiredBookings: 0,
        revenue: 0,
      }
    );

    return res.json({
      totals,
      events: eventAnalytics,
    });
  } catch (error) {
    console.error("ANALYTICS ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch analytics",
    });
  }
});

export default router;
