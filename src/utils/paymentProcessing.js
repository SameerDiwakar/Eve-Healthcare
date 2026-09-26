const prisma = require('../prisma');

/**
 * Applies a payment status event exactly once, no matter how many times the
 * same event_id is delivered (webhook retries, at-least-once delivery, etc).
 *
 * Idempotency strategy: `webhook_events.event_id` is UNIQUE. We try to INSERT
 * the event row and update the payment/booking in the same transaction. If the
 * insert collides on the unique constraint, we know this event_id was already
 * fully processed, so we skip all side effects and report it as a duplicate.
 *
 * Returns { duplicate: boolean, payment, booking }
 */
async function processPaymentEvent({ eventId, providerReference, status, rawPayload }) {
  if (!['SUCCESS', 'FAILED'].includes(status)) {
    const err = new Error(`Invalid payment status: ${status}`);
    err.statusCode = 422;
    throw err;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fails with P2002 (unique constraint) if this event_id was already recorded.
      await tx.webhookEvent.create({
        data: { eventId, payload: rawPayload || {} },
      });

      const payment = await tx.payment.findUnique({ where: { providerReference } });
      if (!payment) {
        const err = new Error(`No payment found for provider_reference ${providerReference}`);
        err.statusCode = 404;
        throw err;
      }

      // Payment already reached a terminal state (e.g. a differently-named
      // duplicate event slipping through) — do not flip it again.
      if (payment.status !== 'PENDING') {
        return { duplicate: true, payment, booking: null };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status },
      });

      const bookingStatus = status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
      const updatedBooking = await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingStatus },
      });

      return { duplicate: false, payment: updatedPayment, booking: updatedBooking };
    });

    return result;
  } catch (err) {
    if (err.code === 'P2002') {
      // Duplicate event_id: already processed by an earlier delivery. No-op.
      const payment = await prisma.payment.findUnique({ where: { providerReference } });
      return { duplicate: true, payment, booking: null };
    }
    throw err;
  }
}

module.exports = { processPaymentEvent };
