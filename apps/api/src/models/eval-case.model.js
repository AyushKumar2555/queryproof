const mongoose = require('mongoose')

// one labeled question used later to score whether a generated query was right
const evalCaseSchema = new mongoose.Schema(
  {
    question: {
      type:     String,
      required: true,
      trim:     true,
    },

    // drug_enforcement is the FDA drug enforcement index
    indexName: {
      type:     String,
      required: true,
      default:  'drug_enforcement',
      trim:     true,
    },

    // the facts a correct query must capture — not a full Elasticsearch DSL blob
    expected: {
      classification:   { type: String, default: null },
      state:            { type: String, default: null },
      recallingFirm:    { type: String, default: null },
      dateFrom:         { type: String, default: null },
      dateTo:           { type: String, default: null },
      textMustContain:  { type: [String], default: [] },
    },

    notes: {
      type:    String,
      default: '',
    },

    active: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

evalCaseSchema.index({ indexName: 1, active: 1 })

module.exports = mongoose.model('EvalCase', evalCaseSchema)
