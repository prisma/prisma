-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('STUDENT', 'TEACHER');
-- CreateEnum
CREATE TYPE "public"."TokenType" AS ENUM ('EMAIL', 'API');
-- CreateTable
CREATE TABLE "User" (
"id" SERIAL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "social" JSONB,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Token" (
"id" SERIAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "TokenType" NOT NULL,
    "emailToken" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "expiration" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Course" (
"id" SERIAL,
    "name" TEXT NOT NULL,
    "courseDetails" TEXT,

    PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL,
    "userId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,

    PRIMARY KEY ("userId","courseId")
);
-- CreateTable
CREATE TABLE "Test" (
"id" SERIAL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "courseId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "TestResult" (
"id" SERIAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "graderId" INTEGER NOT NULL,
    "testId" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "User.email_unique" ON "User"("email");
-- CreateIndex
CREATE UNIQUE INDEX "Token.emailToken_unique" ON "Token"("emailToken");
-- CreateIndex
CREATE INDEX "CourseEnrollment.userId_role_index" ON "CourseEnrollment"("userId", "role");
-- AddForeignKey
ALTER TABLE "Token" ADD FOREIGN KEY("userId")REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD FOREIGN KEY("userId")REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD FOREIGN KEY("courseId")REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Test" ADD FOREIGN KEY("courseId")REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD FOREIGN KEY("studentId")REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD FOREIGN KEY("graderId")REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TestResult" ADD FOREIGN KEY("testId")REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
