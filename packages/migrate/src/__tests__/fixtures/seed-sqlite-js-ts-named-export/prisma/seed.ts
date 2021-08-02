// So we don't need to install @types/node
declare const require: any
declare const module: any

async function seed() {
  console.log('hello before setTimeout seed.ts')
  await new Promise((resolve) => setTimeout(resolve, 1)) // eslint-disable-line @typescript-eslint/no-unused-vars
  console.log('hello after setTimeout seed.ts')

  return 'hello from async "seed" named export from seed.ts'
}

if (require.main === module) {
  console.debug('hello from require (running as script) from seed.ts')
}

export { seed }
