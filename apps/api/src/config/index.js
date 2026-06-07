const dotenv = require('dotenv')

dotenv.config()

const config = {
  // server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // ai service — this is where FastAPI is running
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // database
  mongoUri: process.env.MONGO_URI || '',

  // auth
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
}

// fail fast — crash immediately if critical config is missing
// better to crash on startup than get a silent undefined error later
if (!config.mongoUri) {
  console.error('FATAL: MONGO_URI is not set in .env')
  process.exit(1)
}

module.exports = config