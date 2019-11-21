import { download } from '../src'
import path from 'path'

download({
  binaries: {
    'query-engine': path.join(__dirname, '../test'),
    'migration-engine': path.join(__dirname, '../test'),
  },
  binaryTargets: ['darwin', 'windows', 'debian-openssl-1.0.x', 'debian-openssl-1.1.x', 'rhel-openssl-1.0.x', 'rhel-openssl-1.1.x'],
  showProgress: true,
})
