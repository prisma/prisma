import execa from 'execa'

/**
 * Runs tests using jest and vitest.
 */
export function main() {
  // We pass the --passWithNoTests flag to jest and vitest for them not to fail
  // when the filter provided via CLI only matches tests in one of the two suites.

  execa.sync('jest', ['--silent', '--passWithNoTests', ...process.argv.slice(2)], {
    preferLocal: true,
    stdio: 'inherit',
    env: process.env,
  })

  execa.sync('vitest', ['run', '--passWithNoTests', ...process.argv.slice(2)], {
    preferLocal: true,
    stdio: 'inherit',
    env: process.env,
  })
}

main()
