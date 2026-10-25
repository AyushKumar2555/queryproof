const mongoose = require('mongoose')

const evalRunSchema = new mongoose.Schema({
  evalCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvalCase',
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  indexName: {
    type: String,
    required: true,
  },
  passed: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  checks: {
    type: [
      {
        name: { type: String, required: true },
        passed: { type: Boolean, required: true },
      },
    ],
    default: [],
  },
  esQuery: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  durationMs: {
    type: Number,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
})

evalRunSchema.index({ createdAt: -1 })
evalRunSchema.index({ evalCaseId: 1, createdAt: -1 })

module.exports = mongoose.model('EvalRun', evalRunSchema)
