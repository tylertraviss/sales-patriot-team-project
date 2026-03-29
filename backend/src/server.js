require('dotenv').config();

const express         = require('express');
const cors            = require('cors');
const logger          = require('./logger');
const requestLogger   = require('./middleware/requestLogger');
const errorHandler    = require('./middleware/errorHandler');

const awardsRouter    = require('./routes/awards');
const vendorsRouter   = require('./routes/vendors');
const agenciesRouter  = require('./routes/agencies');
const naicsRouter     = require('./routes/naics');
const analyticsRouter = require('./routes/analytics');
const dashboardRouter = require('./routes/dashboard');
const agentRouter     = require('./routes/agent');

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
      'GET /api/vendors/id/:vendorId',
      'GET /api/awards',
      'GET /api/agencies',
      'GET /api/naics',
    ],
    analytics: [
      'GET /api/analytics/filters',
      'GET /api/analytics/opportunity-heatmap',
      'GET /api/analytics/investment-scores',
      'GET /api/analytics/emerging-winners',
      'GET /api/analytics/vendor-moat',
      'GET /api/analytics/risk-profile/vendor/:vendorId',
      'GET /api/analytics/risk-profile/:cage_code',
      'GET /api/analytics/sole-source-opportunities',
      'GET /api/analytics/market-concentration',
      'GET /api/analytics/win-rate/:cage_code',
      'GET /api/analytics/geographic-clustering',
      'GET /api/analytics/naics-trends',
      'GET /api/analytics/repeat-winners',
      'GET /api/analytics/revenue-stability/vendor/:vendorId',
      'GET /api/analytics/sector-heatmap',
    ],
  });
});

// ---------------------------------------------------------------------------
// REST routes
// ---------------------------------------------------------------------------
app.use('/api/awards',     awardsRouter);
app.use('/api/vendors',    vendorsRouter);
app.use('/api/agencies',   agenciesRouter);
app.use('/api/naics',      naicsRouter);

// ---------------------------------------------------------------------------
// Analytics routes
// ---------------------------------------------------------------------------
app.use('/api/analytics',  analyticsRouter);

// ---------------------------------------------------------------------------
// Dashboard routes
// ---------------------------------------------------------------------------
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/agent',      agentRouter);

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
