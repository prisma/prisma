// Using parseArgs would be better, but it's only available in v18.3.0, v16.17.0 and up
// https://nodejs.org/api/util.html#utilparseargsconfig
// import { parseArgs } from 'node:util';

async function main() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  console.log('Hello from seed.js')

  // From package.json
  if (!process.argv.find((arg) => arg.startsWith('--my-custom-arg-from-config-1'))) {
    throw new Error(`Missing custom arg --my-custom-arg-from-config-1 (from package.json)`)
  }
  if (!process.argv.find((arg) => arg.startsWith('--my-custom-arg-from-config-2'))) {
    throw new Error(`Missing custom arg --my-custom-arg-from-config-2 (from package.json)`)
  }
  if (!process.argv.includes('-y')) {
    throw new Error(`Missing custom arg -y (from package.json)`)
  }

  // From CLI call
  if (!process.argv.find((arg) => arg.startsWith('--my-custom-arg-from-cli-1'))) {
    throw new Error(`Missing custom arg --my-custom-arg-from-cli (from CLI call)`)
  }
  if (!process.argv.find((arg) => arg.startsWith('--my-custom-arg-from-cli-2'))) {
    throw new Error(`Missing custom arg --my-custom-arg-from-cli (from CLI call)`)
  }
  if (!process.argv.includes('-z')) {
    throw new Error(`Missing custom arg -z (from CLI call)`)
  }
}

main()
  .then(() => console.log('Goodbye from seed.js'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
