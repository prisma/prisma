// So we don't need to install @types/node
declare const require: any
declare const module: any

async function seed() {
  await new Promise((_) => null) // eslint-disable-line @typescript-eslint/no-unused-vars
  return 'hello from async "seed" named export from seed.ts'
}

if (require.main === module) {
  console.debug('hello from require (running as script) from seed.ts')
}

export { seed }
