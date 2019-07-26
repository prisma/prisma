const { performance } = require('perf_hooks')
const { getPlatform } = require('./dist')

async function main() {
  const before = performance.now()
  const platform = await getPlatform()
  const after = performance.now()

  console.log(`${after - before}ms ${platform}`)
}

main()
