const prisma = require('.prisma/client')
const path = require('path')

module.exports = prisma

/**
 * Annotation for ncc/zeit
 */
path.join(__dirname, '../../.prisma/client/schema.prisma')
path.join(__dirname, '../../../.prisma/client/schema.prisma')
path.join(__dirname, '../../../../.prisma/client/schema.prisma')
