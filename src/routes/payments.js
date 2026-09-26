const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');

const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { processPaymentEvent } = require('../utils/paymentProcessing');

const router = express.Router();

// POST /payments/  — initiate a (simulated) payment for a booking.
// A Payment row is created and, because we have no real payment provider,
// the outcome is resolved synchronously here by simulating the provider's
// webhook call to itself. The resulting event_id is returned so a client can
// exercise the idempotent webhook separately (see /payments/webhook).
router.post(
  '/',
  requireAuth,
  [body('bookingId').isInt().toInt(), body('forceStatus').optional().isIn(['SUCCESS', 'FAILED'])],
  validate,
  async (req, res, next) => {
    try {
      const { bookingId, forceStatus } = req.body;

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (booking.userId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to pay for this booking' });
      }
      if (booking.status !== 'PENDING') {
        return res.status(409).json({ error: `Booking is not payable in status ${booking.status}` });
      }

      const payment = await prisma.payment.create({
        data: { bookingId: booking.id, amount: booking.amount, status: 'PENDING' },
      });

      // Simulate the payment provider's outcome. `forceStatus` is a test-only
      // hook to make outcomes deterministic in tests/demos; real callers omit it.
      const outcome = forceStatus || (Math.random() < 0.7 ? 'SUCCESS' : 'FAILED');
      const eventId = uuidv4();

      const { payment: finalPayment, booking: finalBooking } = await processPaymentEvent({
        eventId,
        providerReference: payment.providerReference,
        status: outcome,
        rawPayload: { source: 'synchronous-simulation' },
      });

      res.status(201).json({
        payment: finalPayment,
        booking: finalBooking,
        // Replay this event_id against POST /payments/webhook to see idempotent handling.
        eventId,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /payments/webhook/  — called by the (simulated) payment provider,
// possibly more than once for the same event. Must not double-apply effects.
router.post(
  '/webhook',
  [
    body('eventId').notEmpty().withMessage('eventId is required'),
    body('providerReference').notEmpty().withMessage('providerReference is required'),
    body('status').isIn(['SUCCESS', 'FAILED']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { eventId, providerReference, status } = req.body;

      const result = await processPaymentEvent({
        eventId,
        providerReference,
        status,
        rawPayload: req.body,
      });

      // Always 200 so the provider doesn't retry a webhook we already handled.
      res.status(200).json({
        received: true,
        duplicate: result.duplicate,
        payment: result.payment,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      next(err);
    }
  }
);

module.exports = router;
