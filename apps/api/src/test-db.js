const mongoose = require('mongoose')
const config = require('./src/config/index')

mongoose.connect(config.mongoUri)
  .then(() => {
    console.log('MongoDB connected successfully')
    process.exit(0)
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })