-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "base";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "transactional";

-- CreateTable
CREATE TABLE "base"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactional"."Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactional"."Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "base"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


--
-- tables names are renamed so they are identical
-- Original names are User and Post
-- Errors with Error: [libs/dml/src/datamodel.rs:178:14] Every RelationInfo should have a complementary RelationInfo on the opposite relation field.
-- https://github.com/prisma/prisma/issues/15800
-- 

-- CreateTable
CREATE TABLE "base"."some_table" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey2" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactional"."some_table" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Post_pkey2" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactional"."some_table" ADD CONSTRAINT "Post_authorId_fkey2" FOREIGN KEY ("authorId") REFERENCES "base"."some_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
