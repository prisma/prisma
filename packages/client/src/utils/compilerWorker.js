const { createCompilerHost, createProgram, convertCompilerOptionsFromJson } = require('typescript')
const ts = require('typescript')
const tsconfig = require('../../../../tsconfig.build.regular.json')

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
    throw new Error('Compilation Error\n' + formatted)
  }
}

compileFile(process.argv[2])
