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
  for (const location of benchmarks) {
    await execa.command(`pnpm ts-node ${location}`, {
      cwd: path.join(__dirname, `..`),
      stdio: 'inherit',
    })
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
