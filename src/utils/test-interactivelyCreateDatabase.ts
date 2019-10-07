import { askToCreateDb, interactivelyCreateDatabase } from './ensureDatabaseExists'

async function main() {
  const result = await interactivelyCreateDatabase('', 'unapply', true)

  console.log(result)
}

main()
