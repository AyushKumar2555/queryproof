const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config')
const User = require('../models/user.model')

async function register(input) {
  const existing = await findByEmail(input.email)
  if (existing) throw conflict('An account with that email already exists')

  try {
    const user = await User.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
    })
    return sessionFor(user)
  } catch (err) {
    if (err.code === 11000) throw conflict('An account with that email already exists')
    throw err
  }
}

async function login(input) {
  const user = await findByEmail(input.email)
  const matches = user && await passwordMatches(input.password, user.passwordHash)
  if (!matches) throw unauthorized('Email or password is wrong')
  return sessionFor(user)
}

function sessionFor(user) {
  return {
    token: signToken(user._id),
    user: {
      id: user._id,
      email: user.email,
    },
  }
}

function findByEmail(email) {
  return User.findOne({ email })
}

function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

function passwordMatches(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  })
}

function conflict(message) {
  const error = new Error(message)
  error.status = 409
  return error
}

function unauthorized(message) {
  const error = new Error(message)
  error.status = 401
  return error
}

module.exports = { register, login }
