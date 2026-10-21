
import { prisma } from "../lib/prisma.js";

export async function releaseExpiredHolds() {
  const now = new Date();

  const expiredSeats = await prisma.seat.findMany({
    where: {
      status: "HELD",
      holdExpiresAt: { lt: now },
    },
    select: {
      id: true,
      row: true,
      number: true,
    },
  });

  for (const seat of expiredSeats) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Release only if the hold is still expired.
        const released = await tx.seat.updateMany({
          where: {
            id: seat.id,
            status: "HELD",
            holdExpiresAt: { lt: now },
          },
          data: {
            status: "AVAILABLE",
            holdExpiresAt: null,
          },
        });

        // If another process changed the seat, do not expire its booking.
        if (released.count !== 1) {
          return false;
        }

        // Expire pending bookings associated with this seat.
        const bookingSeats = await tx.bookingSeat.findMany({
          where: {
            seatId: seat.id,
            booking: {
              is: { status: "PENDING" },
            },
          },
          select: {
            bookingId: true,
          },
        });

        const bookingIds = [
          ...new Set(bookingSeats.map((item) => item.bookingId)),
        ];

        for (const bookingId of bookingIds) {
          await tx.booking.updateMany({
            where: {
              id: bookingId,
              status: "PENDING",
            },
            data: {
              status: "EXPIRED",
            },
          });
        }

        return true;
      });

      if (result) {
        console.log(`Released expired seat: ${seat.row}${seat.number}`);
      }
    } catch (error) {
      console.error(
        `Failed to expire hold for seat ${seat.row}${seat.number}:`,
        error,
      );
    }
  }
}
