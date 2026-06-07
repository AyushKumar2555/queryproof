const { app, connectDatabase } = require('./app')
const config = require('./config')
const { logger } = require('./middleware/logger.middleware')

// ============================================
// Startup Sequence
// ============================================
// 1. Connect to MongoDB first
// 2. Then start the HTTP server
// This ensures we don't accept requests before the DB is ready

async function startServer() {
  try {
    // Step 1: Connect to MongoDB
    // If this fails, the catch block will log and exit
    await connectDatabase()

    // Step 2: Start the server
    const server = app.listen(config.port, () => {
      logger.info('server.started', {
        port: config.port,
        env: config.nodeEnv,
        aiServiceUrl: config.aiServiceUrl,
        mongoUri: config.mongoUri.replace(/\/\/.*@/, '//<credentials>@'), // hide credentials
      })

      console.log(`\nServer running on http://localhost:${config.port}`)
      console.log(`Environment: ${config.nodeEnv}`)
      console.log(`AI Service: ${config.aiServiceUrl}`)
      console.log(`MongoDB: connected\n`)
    })

    // ============================================
    // Server Error Handling
    // ============================================
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error('server.port_in_use', { port: config.port })
        console.error(`Port ${config.port} is already in use`)
        process.exit(1)
      } else {
        logger.error('server.error', { error: err.message })
        console.error('Server error:', err.message)
      }
    })

    // ============================================
    // Graceful Shutdown
    // ============================================
    // Handles Ctrl+C (SIGINT) and termination signals (SIGTERM)
    // Gives the server time to finish ongoing requests before shutting down
    const shutdown = async (signal) => {
      logger.info('server.shutdown.initiated', { signal })

      // Stop accepting new connections
      server.close(() => {
        logger.info('server.closed')
      })

      // Close MongoDB connection
      try {
        await require('mongoose').connection.close()
        logger.info('database.disconnected.shutdown')
      } catch (err) {
        logger.error('database.close.failed', { error: err.message })
      }

      logger.info('server.shutdown.complete')
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))   // Ctrl+C
    process.on('SIGTERM', () => shutdown('SIGTERM')) // Docker stop, kill command

    // Handle uncaught exceptions and unhandled rejections
    // These are "crash the app" scenarios — log and exit
    process.on('uncaughtException', (err) => {
      logger.error('process.uncaught_exception', {
        error: err.message,
        stack: err.stack,
      })
      process.exit(1)
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('process.unhandled_rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
      })
      process.exit(1)
    })

  } catch (err) {
    // If MongoDB connection fails during startup, crash immediately
    // Better to fail fast than run in a broken state
    logger.error('server.startup_failed', {
      error: err.message,
    })
    console.error('Failed to start server:', err.message)
    process.exit(1)
  }
}

// Start the server
startServer()
