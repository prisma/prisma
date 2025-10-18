import path from 'path'

import { download } from '../src'

void download({
  binaries: {
    'schema-engine': path.join(__dirname, '../test'),
  },
  showProgress: true,
})
