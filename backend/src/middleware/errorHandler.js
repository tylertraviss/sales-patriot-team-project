const logger = require('../logger');
const { buildErrorEnvelope } = require('../utils/http');

/**
 * Central Express error handler.
 * Must be registered as the LAST middleware in server.js.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const meta = {
    requestId:  req.id,
    method:     req.method,
    url:        req.originalUrl,
    statusCode: status,
    errorCode:  err.code,
  };

  if (status >= 500) {
    logger.error(message, { ...meta, stack: err.stack });
  } else {
    logger.warn(message, meta);
  }

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json(
      buildErrorEnvelope(413, 'File too large. Maximum upload size is 500 MB.'),
    );
  }

  // PostgreSQL foreign-key violation
  if (err.code === '23503') {
    return res.status(422).json(
      buildErrorEnvelope(422, 'Referenced record does not exist.', { detail: err.detail }),
    );
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json(
      buildErrorEnvelope(409, 'Duplicate record.', { detail: err.detail }),
    );
  }

  const extra = {};

  if (err.detail) {
    extra.detail = err.detail;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    extra.stack = err.stack;
  }

  res.status(status).json(buildErrorEnvelope(status, message, extra));
}

module.exports = errorHandler;
