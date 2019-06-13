// export type GeneratorWorkerJob = {
//   packagePath: string
//   config: GeneratorConfig
// }
process.on('message', async message => {
  const job = JSON.parse(message)
  console.log({ job })
  try {
    const package = require(job.packagePath)
    const generatorFunction = package.generatorDefinition.generate
    console.log('waiting')
    console.log(generatorFunction)
    await generatorFunction(job.config)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    process.exit(0)
  }
})
