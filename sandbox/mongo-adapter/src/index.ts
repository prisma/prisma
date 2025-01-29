import { PrismaClient } from ".prisma/client";
import { PrismaMongoDB } from "@prisma/adapter-mongodb";
import { MongoClient } from "mongodb";
import { MongoDBQuery } from "@prisma/driver-adapter-utils";

async function main() {
  const client = new MongoClient(process.env.TEST_MONGO_URI!);
  const adapter = new PrismaMongoDB({ client, database: "test" });

  try {
    // Examples using driver adapter directly:

    const mongoDBQueryCreateMany: MongoDBQuery = {
      kind: "mongodb",
      collection: "user",
      returnType: "cursor",
      action: "insertMany",
      data: [{ "name": "Alice" }, { "name": "Bob" }]
    };
    const resultCreate = await adapter.executeRaw(mongoDBQueryCreateMany);
    if (!resultCreate.ok) throw resultCreate.error;

    console.log("Created records: ", resultCreate.value);


    const mongoDBQueryFindMany: MongoDBQuery = {
      kind: "mongodb",
      collection: "user",
      returnType: "cursor",
      action: "find",
      query: {
        name: "Alice"
      }
    };
    const resultFind = await adapter.queryRaw(mongoDBQueryFindMany);
    if (!resultFind.ok) throw resultFind.error;

    console.log("Found records: ", resultFind.value);


    // Example using PrismaClient:
    // Won't execute as query plan creation is not implemented yet, but you can see there are no type changes needed.
    // Also, the query compiler panics right now when it gets an unknown provider name like 'mongodb'.
    // => Building below code works, but running not. Comment the parts creating & using `PrismaClient` out for now to run it.

    const prisma = new PrismaClient({ adapter });
    const resultFindMany = await prisma.user.findMany({});
    console.log("prisma.user.findMany result: ", resultFindMany);

    // Note that a mongo db prisma client never had the usual $queryRaw / $executeRaw methods but offers this $runCommandRaw method instead.
    const resultRaw = await prisma.$runCommandRaw({
      insert: "user",
      documents: [{ name: "Charlie" }]
    });
    console.log("Raw result: ", resultRaw);

    const resultRawAdapter = await adapter.executeRawCommand({
      insert: "user",
      documents: [{ name: "Charlie" }]
    });
    if (!resultRawAdapter.ok) throw resultRawAdapter.error;

    console.log("Raw result adapter: ", resultRawAdapter.value);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
