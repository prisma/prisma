function seed() {
  return 'hello from "seed" named export from seed.js'
}

if (require.main === module) {
  console.debug('hello from require (running as script) from seed.js')
}

module.exports = seed
