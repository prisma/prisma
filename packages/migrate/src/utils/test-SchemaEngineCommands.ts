import {
  canConnectToDatabase,
  //  createDatabase
} from '@prisma/internals'

// async function main2() {
//   const result = await createDatabase(process.env.TEST_CONNECTION_STRING!)
//   console.log(result)
// }

async function main(): Promise<void> {
  const result = await canConnectToDatabase(process.env.TEST_CONNECTION_STRING!)
  console.log(result)
}

void main()
