import execa from 'execa'
import globby from 'globby'
import path from 'path'

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
    await execa.command(`node -r esbuild-register ${location}`, {
      stdio: 'inherit',
    })
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
