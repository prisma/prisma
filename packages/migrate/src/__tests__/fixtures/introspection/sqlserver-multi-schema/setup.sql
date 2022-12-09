USE [tests-migrate-multi-schema];

IF NOT EXISTS ( SELECT  *
                FROM    sys.schemas
                WHERE   name = N'base' )
    EXEC('CREATE SCHEMA [base]');

IF NOT EXISTS ( SELECT  *
                FROM    sys.schemas
                WHERE   name = N'transactional' )
    EXEC('CREATE SCHEMA [transactional]');

-- CreateTable
CREATE TABLE [base].[SomeUser] (
    [id] NVARCHAR PRIMARY KEY NONCLUSTERED,
    [email] NVARCHAR NOT NULL
);

-- CreateTable
CREATE TABLE [transactional].[Post] (
    [id] NVARCHAR PRIMARY KEY NONCLUSTERED,
    [title] NVARCHAR NOT NULL,
    [authorId] NVARCHAR NOT NULL
);

-- AddForeignKey
ALTER TABLE [transactional].[Post] ADD CONSTRAINT [Post_authorId_fkey]
    FOREIGN KEY ([authorId]) REFERENCES [base].[SomeUser]([id])
    ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- tables names are renamed so they are identical
-- Original names are User and Post
-- Errors with Error: [libs/dml/src/datamodel.rs:178:14] Every RelationInfo should have a complementary RelationInfo on the opposite relation field.
-- https://github.com/prisma/prisma/issues/15800
-- 

-- CreateTable
CREATE TABLE [base].[some_table] (
    [id] NVARCHAR PRIMARY KEY,
    [email] NVARCHAR NOT NULL
);

-- CreateTable
CREATE TABLE [transactional].[some_table] (
    [id] NVARCHAR PRIMARY KEY,
    [title] NVARCHAR NOT NULL,
    [authorId] NVARCHAR NOT NULL
);

-- AddForeignKey
ALTER TABLE [transactional].[some_table] ADD CONSTRAINT [Post_authorId_fkey2]
    FOREIGN KEY ([authorId]) REFERENCES [base].[some_table]([id])
    ON DELETE NO ACTION ON UPDATE CASCADE;
