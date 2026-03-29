const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

/**
 * Assigns a unique request ID to every request and logs:
 *   - incoming request (method, url, ip)
 *   - outgoing response (status, duration)
 */
function requestLogger(req, res, next) {
  req.id = uuidv4();
  const start = Date.now();

  logger.info('request received', {
    requestId: req.id,
    method:    req.method,
    url:       req.originalUrl,
    ip:        req.ip,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level]('request completed', {
      requestId:  req.id,
      method:     req.method,
      url:        req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}

module.exports = requestLogger;
