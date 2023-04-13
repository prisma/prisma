import execa from 'execa'
import globby from 'globby'

async function main() {
  let benchmarks = await globby('./packages/**/*.bench.ts', {
    gitignore: true,
  })

  if (process.argv.length > 2) {
    const filterRegex = new RegExp(process.argv[2])
    benchmarks = benchmarks.filter((name) => filterRegex.test(name))

    if (benchmarks.length === 0) {
      throw new Error(`No benchmarks found that match the pattern ${filterRegex}`)
    }
  }

  await run(benchmarks)
}

async function run(benchmarks: string[]) {
  for (const location of benchmarks) {
    const v8Flags = process.env.CODSPEED_V8_FLAGS ?? '' // Flags defined while running with CodSpeed
    await execa.command(`node ${v8Flags} -r esbuild-register ${location}`, {
      stdio: 'inherit',
    })
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
