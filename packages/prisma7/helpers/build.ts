import fs from 'node:fs'

import type * as esbuild from 'esbuild'

import { build } from '../../../helpers/compile/build'

const executablePlugin: esbuild.Plugin = {
  name: 'executable',
  setup(build) {
    build.onEnd(() => {
      const filename = './build/index.js'
      const mode = fs.statSync(filename).mode
      fs.chmodSync(filename, mode | 0o111)
    })
  },
}

void build([
  {
    name: 'prisma7',
    entryPoints: ['src/bin.ts'],
    outfile: 'build/index',
    bundle: true,
    external: ['prisma/build/index.js'],
    emitTypes: false,
    minify: true,
    plugins: [executablePlugin],
  },
  {
    name: 'prisma7-types',
    entryPoints: ['src/index.ts'],
    outfile: 'index',
    bundle: true,
    external: ['prisma'],
    minify: true,
  },
  {
    name: 'prisma7-config',
    entryPoints: ['src/config.ts'],
    outfile: 'config',
    bundle: true,
    external: ['prisma'],
    minify: true,
  },
])
