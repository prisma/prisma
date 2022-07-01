import path from 'path'

import { download } from '../src'

void download({
  engines: {
    'query-engine': path.join(__dirname, '../test'),
    'migration-engine': path.join(__dirname, '../test'),
  },
  binaryTargets: [
    'darwin',
    'windows',
    'debian-openssl-1.0.x',
    'debian-openssl-1.1.x',
    'debian-openssl-3.0.x',
    'rhel-openssl-1.0.x',
    'rhel-openssl-1.1.x',
    'rhel-openssl-3.0.x',
    'linux-musl',
  ],
  showProgress: true,
})
