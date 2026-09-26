const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const centreRoutes = require('./routes/centres');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRoutes);
  app.use('/centres', centreRoutes);
  app.use('/bookings', bookingRoutes);
  app.use('/payments', paymentRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
