import { spawnSync } from 'node:child_process'

// We pass the --passWithNoTests flag to jest and vitest for them not to fail
// when the filter provided via CLI only matches tests in one of the two suites.
function main() {
  const result1 = spawnSync('jest', ['--verbose', '--passWithNoTests', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
  })

  if (result1.status !== 0) {
    process.exit(result1.status ?? 1)
  }

  const result2 = spawnSync('vitest', ['run', '--passWithNoTests', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
  })

  if (result2.status !== 0) {
    process.exit(result2.status ?? 1)
  }
}

main()
