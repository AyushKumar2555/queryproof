const mongoose = require('mongoose')
const { app, connectDatabase } = require('./app')
const config = require('./config')
const { logger } = require('./middleware/logger.middleware')

startServer()

async function startServer() {
  try {
    await connectDatabase()
    const server = listen()
    watchShutdown(server)
  } catch (err) {
    logger.error('server.startup_failed', { error: err.message })
    console.error('Failed to start server:', err.message)
    process.exit(1)
  }
}

function listen() {
  return app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`)
    console.log(`AI Service: ${config.aiServiceUrl}`)
    console.log(`Elasticsearch: ${config.elasticsearchUrl}`)
  })
}

function watchShutdown(server) {
  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${config.port} is already in use` : err.message)
    process.exit(1)
  })
  process.on('SIGINT', () => shutdown(server))
  process.on('SIGTERM', () => shutdown(server))
  process.on('uncaughtException', (err) => {
    logger.error('process.uncaught_exception', { error: err.message })
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason: reason?.message || reason })
    process.exit(1)
  })
}

async function shutdown(server) {
  server.close()
  await mongoose.connection.close()
  process.exit(0)
}
