const express = require('express')
const { validate } = require('../middleware/validate.middleware')
const { registerSchema, loginSchema } = require('../types/auth.schema')
const authController = require('../controllers/auth.controller')

const router = express.Router()

router.post('/register', validate(registerSchema), authController.sendRegister)
router.post('/login', validate(loginSchema), authController.sendLogin)

module.exports = router
