const client = getPrismaClient({
  dirname: testSuitePath,
  schemaString: schema,
  document: dmmf,
  generator: generator,
  activeProvider: suiteConfig['#PROVIDER'],
  datasourceNames: config.datasources.map((d) => d.name),
  relativeEnvPaths: {},
  relativePath: '.',
}) as any

export {}
