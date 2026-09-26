const express = require('express');
const { body, param } = require('express-validator');

const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  [body('testId').isInt().toInt(), body('appointmentTime').isISO8601()],
  validate,
  async (req, res) => {
    const { testId, appointmentTime } = req.body;

    const test = await prisma.diagnosticTest.findUnique({ where: { id: testId } });
    if (!test) return res.status(404).json({ error: 'Diagnostic test not found' });

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        testId: test.id,
        centreId: test.centreId,
        appointmentTime: new Date(appointmentTime),
        amount: test.price,
        status: 'PENDING',
      },
    });
    res.status(201).json(booking);
  }
);

router.get('/', requireAuth, async (req, res) => {
  const bookings = await prisma.booking.findMany({ where: { userId: req.user.id } });
  res.json(bookings);
});

router.get(
  '/:id',
  requireAuth,
  [param('id').isInt().toInt()],
  validate,
  async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }
    res.json(booking);
  }
);

router.post(
  '/:id/cancel',
  requireAuth,
  [param('id').isInt().toInt()],
  validate,
  async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this booking' });
    }
    if (booking.status !== 'PENDING') {
      return res.status(409).json({ error: `Cannot cancel a booking in status ${booking.status}` });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });
    res.json(updated);
  }
);

module.exports = router;
