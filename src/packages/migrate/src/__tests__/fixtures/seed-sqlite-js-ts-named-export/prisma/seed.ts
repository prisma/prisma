// So we don't need to install @types/node
declare const require: any
declare const module: any

function seed() {
  return 'hello from "seed" named export from seed.ts'
}

if (require.main === module) {
  console.debug('hello from require (running as script) from seed.ts')
}

export { seed }
