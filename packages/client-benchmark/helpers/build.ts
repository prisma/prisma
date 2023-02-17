import { build, BuildOptions } from '../../../helpers/compile/build'

const cliConfig: BuildOptions = {
  name: 'measure-cli',
  outfile: 'dist/measureCli',
  entryPoints: ['./src/measureCli'],
  bundle: true,
}

const measureLocalConfig: BuildOptions = {
  name: 'local',
  outfile: 'dist/measureLocal',
  entryPoints: ['./src/measurementsScripts/local'],
  bundle: true,
  target: 'esnext',
  format: 'esm',
  outExtension: {
    '.js': '.mjs',
  },
  external: ['./prisma/client', './node_modules/@prisma/instrumentation/dist/index.js'],
  banner: {
    js: `
    import path from 'path';
    import { fileURLToPath } from 'url';
    import { createRequire as topLevelCreateRequire } from 'module';
    const require = topLevelCreateRequire(import.meta.url);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    `,
  },
}

const measureLambdaConfig: BuildOptions = {
  name: 'local',
  outfile: 'dist/measureLambda',
  outExtension: {
    '.js': '.mjs',
  },
  entryPoints: ['./src/measurementsScripts/lambda'],
  bundle: true,
  external: ['./prisma/client', './node_modules/@prisma/instrumentation/dist/index.js'],
  target: 'esnext',
  format: 'esm',
  banner: {
    js: `
    import path from 'path';
    import { fileURLToPath } from 'url';
    import { createRequire as topLevelCreateRequire } from 'module';
    const require = topLevelCreateRequire(import.meta.url);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    `,
  },
}

void build([cliConfig, measureLocalConfig, measureLambdaConfig])
