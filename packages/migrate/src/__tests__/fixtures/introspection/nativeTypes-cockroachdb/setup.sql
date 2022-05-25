DROP TYPE IF EXISTS "Role";
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
DROP TABLE IF EXISTS "public"."Post" CASCADE;
CREATE TABLE "public"."Post" (
    "id" text NOT NULL,
    "title" varchar NOT NULL,
    "content" string,
    "authorId" character varying,
    "exampleChar" char,
    "exampleCharLength" char(16),
    "exampleBit" bit,
    "exampleBitLength" bit(16),
    PRIMARY KEY ("id")
);
DROP TABLE IF EXISTS "public"."User" CASCADE;
CREATE TABLE "public"."User" (
    "id" text,
    "email" string(32) NOT NULL,
    "name" character varying(32),
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User.email" ON "public"."User"("email");
ALTER TABLE "public"."Post"
ADD FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'a@a.de',
        '576eddf9-2434-421f-9a86-58bede16fd95',
        'Alice'
    );