
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const eventId = "bac31e26-4345-4036-a9e0-517327292cd4";

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { seats: true },
  });

  if (!event) {
    throw new Error("Event not found. No changes made.");
  }

  if (event.seats.length > 0) {
    console.log(
      `Safety stop: this event already has ${event.seats.length} seats. No changes made.`
    );
    return;
  }

  const bookings = await prisma.booking.count({
    where: { eventId },
  });

  if (bookings > 0) {
    throw new Error(
      `Safety stop: this event has ${bookings} booking(s). Check these before adding seats.`
    );
  }

  const seats = [];

  for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
    const row = String.fromCharCode(65 + rowIndex);

    for (let number = 1; number <= 10; number++) {
      seats.push({
        eventId,
        row,
        number,
        price: 499,
      });
    }
  }

  const result = await prisma.seat.createMany({
    data: seats,
    skipDuplicates: true,
  });

  console.log(`Added ${result.count} seats at ₹499 each.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
