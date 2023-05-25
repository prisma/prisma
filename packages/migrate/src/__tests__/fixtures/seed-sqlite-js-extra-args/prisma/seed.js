async function main() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  console.log('Hello from seed.js')

  if (!process.argv.includes('--my-custom-arg-from-config=my-value')) {
    throw new Error(`Missing custom arg --my-custom-arg-from-config=my-value (from package.json)`)
  }

  if (!process.argv.includes('-z')) {
    throw new Error(`Missing custom arg -z (from package.json)`)
  }

  if (!process.argv.includes('--my-custom-arg-from-cli=my-value')) {
    throw new Error(`Missing custom arg --my-custom-arg-from-cli=my-value (from CLI call)`)
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
