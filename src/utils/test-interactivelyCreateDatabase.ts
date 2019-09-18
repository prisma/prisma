import { askToCreateDb, interactivelyCreateDatabase } from './ensureDatabaseExists'

async function main() {
  const result = await interactivelyCreateDatabase('', 'unapply')

  console.log(result)
}

main()
