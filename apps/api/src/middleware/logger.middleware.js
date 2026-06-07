const winston = require('winston')

// winston logger instance — one shared logger for the whole app
// transports define WHERE logs go — console for now, file/cloud in production
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    // in production output JSON — easier to search in log tools
    // in development output colorized text — easier to read in terminal
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
            return `${timestamp} [${level}]: ${message} ${metaStr}`
          })
        )
  ),
  transports: [new winston.transports.Console()],
})

// Express middleware — logs every incoming request and its response
// next() must be called — without it the request hangs forever
const requestLogger = (req, res, next) => {
  const start = Date.now()

  // log when response finishes — this gives us accurate duration
  res.on('finish', () => {
    const duration = Date.now() - start

    logger.info('http.request', {
      method:   req.method,
      path:     req.path,
      status:   res.statusCode,
      duration: `${duration}ms`,
      // never log full body — may contain passwords or sensitive data
      ip: req.ip,
    })
  })

  next()
}

module.exports = { logger, requestLogger }