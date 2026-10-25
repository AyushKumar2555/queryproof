const { z } = require('zod')

const registerSchema = z.object({
  email: emailField(),
  password: passwordField(),
})

const loginSchema = z.object({
  email: emailField(),
  password: passwordField(),
})

function emailField() {
  return z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'))
}

function passwordField() {
  return z.string().min(8, 'Password must be at least 8 characters').max(200)
}

module.exports = { registerSchema, loginSchema }
