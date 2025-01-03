#!/bin/bash

# Create a directory /test
mkdir -p /test

# Navigate to the /test directory
cd /test

# Initialize a new Prisma project
pnpx prisma init

# Update the schema.prisma file to use lowdb as a connector
echo 'datasource db {
  provider = "lowdb"
  url      = env("TEST_LOWDB_URI")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    Int     @id @default(autoincrement())
  name  String
  email String  @unique
}' > schema.prisma

# Install the necessary dependencies
pnpm add @prisma/client lowdb

# Generate the Prisma Client
pnpx prisma generate

# Run the migration
pnpx prisma migrate dev --name init

# Create a test script to run a simple database query
echo 'import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@prisma.io",
    },
  });

  const allUsers = await prisma.user.findMany();
  console.log(allUsers);
}

main()
  .catch(e => {
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });' > testLowDB.ts

# Run the test script using bun runtime
bun run testLowDB.ts
