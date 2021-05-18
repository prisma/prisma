async function seed() {
  await new Promise((_) => null) // eslint-disable-line @typescript-eslint/no-unused-vars
  return 'hello from async "seed" named export from seed.js'
}

if (require.main === module) {
  console.debug('hello from require (running as script) from seed.js')
}

module.exports = {
  seed,
}
