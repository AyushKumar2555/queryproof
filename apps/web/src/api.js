const TOKEN_KEY = 'queryproof.token'

export function readToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function register(email, password) {
  const body = await askApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return body.data
}

export async function login(email, password) {
  const body = await askApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return body.data
}

export async function analyzeQuestion(question) {
  const body = await askApi('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ naturalLanguageQuery: question }),
  })
  return body.data
}

export async function loadHistory() {
  const body = await askApi('/api/history')
  return {
    records: body.data || [],
    total: body.pagination?.total ?? 0,
  }
}

export async function scoreCases() {
  const body = await askApi('/api/eval', { method: 'POST' })
  return body.data || []
}

async function askApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  })
  const body = await readJson(response)
  if (!response.ok || body.success === false) {
    throw apiError(body.message || 'The API could not answer that question', response.status)
  }
  return body
}

function authHeaders() {
  const token = readToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function apiError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
