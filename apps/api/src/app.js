const express = require('express')
const mongoose = require('mongoose')
const config = require('./config')
const { logger, requestLogger } = require('./middleware/logger.middleware')
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware')
const queryRoutes = require('./routes/query.route')

const app = express()

// ============================================
// Core Middleware (order matters!)
// ============================================

// 1. Parse JSON bodies — must come before routes
//    limits payload to 1mb to prevent abuse
app.use(express.json({ limit: '1mb' }))

// 2. Parse URL-encoded bodies (form data) — rarely used in APIs but good to have
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// 3. Request logging — logs every incoming request
//    placed after body parsers so we can log request size if needed
app.use(requestLogger)

// ============================================
// CORS Configuration
// ============================================
// Allows the frontend (or AI service in dev) to call this API
// In production, replace with specific origins
const cors = require('cors')
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000', 'http://localhost:8000'],
  credentials: true, // allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ============================================
// Health Check (before routes — no auth needed)
// ============================================
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    services: {
      mongodb: 'unknown',
      aiService: 'unknown',
    },
  }

  // check MongoDB connection
  try {
    await mongoose.connection.db.admin().ping()
    health.services.mongodb = 'connected'
  } catch (err) {
    health.services.mongodb = 'disconnected'
    health.status = 'degraded'
  }

  // check AI service (non-blocking)
  try {
    const axios = require('axios')
    await axios.get(`${config.aiServiceUrl}/health`, { timeout: 2000 })
    health.services.aiService = 'connected'
  } catch (err) {
    health.services.aiService = 'disconnected'
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
})

// ============================================
// API Routes
// ============================================
// All query-related routes under /api
// This makes it easy to version the API later (/api/v2, etc.)
app.use('/api', queryRoutes)

// ============================================
// 404 Handler (must be after all routes)
// ============================================
// Catches any request that didn't match a route above
app.use(notFoundHandler)

// ============================================
// Global Error Handler (must be LAST middleware)
// ============================================
// Express recognizes error handlers by the 4 params (err, req, res, next)
// This MUST be the last app.use() call
app.use(errorHandler)

// ============================================
// MongoDB Connection
// ============================================
// Exported so server.js can call it before starting the server
async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri, {
      // these options help with connection stability
      serverSelectionTimeoutMS: 5000, // fail fast if MongoDB is down
      socketTimeoutMS: 45000,         // close sockets after 45s of inactivity
    })

    logger.info('database.connected', {
      uri: config.mongoUri.replace(/\/\/.*@/, '//<credentials>@'), // hide credentials in logs
    })

    // mongoose connection events for monitoring
    mongoose.connection.on('error', (err) => {
      logger.error('database.error', { error: err.message })
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('database.disconnected')
    })

    // graceful shutdown — close DB connection when process ends
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      logger.info('database.disconnected.graceful')
      process.exit(0)
    })

  } catch (err) {
    logger.error('database.connection_failed', {
      error: err.message,
      uri: config.mongoUri,
    })
    throw err // re-throw so server.js knows connection failed
  }
}

module.exports = { app, connectDatabase }
