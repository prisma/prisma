import fs from 'node:fs/promises'
import path from 'node:path'

import { build } from '../../../helpers/compile/build'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: true,
    outfile: 'dist/index',
    entryPoints: ['src/index.ts'],
    external: ['esbuild', 'esbuild-register'],
  },
]).then(async () => {
  for (const filename of await fs.readdir(path.join(__dirname, '..', 'dist'))) {
    if (filename.endsWith('.d.ts') && filename !== 'index.d.ts') {
      await fs.unlink(path.join(__dirname, '..', 'dist', filename))
    }
  }
})
