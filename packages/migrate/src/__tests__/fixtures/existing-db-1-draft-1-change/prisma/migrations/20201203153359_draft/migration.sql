/*
  Warnings:

  - You are about to drop the column `viewCount20` on the `Blog` table. All the data in the column will be lost.
  - Added the required column `viewCount` to the `Blog` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Blog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "viewCount" INTEGER NOT NULL
);
INSERT INTO "new_Blog" ("id") SELECT "id" FROM "Blog";
DROP TABLE "Blog";
ALTER TABLE "new_Blog" RENAME TO "Blog";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
