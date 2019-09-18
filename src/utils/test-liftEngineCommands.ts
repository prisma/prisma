import { canConnectToDatabase, createDatabase } from '../liftEngineCommands'

async function main2() {
  const result = await createDatabase(process.env.TEST_CONNECTION_STRING!)
  console.log(result)
}

async function main() {
  const result = await canConnectToDatabase(process.env.TEST_CONNECTION_STRING!)
  console.log(result)
}

main()
