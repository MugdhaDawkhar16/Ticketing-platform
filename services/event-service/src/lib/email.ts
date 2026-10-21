
import { BrevoClient } from "@getbrevo/brevo";

type BookingConfirmationEmail = {
  to: string;
  customerName: string;
  bookingId: string;
  eventName: string;
  eventDate: Date | string;
  venue: string;
  location: string;
  seats: string[];
  totalAmount: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export async function sendBookingConfirmationEmail(
  details: BookingConfirmationEmail,
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || "TicketFlow";

  if (!apiKey || !senderEmail) {
    throw new Error("Brevo email configuration is missing");
  }

  const eventDate = new Date(details.eventDate);

  if (Number.isNaN(eventDate.getTime())) {
    throw new Error("Invalid event date");
  }

  const brevo = new BrevoClient({
    apiKey,
    timeoutInSeconds: 15,
    maxRetries: 1,
  });

  const formattedDate = eventDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const customerName = escapeHtml(details.customerName);
  const eventName = escapeHtml(details.eventName);
  const venue = escapeHtml(details.venue);
  const location = escapeHtml(details.location);
  const bookingId = escapeHtml(details.bookingId);
  const totalAmount = escapeHtml(details.totalAmount);

  const seats = details.seats.length
    ? details.seats.map(escapeHtml).join(", ")
    : "See your booking details";

  await brevo.transactionalEmails.sendTransacEmail({
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: details.to }],
    subject: `Booking confirmed: ${details.eventName}`,
    textContent: [
      `Hi ${details.customerName},`,
      "",
      "Your TicketFlow booking is confirmed!",
      `Event: ${details.eventName}`,
      `Date: ${formattedDate}`,
      `Venue: ${details.venue}`,
      `Location: ${details.location}`,
      `Seats: ${details.seats.join(", ")}`,
      `Total: ${details.totalAmount}`,
      `Booking reference: ${details.bookingId}`,
    ].join("\n"),
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h1 style="color:#2563eb">TicketFlow</h1>
        <h2>Booking confirmed!</h2>
        <p>Hi ${customerName}, your booking is confirmed.</p>
        <p><strong>Event:</strong> ${eventName}</p>
        <p><strong>Date:</strong> ${escapeHtml(formattedDate)}</p>
        <p><strong>Venue:</strong> ${venue}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Seats:</strong> ${seats}</p>
        <p><strong>Total:</strong> ${totalAmount}</p>
        <p><strong>Booking reference:</strong> ${bookingId}</p>
        <p>Thank you for booking with TicketFlow.</p>
      </div>
    `,
  });
}
