// export type GeneratorWorkerJob = {
//   packagePath: string
//   config: GeneratorConfig
// }
process.on('message', async (message) => {
  const job /*: GeneratorWorkerJob*/ = JSON.parse(message)
  try {
    const package = require(job.packagePath)
    const generatorFunction = package.generatorDefinition.generate
    await generatorFunction(job.config)
    process.exit(0)
  } catch (e) {
    process.send(JSON.stringify({ error: e.toString() }))
    process.exit(1)
  }
})
