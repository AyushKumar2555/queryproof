const { logger } = require('./logger.middleware')

// factory function — takes a Zod schema, returns an Express middleware
// usage in routes: router.post('/analyze', validate(analyzeSchema), handler)
const validate = (schema) => {
  return (req, res, next) => {
    // safeParse never throws — returns { success, data, error }
    // parse() throws on failure — we don't want that in middleware
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        field:   err.path.join('.'),
        message: err.message,
      }))

      logger.warn('validation.failed', {
        path:   req.path,
        errors,
      })

      // 400 — bad request, user sent wrong data
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      })
    }

    // attach validated and cleaned data to req — 
    // downstream code uses req.validated instead of req.body
    // this ensures only schema-approved fields reach your service
    req.validated = result.data
    next()
  }
}

module.exports = { validate }