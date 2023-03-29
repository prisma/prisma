import execa from 'execa'
import globby from 'globby'
import path from 'path'

async function main() {
  const benchmarks = await globby('./packages/**/*.bench.ts', {
    gitignore: true,
  })
  await run(benchmarks)
}
async function run(benchmarks: string[]) {
  let failedCount = 0

  for (const location of benchmarks) {
    try {
      await execa.command(`node -r esbuild-register ${location}`, {
        stdio: 'inherit',
      })
    } catch (e) {
      console.error(e)
      failedCount++
    }
  }

  if (failedCount > 0) {
    const pluralMarker = failedCount === 1 ? '' : 's'
    throw new Error(`${failedCount} benchmark${pluralMarker} failed`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
