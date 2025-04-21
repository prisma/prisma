import { build } from '../../../helpers/compile/build'

const buildOptions = {
  name: 'default',
  bundle: true,
  external: ['@opentelemetry/instrumentation'],
}

void build([
  { ...buildOptions, format: 'cjs', emitTypes: true, outExtension: { '.js': '.js' } },
  { ...buildOptions, format: 'esm', outExtension: { '.js': '.mjs' } },
])
