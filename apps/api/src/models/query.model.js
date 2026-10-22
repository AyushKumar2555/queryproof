const mongoose = require('mongoose')

// defines the shape of a query history document in MongoDB
const queryHistorySchema = new mongoose.Schema(
  {
    // the original natural language input from the user
    naturalLanguageQuery: {
      type:     String,
      required: true,
      trim:     true,
    },

    // which Elasticsearch index this question was about
    indexName: {
      type:    String,
      default: null,
      trim:    true,
    },

    // optional — index mapping the user provided
    indexMapping: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },

    // the full response from the FastAPI AI service
    result: {
      esQuery:            mongoose.Schema.Types.Mixed,
      explanation:        String,
      performanceIssues:  mongoose.Schema.Types.Mixed,
      optimizations:      mongoose.Schema.Types.Mixed,
      mappingSuggestions: mongoose.Schema.Types.Mixed,
    },

    // how long the AI service took to respond in milliseconds
    durationMs: {
      type: Number,
    },

    // which LLM provider was used — gemini, openai, mock etc
    provider: {
      type:    String,
      default: 'unknown',
    },

    // for future auth — which user made this query
    // optional for now, required after we add auth
    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    // automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
)

// history is always read newest-first
queryHistorySchema.index({ createdAt: -1 })
// stats and later filters group by these
queryHistorySchema.index({ provider: 1, createdAt: -1 })
queryHistorySchema.index({ indexName: 1, createdAt: -1 })

module.exports = mongoose.model('QueryHistory', queryHistorySchema)