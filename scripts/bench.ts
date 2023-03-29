import execa from 'execa'
import globby from 'globby'

async function main() {
  const benchmarks = await globby('./packages/**/*.bench.ts', {
    gitignore: true,
  })
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
