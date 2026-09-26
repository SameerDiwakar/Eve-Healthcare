const express = require('express');
const { body, param } = require('express-validator');

const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Note: Any authenticated user may register a centre or add a test.

router.post(
  '/',
  requireAuth,
  [body('name').notEmpty(), body('location').notEmpty()],
  validate,
  async (req, res) => {
    const { name, location } = req.body;
    const centre = await prisma.diagnosticCentre.create({ data: { name, location } });
    res.status(201).json(centre);
  }
);

router.get('/', async (req, res) => {
  const centres = await prisma.diagnosticCentre.findMany({ include: { tests: true } });
  res.json(centres);
});

router.get(
  '/:id',
  [param('id').isInt().toInt()],
  validate,
  async (req, res) => {
    const centre = await prisma.diagnosticCentre.findUnique({
      where: { id: req.params.id },
      include: { tests: true },
    });
    if (!centre) return res.status(404).json({ error: 'Centre not found' });
    res.json(centre);
  }
);

router.post(
  '/:id/tests',
  requireAuth,
  [param('id').isInt().toInt(), body('name').notEmpty(), body('price').isFloat({ gt: 0 })],
  validate,
  async (req, res) => {
    const centre = await prisma.diagnosticCentre.findUnique({ where: { id: req.params.id } });
    if (!centre) return res.status(404).json({ error: 'Centre not found' });

    const test = await prisma.diagnosticTest.create({
      data: { centreId: centre.id, name: req.body.name, price: req.body.price },
    });
    res.status(201).json(test);
  }
);

router.get(
  '/:id/tests',
  [param('id').isInt().toInt()],
  validate,
  async (req, res) => {
    const centre = await prisma.diagnosticCentre.findUnique({ where: { id: req.params.id } });
    if (!centre) return res.status(404).json({ error: 'Centre not found' });

    const tests = await prisma.diagnosticTest.findMany({ where: { centreId: centre.id } });
    res.json(tests);
  }
);

module.exports = router;
