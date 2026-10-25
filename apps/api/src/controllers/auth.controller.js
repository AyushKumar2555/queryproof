const authService = require('../services/auth.service')

async function sendRegister(req, res, next) {
  await run(next, async () => {
    const session = await authService.register(req.validated)
    res.status(201).json({ success: true, data: session })
  })
}

async function sendLogin(req, res, next) {
  await run(next, async () => {
    const session = await authService.login(req.validated)
    res.status(200).json({ success: true, data: session })
  })
}

async function run(next, action) {
  try {
    await action()
  } catch (err) {
    next(err)
  }
}

module.exports = { sendRegister, sendLogin }
