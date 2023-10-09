-- CreateTable
CREATE TABLE "type_test" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "int_column" INTEGER NOT NULL,
    "int_column_null" INTEGER,
    "bigint_column" BIGINT NOT NULL,
    "bigint_column_null" BIGINT,
    "double_column" REAL NOT NULL,
    "double_column_null" REAL,
    "decimal_column" DECIMAL NOT NULL,
    "decimal_column_null" DECIMAL,
    "boolean_column" BOOLEAN NOT NULL,
    "boolean_column_null" BOOLEAN,
    "text_column" TEXT NOT NULL,
    "text_column_null" TEXT,
    "datetime_column" DATETIME NOT NULL,
    "datetime_column_null" DATETIME
);

-- CreateTable
CREATE TABLE "type_test_2" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datetime_column" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datetime_column_null" DATETIME
);

-- CreateTable
CREATE TABLE "type_test_3" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bytes" BLOB NOT NULL
);

-- CreateTable
CREATE TABLE "Child" (
    "c" TEXT NOT NULL,
    "c_1" TEXT NOT NULL,
    "c_2" TEXT NOT NULL,
    "parentId" TEXT,
    "non_unique" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "Parent" (
    "p" TEXT NOT NULL,
    "p_1" TEXT NOT NULL,
    "p_2" TEXT NOT NULL,
    "non_unique" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "authors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "age" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "properties" TEXT NOT NULL,
    "properties_null" TEXT
);

-- CreateTable
CREATE TABLE "Unique" (
    "email" TEXT NOT NULL PRIMARY KEY,
);

-- CreateIndex
CREATE UNIQUE INDEX "Child_c_key" ON "Child"("c");

-- CreateIndex
CREATE UNIQUE INDEX "Child_parentId_key" ON "Child"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Child_c_1_c_2_key" ON "Child"("c_1", "c_2");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_p_key" ON "Parent"("p");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_p_1_p_2_key" ON "Parent"("p_1", "p_2");
