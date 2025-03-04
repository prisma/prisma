const ts = require('typescript')
const tsconfig = require('../../../../tsconfig.build.regular.json')

const { createCompilerHost, createProgram, convertCompilerOptionsFromJson } = ts

function compileFile(filePath) {
  const options = {
    ...convertCompilerOptionsFromJson(tsconfig.compilerOptions).options,
    lib: tsconfig.compilerOptions.lib.map((lib) => `lib.${lib.toLowerCase()}.d.ts`),
    noEmitOnError: true,
  }

  const compilerHost = createCompilerHost(options)
  compilerHost.writeFile = () => {}

  const program = createProgram([filePath], options, compilerHost)
  const result = program.emit()

  if (result.diagnostics.length > 0) {
    const formatted = ts.formatDiagnostics(result.diagnostics, compilerHost)
    throw new Error(`Compilation Error\n${formatted}`)
  }
}

module.exports = compileFile

if (require.main === module) {
  compileFile(process.argv[2])
}
