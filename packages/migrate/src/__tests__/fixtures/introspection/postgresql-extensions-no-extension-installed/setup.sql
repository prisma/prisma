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
    "coinflips" _bool,
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
ALTER TABLE "public"."Post"
ADD FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'a@a.de',
        '576eddf9-2434-421f-9a86-58bede16fd95',
        'Alice'
    );
