import { ProcessContextSettings } from '@prisma/get-platform'

export const stdoutNormalizationRules: ProcessContextSettings = {
  normalizationRules: [
    ['🌱  ', ''],
    ['🚀  ', ''],
    [/\\/g, '/'], // normalize path separators on windows
    [/(Datasource.*)(at ".*")/g, '$1<location placeholder>'],
    [/(Datasource.*)(using driver adapter ".*")/g, '$1<location placeholder>'],
    [/Applying migration .*\n/g, ''], // TODO: only logged by Rust engine - shall we log this in wasm, too?
    [/\nSQLite database .* created at .*\n/g, ''], // TODO: only logged by Rust engine - shall we log this in wasm, too?
  ],
}
