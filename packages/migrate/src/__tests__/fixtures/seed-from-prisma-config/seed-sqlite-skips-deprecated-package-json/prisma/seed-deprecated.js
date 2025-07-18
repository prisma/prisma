async function main() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  console.log('Hello from seed-deprecated.js')
}

main()
  .then(() => console.log('Goodbye from seed-deprecated.js'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
