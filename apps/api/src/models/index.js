// load every model once so Mongoose registers indexes at connection time
require('./query.model')
require('./eval-case.model')
require('./eval-run.model')