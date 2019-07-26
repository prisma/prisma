import { download } from '../src'
import path from 'path'

download({
  binaries: {
    'query-engine': path.join(__dirname, '../test'),
    'migration-engine': path.join(__dirname, '../test'),
  },
  platforms: ['darwin', 'linux-glibc-libssl1.0.1', 'linux-glibc-libssl1.0.2', 'linux-glibc-libssl1.1.0'],
  showProgress: true,
})
