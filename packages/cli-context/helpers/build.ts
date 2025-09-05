import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'

import { build } from '../../../helpers/compile/build'
import { unbundledConfig } from '../../../helpers/compile/configs'

const [cjs, esm] = unbundledConfig

void (async () => {
  await build([esm])
  for (const file of await readdir('dist')) {
    if (file.endsWith('.d.ts')) {
      await rename(path.join('dist', file), path.join('dist', file.replace('.d.ts', '.d.mts')))
    }
  }
  await build([cjs])
})()
