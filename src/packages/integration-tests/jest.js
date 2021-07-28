const SegfaultHandler = require('segfault-handler')

SegfaultHandler.registerHandler('crash.log')

require('./node_modules/jest/bin/jest.js')