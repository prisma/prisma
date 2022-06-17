import path from 'path'

import { build, BuildOptions } from '../../../helpers/compile/build'

// const workerBuildConfig_: BuildOptions = {
//   name: 'runtime',
//   entryPoints: ['src/worker/LibraryWorker.ts'],
//   outfile: '/home/millsp/Work/repros/@local/LibraryWorker',
//   bundle: true,
// }

const workerBuildConfig: BuildOptions = {
  name: 'runtime',
  entryPoints: ['src/worker/LibraryWorker.ts'],
  outfile: path.join(__dirname, '..', '..', 'client', 'LibraryWorker'),
  bundle: true,
}

void build([{ name: 'default' }, workerBuildConfig])
