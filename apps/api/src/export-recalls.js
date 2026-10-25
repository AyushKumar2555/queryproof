const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
const outputPath = path.join(__dirname, '../../../infra/elasticsearch/drug_enforcement.documents.json')

extractDocuments()

async function extractDocuments() {
  try {
    const documents = await readAllDocuments()
    writeDocuments(documents)
    console.log(`Wrote ${documents.length} documents to ${outputPath}`)
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  } finally {
    process.exit(process.exitCode || 0)
  }
}

async function readAllDocuments() {
  const documents = []
  const size = 200

  for (let from = 0; ; from += size) {
    const hits = await readPage(from, size)
    documents.push(...hits.map(asDocument))
    if (hits.length < size) return documents
  }
}

async function readPage(from, size) {
  const response = await fetch(`${elasticsearchUrl}/drug_enforcement/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      size,
      sort: [{ recall_number: 'asc' }],
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Elasticsearch returned ${response.status}: ${detail.slice(0, 300)}`)
  }

  const payload = await response.json()
  return payload.hits?.hits || []
}

function asDocument(hit) {
  return { _id: hit._id, _source: hit._source }
}

function writeDocuments(documents) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2))
}
