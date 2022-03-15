import ts from 'typescript'

function setupTestTypeCheck(fileNames: string[]): void {
  const compilerOptions = ts.convertCompilerOptionsFromJson(
    require('../../../../tsconfig.build.json').compilerOptions,
    '.',
  ).options

  const program = ts.createProgram(fileNames, compilerOptions)

  program.getSemanticDiagnostics().forEach((diagnostic) => {
    console.log(diagnostic)

    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    }
  })
}

if (require.main === module) {
  setupTestTypeCheck(process.argv.slice(2))
}
