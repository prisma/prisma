'use strict'
module.exports = {
  ...require('./default'),
  snapshotSerializers: ['@prisma/get-platform/src/test-utils/jestSnapshotSerializer'],
}
