const jwt = require('jsonwebtoken')
const config = require('../config')

function requireUser(req, res, next) {
  const token = readBearer(req.headers.authorization)
  if (!token) return next(unauthorized())

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    if (!payload.sub) return next(unauthorized())
    req.userId = payload.sub
    next()
  } catch {
    next(unauthorized())
  }
}

function readBearer(header) {
  if (!header || !header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

function unauthorized() {
  const error = new Error('Sign in required')
  error.status = 401
  return error
}

module.exports = { requireUser }
