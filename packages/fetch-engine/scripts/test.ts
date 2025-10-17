import path from 'path'

import { download } from '../src'

void download({
  binaries: {
    'query-engine': path.join(__dirname, '../test'),
    'schema-engine': path.join(__dirname, '../test'),
  },
  showProgress: true,
})
