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
ALTER TABLE "public"."Post"
ADD FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE
SET NULL ON UPDATE CASCADE;
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'a@a.de',
        '576eddf9-2434-421f-9a86-58bede16fd91',
        'alice'
    );
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'A@a.de',
        '576eddf9-2434-421f-9a86-58bede16fd92',
        'Alice'
    );
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'A@A.DE',
        '576eddf9-2434-421f-9a86-58bede16fd93',
        'ALICE'
    );
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'a@A.de',
        '576eddf9-2434-421f-9a86-58bede16fd94',
        'AliCe'
    );
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'a@a.De',
        '576eddf9-2434-421f-9a86-58bede16fd95',
        'AlIce'
    );
INSERT INTO "public"."User" (email, id, name)
VALUES (
        'A@a.dE',
        '576eddf9-2434-421f-9a86-58bede16fd96',
        'alicE'
    );