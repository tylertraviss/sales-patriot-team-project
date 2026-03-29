require('dotenv').config();

const express         = require('express');
const cors            = require('cors');
const { version }     = require('../package.json');
const logger          = require('./logger');
const db              = require('./db/connection');
const requestLogger   = require('./middleware/requestLogger');
const awardsRouter    = require('./routes/awards');
const uploadRouter    = require('./routes/upload');
const companiesRouter = require('./routes/companies');
const vendorsRouter   = require('./routes/vendors');
const errorHandler    = require('./middleware/errorHandler');
const { buildErrorEnvelope } = require('./utils/http');

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
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.get('/health/db', async (_req, res) => {
  try {
    await db.query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json(buildErrorEnvelope(503, 'Database connection unavailable'));
  }
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.get('/api', (_req, res) => {
  res.json({
    version,
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

app.use('/api/awards',    awardsRouter);
app.use('/api/upload',    uploadRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/vendors',   vendorsRouter);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json(buildErrorEnvelope(404, 'Route not found'));
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
