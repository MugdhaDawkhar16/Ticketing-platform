
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

    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        event: {
          organizerId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            date: true,
          },
        },
        seats: {
          include: {
            seat: {
              select: {
                row: true,
                number: true,
                price: true,
              },
            },
          },
        },
      },
    });

    const attendees = bookings.map((booking) => ({
      bookingId: booking.id,
      attendeeName: booking.user.name,
      email: booking.user.email,
      eventId: booking.event.id,
      eventName: booking.event.name,
      eventDate: booking.event.date,
      bookingDate: booking.createdAt,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      seats: booking.seats.map(({ seat }) => ({
        row: seat.row,
        number: seat.number,
        price: Number(seat.price),
      })),
    }));

    return res.json({
      totalAttendees: attendees.length,
      attendees,
    });
  } catch (error) {
    console.error("ATTENDEES ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch attendees",
    });
  }
});

export default router;
