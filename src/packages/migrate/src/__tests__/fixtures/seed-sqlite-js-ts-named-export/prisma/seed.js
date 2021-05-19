async function seed() {
  console.log('hello before setTimeout seed.js')
  await new Promise((resolve) => setTimeout(resolve, 1)) // eslint-disable-line @typescript-eslint/no-unused-vars
  console.log('hello after setTimeout seed.js')

  return 'hello from async "seed" named export from seed.js'
}

if (require.main === module) {
  console.debug('hello from require (running as script) from seed.js')
}

module.exports = {
  seed,
}
