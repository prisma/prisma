const { PrismaClient } = require('@prisma/client')
const assert = require('assert')
const { Client } = require('pg')

module.exports = async () => {
  const originalConnectionString =
    process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev'
  const db = new Client({
    connectionString: originalConnectionString,
  })
  await db.connect()
  await db.query(`
    DROP TYPE IF EXISTS "Role";
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

    DROP TABLE IF EXISTS "public"."Post" CASCADE;
    CREATE TABLE "public"."Post" (
        "id" text NOT NULL,
        "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp(3) NOT NULL DEFAULT '1970-01-01 00:00:00'::timestamp without time zone,
        "published" boolean NOT NULL DEFAULT false,
        "title" text NOT NULL,
        "content" text,
        "authorId" text,
        "jsonData" jsonb,
        PRIMARY KEY ("id")
    );

    DROP TABLE IF EXISTS "public"."User" CASCADE;
    CREATE TABLE "public"."User" (
        "id" text,
        "email" text NOT NULL,
        "name" text,
        PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "User.email" ON "public"."User"("email");

    ALTER TABLE "public"."Post" ADD FOREIGN KEY ("authorId") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

    INSERT INTO "public"."User" (email, id, name) VALUES ('a@a.de',	'576eddf9-2434-421f-9a86-58bede16fd91',	'alice');
    INSERT INTO "public"."User" (email, id, name) VALUES ('A@a.de',	'576eddf9-2434-421f-9a86-58bede16fd92',	'Alice');
    INSERT INTO "public"."User" (email, id, name) VALUES ('A@A.DE',	'576eddf9-2434-421f-9a86-58bede16fd93',	'ALICE');
    INSERT INTO "public"."User" (email, id, name) VALUES ('a@A.de',	'576eddf9-2434-421f-9a86-58bede16fd94',	'AliCe');
    INSERT INTO "public"."User" (email, id, name) VALUES ('a@a.De',	'576eddf9-2434-421f-9a86-58bede16fd95',	'AlIce');
    INSERT INTO "public"."User" (email, id, name) VALUES ('A@a.dE',	'576eddf9-2434-421f-9a86-58bede16fd96',	'alicE');
  `)

  const prisma = new PrismaClient()

  const defaultResult = await prisma.user.findMany({
    where: {
      email: {
        contains: 'a@a.de',
        mode: 'default',
      },
    },
  })
  assert.deepStrictEqual(
    defaultResult,
    [
      {
        id: '576eddf9-2434-421f-9a86-58bede16fd91',
        email: 'a@a.de',
        name: 'alice',
      },
    ],
    'defaultResult',
  )

  const insensitiveResult = await prisma.user.findMany({
    where: {
      email: {
        contains: 'a@a.de',
        mode: 'insensitive',
      },
    },
  })
  assert.deepStrictEqual(
    insensitiveResult,
    [
      {
        email: 'a@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd91',
        name: 'alice',
      },
      {
        email: 'A@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd92',
        name: 'Alice',
      },
      {
        email: 'A@A.DE',
        id: '576eddf9-2434-421f-9a86-58bede16fd93',
        name: 'ALICE',
      },
      {
        email: 'a@A.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd94',
        name: 'AliCe',
      },
      {
        email: 'a@a.De',
        id: '576eddf9-2434-421f-9a86-58bede16fd95',
        name: 'AlIce',
      },
      {
        email: 'A@a.dE',
        id: '576eddf9-2434-421f-9a86-58bede16fd96',
        name: 'alicE',
      },
    ],
    'insensitiveResult',
  )

  const defaultStartsWithResult = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'a@',
        mode: 'default',
      },
    },
  })
  assert.deepStrictEqual(
    defaultStartsWithResult,
    [
      {
        email: 'a@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd91',
        name: 'alice',
      },
      {
        email: 'a@A.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd94',
        name: 'AliCe',
      },
      {
        email: 'a@a.De',
        id: '576eddf9-2434-421f-9a86-58bede16fd95',
        name: 'AlIce',
      },
    ],
    'defaultStartsWithResult',
  )

  const insensitiveStartsWithResult = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'a@',
        mode: 'insensitive',
      },
    },
  })
  assert.deepStrictEqual(
    insensitiveStartsWithResult,
    [
      {
        email: 'a@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd91',
        name: 'alice',
      },
      {
        email: 'A@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd92',
        name: 'Alice',
      },
      {
        email: 'A@A.DE',
        id: '576eddf9-2434-421f-9a86-58bede16fd93',
        name: 'ALICE',
      },
      {
        email: 'a@A.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd94',
        name: 'AliCe',
      },
      {
        email: 'a@a.De',
        id: '576eddf9-2434-421f-9a86-58bede16fd95',
        name: 'AlIce',
      },
      {
        email: 'A@a.dE',
        id: '576eddf9-2434-421f-9a86-58bede16fd96',
        name: 'alicE',
      },
    ],
    'insensitiveStartsWithResult',
  )

  const defaultEndsWithResult = await prisma.user.findMany({
    where: {
      email: {
        endsWith: 'DE',
        mode: 'default',
      },
    },
  })
  assert.deepStrictEqual(
    defaultEndsWithResult,
    [
      {
        email: 'A@A.DE',
        id: '576eddf9-2434-421f-9a86-58bede16fd93',
        name: 'ALICE',
      },
    ],
    'defaultEndsWithResult',
  )

  const insensitiveEndsWithResult = await prisma.user.findMany({
    where: {
      email: {
        endsWith: 'DE',
        mode: 'insensitive',
      },
    },
  })
  assert.deepStrictEqual(
    insensitiveEndsWithResult,
    [
      {
        email: 'a@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd91',
        name: 'alice',
      },
      {
        email: 'A@a.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd92',
        name: 'Alice',
      },
      {
        email: 'A@A.DE',
        id: '576eddf9-2434-421f-9a86-58bede16fd93',
        name: 'ALICE',
      },
      {
        email: 'a@A.de',
        id: '576eddf9-2434-421f-9a86-58bede16fd94',
        name: 'AliCe',
      },
      {
        email: 'a@a.De',
        id: '576eddf9-2434-421f-9a86-58bede16fd95',
        name: 'AlIce',
      },
      {
        email: 'A@a.dE',
        id: '576eddf9-2434-421f-9a86-58bede16fd96',
        name: 'alicE',
      },
    ],
    'insensitiveEndsWithResult',
  )

  try {
    const standardResult = await prisma.user.findMany({
      where: {
        email: {
          contains: 'a@a.de',
        },
      },
    })
  } catch (e) {
    assert.equal(!!e.message, true)
  }

  prisma.$disconnect()
  await db.query(`
    DROP TABLE IF EXISTS "public"."Post" CASCADE;
    DROP TABLE IF EXISTS "public"."User" CASCADE;
  `)
  await db.end()
}

if (require.main === module) {
  module.exports()
}
