function createHttpError(status, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function buildErrorEnvelope(status, message, extra = {}) {
  return {
    error: {
      status,
      message,
      ...extra,
    },
  };
}

module.exports = {
  buildErrorEnvelope,
  createHttpError,
};
