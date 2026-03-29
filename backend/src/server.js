require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const logger     = require('./logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler  = require('./middleware/errorHandler');

const vendorsRouter    = require('./routes/vendors');
const awardsRouter     = require('./routes/awards');
const agenciesRouter   = require('./routes/agencies');
const naicsRouter      = require('./routes/naics');
const uploadRouter     = require('./routes/upload');

const analyticsRouter = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(requestLogger);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Standard endpoints
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime_seconds: Math.floor(process.uptime()) });
});

app.get('/health/db', async (_req, res, next) => {
  try {
    const db = require('./db/connection');
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() });
    next(err);
  }
});

app.get('/api', (_req, res) => {
  res.json({
    version: '1.0.0',
    resources: [
      'GET /api/vendors',
      'GET /api/awards',
      'GET /api/agencies',
      'GET /api/naics',
    ],
    analytics: [
      'GET /api/analytics/investment-scores',
      'GET /api/analytics/emerging-winners',
      'GET /api/analytics/risk-profile/:cage_code',
      'GET /api/analytics/sector-heatmap',
      'GET /api/analytics/win-rate/:cage_code',
      'GET /api/analytics/geographic-clustering',
    ],
  });
});

// ---------------------------------------------------------------------------
// REST routes
// ---------------------------------------------------------------------------
app.use('/api/vendors',   vendorsRouter);
app.use('/api/awards',    awardsRouter);
app.use('/api/agencies',  agenciesRouter);
app.use('/api/naics',     naicsRouter);
app.use('/api/upload',    uploadRouter);

// ---------------------------------------------------------------------------
// Analytics routes
// ---------------------------------------------------------------------------
app.use('/api/analytics', analyticsRouter);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: { status: 404, message: 'Route not found' } });
});

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`DLA Awards API listening`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});

module.exports = app;
