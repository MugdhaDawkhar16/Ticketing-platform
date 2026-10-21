
import { Kafka } from "kafkajs";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { sendBookingConfirmationEmail } from "../lib/email.js";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "event-service-payment-consumer",
  brokers,
});

const consumer = kafka.consumer({
  groupId: "booking-service",
});

type PaymentEvent = {
  type: "PaymentConfirmed" | "PaymentFailed";
  bookingId: string;
  paymentId?: string;
  amount?: number | string;
};

export async function startPaymentConsumer() {
  await consumer.connect();

  await consumer.subscribe({
    topic: "payment-events",
    fromBeginning: false,
  });

  console.log("Payment consumer connected");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: PaymentEvent;

      try {
        event = JSON.parse(message.value.toString()) as PaymentEvent;
      } catch (error) {
        console.error("Invalid payment event:", error);
        return;
      }

      if (!event.bookingId || !event.type) {
        console.error("Payment event is missing required fields");
        return;
      }

      console.log("Payment event received:", event);

      if (event.type === "PaymentConfirmed") {
        await handlePaymentConfirmed(event);
      } else if (event.type === "PaymentFailed") {
        await handlePaymentFailed(event);
      }
    },
  });
}

/**
 * Delete a Redis lock only if its current value still belongs
 * to this booking's user. Compare-and-delete prevents deleting
 * a lock that changed between GET and DEL.
 */
async function releaseUserSeatLock(
  seatId: string,
  userId: string,
) {
  const key = `seat:${seatId}:lock`;
  const currentValue = await redis.get(key);

  if (!currentValue?.startsWith(`${userId}:`)) {
    return;
  }

  await redis.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then
       return redis.call("DEL", KEYS[1])
     else
       return 0
     end`,
    {
      keys: [key],
      arguments: [currentValue],
    },
  );
}

async function handlePaymentConfirmed(event: PaymentEvent) {
  const booking = await prisma.booking.findUnique({
    where: { id: event.bookingId },
    include: { seats: true },
  });

  if (!booking) {
    console.error(`Booking ${event.bookingId} not found`);
    return;
  }

  if (booking.status !== "PENDING") {
    console.log(
      `Ignoring duplicate or stale confirmation for booking ${booking.id}; ` +
        `status is ${booking.status}. Reconcile captured payments if needed.`,
    );
    return;
  }

  if (booking.seats.length === 0) {
    console.error(
      `Booking ${booking.id} has no seats; payment reconciliation required.`,
    );
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Claim the booking only if it is still pending.
      const claimed = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: "PENDING",
        },
        data: { status: "CONFIRMED" },
      });

      if (claimed.count !== 1) {
        throw new Error("BOOKING_STATE_CHANGED");
      }

      for (const bookingSeat of booking.seats) {
        // Don't sell a seat that another pending booking references.
        const otherPendingBooking = await tx.bookingSeat.findFirst({
          where: {
            seatId: bookingSeat.seatId,
            bookingId: { not: booking.id },
            booking: {
              is: { status: "PENDING" },
            },
          },
          select: { id: true },
        });

        if (otherPendingBooking) {
          throw new Error("SEAT_LINKED_TO_ANOTHER_PENDING_BOOKING");
        }

        // A seat must still be held and its hold must be unexpired.
        const sold = await tx.seat.updateMany({
          where: {
            id: bookingSeat.seatId,
            status: "HELD",
            holdExpiresAt: { gt: new Date() },
          },
          data: {
            status: "SOLD",
            holdExpiresAt: null,
          },
        });

        if (sold.count !== 1) {
          throw new Error("SEAT_HOLD_NO_LONGER_VALID");
        }
      }
    });
  } catch (error) {
    // The transaction rolls back if any seat cannot be sold safely.
    // Do not silently treat a possibly captured payment as unpaid.
    console.error(
      `CRITICAL: Could not safely confirm booking ${booking.id}. ` +
        `Check the payment record and reconcile or refund if captured.`,
      error,
    );
    return;
  }

  for (const bookingSeat of booking.seats) {
    try {
      await releaseUserSeatLock(bookingSeat.seatId, booking.userId);
    } catch (error) {
      console.error(
        `Failed to release lock for seat ${bookingSeat.seatId}:`,
        error,
      );
    }
  }

  console.log(`Booking ${booking.id} confirmed`);

  // Preserve existing confirmation email behavior.
  try {
    const confirmedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        user: true,
        event: true,
        seats: {
          include: { seat: true },
        },
      },
    });

    if (!confirmedBooking) {
      throw new Error("Confirmed booking could not be found");
    }

    if (!confirmedBooking.user.email) {
      throw new Error("Customer email is missing");
    }

    await sendBookingConfirmationEmail({
      to: confirmedBooking.user.email,
      customerName: confirmedBooking.user.name,
      bookingId: confirmedBooking.id,
      eventName: confirmedBooking.event.name,
      eventDate: confirmedBooking.event.date,
      venue: confirmedBooking.event.venue,
      location: confirmedBooking.event.location,
      seats: confirmedBooking.seats.map(
        (item) => `${item.seat.row}${item.seat.number}`,
      ),
      totalAmount: confirmedBooking.totalAmount.toString(),
    });

    console.log(`Confirmation email sent for booking ${booking.id}`);
  } catch (emailError) {
    console.error(
      `Booking ${booking.id} is confirmed, but its email could not be sent:`,
      emailError,
    );
  }
}

async function handlePaymentFailed(event: PaymentEvent) {
  const booking = await prisma.booking.findUnique({
    where: { id: event.bookingId },
    include: { seats: true },
  });

  if (!booking) {
    console.error(`Booking ${event.bookingId} not found`);
    return;
  }

  if (booking.status !== "PENDING") {
    console.log(
      `Ignoring payment failure for booking ${booking.id}; ` +
        `status is ${booking.status}`,
    );
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const failed = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: "PENDING",
        },
        data: { status: "FAILED" },
      });

      if (failed.count !== 1) {
        throw new Error("BOOKING_STATE_CHANGED");
      }

      for (const bookingSeat of booking.seats) {
        const otherPendingBooking = await tx.bookingSeat.findFirst({
          where: {
            seatId: bookingSeat.seatId,
            bookingId: { not: booking.id },
            booking: {
              is: { status: "PENDING" },
            },
          },
          select: { id: true },
        });

        if (otherPendingBooking) {
          console.error(
            `Seat ${bookingSeat.seatId} has another pending booking; ` +
              `it will not be released by ${booking.id}.`,
          );
          continue;
        }

        // Never turn a SOLD seat into AVAILABLE.
        await tx.seat.updateMany({
          where: {
            id: bookingSeat.seatId,
            status: "HELD",
          },
          data: {
            status: "AVAILABLE",
            holdExpiresAt: null,
          },
        });
      }
    });
  } catch (error) {
    console.error(
      `Could not process payment failure for booking ${booking.id}:`,
      error,
    );
    return;
  }

  for (const bookingSeat of booking.seats) {
    try {
      await releaseUserSeatLock(bookingSeat.seatId, booking.userId);
    } catch (error) {
      console.error(
        `Failed to release lock for seat ${bookingSeat.seatId}:`,
        error,
      );
    }
  }

  console.log(`Booking ${booking.id} failed and eligible seats released`);
}
