import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organizer = await prisma.user.findUnique({
    where: { email: "admin@ticketflow.local" },
  });

  if (!organizer) {
    throw new Error("Existing admin account was not found. No events created.");
  }

  const events = [
    {
      name: "Live Music Night",
      description: "An evening of live music and great performances.",
      venue: "Phoenix Arena",
      location: "Pune, India",
      category: "Music",
      date: new Date("2027-01-15T18:30:00+05:30"),
      rows: ["A", "B", "C"],
      seatsPerRow: 8,
      price: 799,
    },
    {
      name: "Tech Innovation Summit",
      description: "Explore new ideas, technology, and innovation.",
      venue: "Convention Centre",
      location: "Pune, India",
      category: "Technology",
      date: new Date("2027-02-10T10:00:00+05:30"),
      rows: ["A", "B", "C"],
      seatsPerRow: 8,
      price: 499,
    },
    {
      name: "Comedy Night",
      description: "A fun night of stand-up comedy.",
      venue: "Downtown Theatre",
      location: "Pune, India",
      category: "Comedy",
      date: new Date("2027-03-20T19:00:00+05:30"),
      rows: ["A", "B", "C"],
      seatsPerRow: 8,
      price: 599,
    },
  ];

  for (const item of events) {
    const existing = await prisma.event.findFirst({
      where: {
        name: item.name,
        organizerId: organizer.id,
      },
    });

    if (existing) {
      console.log(`Already exists; skipping: ${item.name}`);
      continue;
    }

    const { rows, seatsPerRow, price, ...eventData } = item;

    await prisma.event.create({
      data: {
        ...eventData,
        organizerId: organizer.id,
        seats: {
          create: rows.flatMap((row) =>
            Array.from({ length: seatsPerRow }, (_, index) => ({
              row,
              number: index + 1,
              price,
              status: "AVAILABLE" as const,
            }))
          ),
        },
      },
    });

    console.log(`Created event with seats: ${item.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });