const { logger } = require('./logger.middleware')

// global error handler — must have exactly 4 params for Express to recognize it
// registered LAST in app.js after all routes
const errorHandler = (err, req, res, next) => {
  // log the full error including stack trace for debugging
  logger.error('unhandled.error', {
    message: err.message,
    path:    req.path,
    method:  req.method,
    // stack trace only in development — never expose internals in production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })

  // use status attached to error if available, otherwise default to 500
  // example: const err = new Error('Not found'); err.status = 404; next(err)
  const status = err.status || err.statusCode || 500

  // never expose raw error messages in production — they leak internal details
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'An unexpected error occurred'
      : err.message || 'An unexpected error occurred'

  res.status(status).json({
    success: false,
    message,
    // only include error code if explicitly set — useful for frontend handling
    ...(err.code && { code: err.code }),
  })
}

// 404 handler — catches any request that didn't match a route
// must be registered AFTER all routes but BEFORE errorHandler
const notFoundHandler = (req, res, next) => {
  const err = new Error(`Route ${req.method} ${req.path} not found`)
  err.status = 404
  // pass to errorHandler instead of responding directly
  next(err)
}

module.exports = { errorHandler, notFoundHandler }