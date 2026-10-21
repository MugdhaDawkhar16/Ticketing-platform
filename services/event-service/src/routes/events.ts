import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// Create an event and generate seats
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      venue,
      location,
      category,
      date,
      organizerId,
      rows,
      seatsPerRow,
      price,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !venue ||
      !location ||
      !category ||
      !date ||
      !organizerId ||
      rows === undefined ||
      seatsPerRow === undefined ||
      price === undefined
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Check that the organizer actually exists
    const organizer = await prisma.user.findUnique({
      where: {
        id: organizerId,
      },
    });

    if (!organizer) {
      return res.status(400).json({
        message: "Organizer not found",
        organizerId,
      });
    }

    // Create event + seats atomically
    const event = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.event.create({
        data: {
          name,
          description,
          venue,
          location,
          category,
          date: new Date(date),
          organizerId,
        },
      });

      const seats = [];

      for (let rowIndex = 0; rowIndex < Number(rows); rowIndex++) {
        const row = String.fromCharCode(65 + rowIndex);

        for (
          let seatNumber = 1;
          seatNumber <= Number(seatsPerRow);
          seatNumber++
        ) {
          seats.push({
            eventId: createdEvent.id,
            row,
            number: seatNumber,
            price: Number(price),
          });
        }
      }

      await tx.seat.createMany({
        data: seats,
      });

      return createdEvent;
    });

    // Fetch the event together with its seats
    const eventWithSeats = await prisma.event.findUnique({
      where: {
        id: event.id,
      },
      include: {
        seats: true,
      },
    });

    return res.status(201).json(eventWithSeats);
  } catch (error) {
    console.error("CREATE EVENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to create event",
    });
  }
});

// Get all events
router.get("/", async (_req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        seats: true,
      },
    });

    res.json(events);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch events",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, description, venue, location, category, date } = req.body;
    const eventId = req.params.id;

    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    const data: {
      name?: string;
      description?: string | null;
      venue?: string;
      location?: string;
      category?: string;
      date?: Date;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Invalid event name" });
      }
      data.name = name.trim();
    }

    if (description !== undefined) {
      data.description = description;
    }

    if (venue !== undefined) {
      if (typeof venue !== "string" || !venue.trim()) {
        return res.status(400).json({ message: "Invalid venue" });
      }
      data.venue = venue.trim();
    }

    if (location !== undefined) {
      if (typeof location !== "string" || !location.trim()) {
        return res.status(400).json({ message: "Invalid location" });
      }
      data.location = location.trim();
    }

    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({ message: "Invalid category" });
      }
      data.category = category.trim();
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid event date" });
      }

      data.date = parsedDate;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update",
      });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data,
      include: { seats: true },
    });

    return res.json(updatedEvent);
  } catch (error) {
    console.error("UPDATE EVENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to update event",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        bookings: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    if (event.bookings.length > 0) {
      return res.status(409).json({
        message:
          "Cannot delete an event that has bookings.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.seat.deleteMany({
        where: { eventId },
      });

      await tx.event.delete({
        where: { id: eventId },
      });
    });

    return res.json({
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("DELETE EVENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to delete event",
    });
  }
});

// Get one event
router.get("/:id", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        seats: true,
      },
    });

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.json(event);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch event",
    });
  }
});

// Get seats for an event
router.get("/:id/seats", async (req, res) => {
  try {
    const seats = await prisma.seat.findMany({
      where: {
        eventId: req.params.id,
      },
      orderBy: [
        {
          row: "asc",
        },
        {
          number: "asc",
        },
      ],
    });

    res.json(seats);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch seats",
    });
  }
});

export default router;