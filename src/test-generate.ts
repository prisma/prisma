import { generateInThread } from './generateInThread'

import path from 'path'
const env = {
  cwd: process.cwd(),
}

generateInThread({
  packagePath: '@prisma/photon',
  config: {
    cwd: env.cwd,
    generator: {
      config: {},
      name: 'photon',
      output: path.join(env.cwd, '/node_modules/@generated/photon'),
    },
    otherGenerators: [],
  },
}).catch(console.error)
