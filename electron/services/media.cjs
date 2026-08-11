const index = require('./media/index.cjs')
const operations = require('./media/operations.cjs')
const trash = require('./media/trash.cjs')

module.exports = { ...index, ...operations, ...trash }
