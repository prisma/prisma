async function main() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  console.log('Hello from seed.js')
}

main()
  .then(() => console.log('Goodbye from seed.js'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
