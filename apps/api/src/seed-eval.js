const path = require('path')
const mongoose = require('mongoose')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const config = require('./config')
const EvalCase = require('./models/eval-case.model')

seedInsulinCase()

async function seedInsulinCase() {
  try {
    await connect()
    const created = await insertInsulinCase()
    console.log(created ? 'Inserted the insulin eval case' : 'Insulin eval case already exists')
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
    process.exit(process.exitCode || 0)
  }
}

async function connect() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
}

async function insertInsulinCase() {
  const evalCase = insulinCase()
  const existing = await EvalCase.findOne({
    question: evalCase.question,
    indexName: evalCase.indexName,
  })
  if (existing) return false
  await EvalCase.create(evalCase)
  return true
}

function insulinCase() {
  return {
    question: 'Class I insulin recalls in Texas during 2024',
    indexName: 'drug_enforcement',
    expected: {
      classification: 'Class I',
      state: 'TX',
      recallingFirm: null,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      textMustContain: ['insulin'],
    },
    active: true,
  }
}
