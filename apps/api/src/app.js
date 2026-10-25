const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const axios = require('axios')
const config = require('./config')
const { logger, requestLogger } = require('./middleware/logger.middleware')
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware')
const authRoutes = require('./routes/auth.route')
const queryRoutes = require('./routes/query.route')

require('./models')

const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(requestLogger)
app.use(cors({
  origin: allowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/health', sendHealth)
app.use('/api/auth', authRoutes)
app.use('/api', queryRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

function allowedOrigins() {
  if (config.nodeEnv === 'production') {
    return process.env.ALLOWED_ORIGINS?.split(',') || []
  }
  return ['http://localhost:3000', 'http://localhost:8000']
}

async function sendHealth(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    services: {
      mongodb: await mongoStatus(),
      aiService: await aiStatus(),
    },
  }
  if (health.services.mongodb !== 'connected') health.status = 'degraded'
  res.status(health.status === 'ok' ? 200 : 503).json(health)
}

async function mongoStatus() {
  try {
    await mongoose.connection.db.admin().ping()
    return 'connected'
  } catch (err) {
    return 'disconnected'
  }
}

async function aiStatus() {
  try {
    await axios.get(`${config.aiServiceUrl}/health`, { timeout: 2000 })
    return 'connected'
  } catch (err) {
    return 'disconnected'
  }
}

async function connectDatabase() {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  logger.info('database.connected', {
    uri: config.mongoUri.replace(/\/\/.*@/, '//<credentials>@'),
  })
  mongoose.connection.on('error', (err) => {
    logger.error('database.error', { error: err.message })
  })
  mongoose.connection.on('disconnected', () => {
    logger.warn('database.disconnected')
  })
}

module.exports = { app, connectDatabase }
