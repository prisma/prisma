import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
    }

    model User {
      id       String  @id() @default(cuid())
      name     String
      username String  @unique()
      email    String  @unique()
      avatar   String
      password String
      bio      String  @default("")
      banned   Boolean @default(false)
      verified Boolean @default(false)

      videos   Video[]
      sessions Session[]

      createdAt DateTime @default(now()) @map("created_at")
      updatedAt DateTime @default(now()) @updatedAt() @map("updated_at")

      @@map("users")
    }

    model Session {
      id        String @id() @default(cuid())
      token     String @unique()
      ip        String
      userAgent String @map("user_agent")
      device    String

      userId String @map("user_id")
      user   User   @relation(fields: [userId], references: [id])

      @@map("sessions")
    }

    model Video {
      id          String @id() @default(cuid())
      title       String
      description String
      url         String @unique()

      userId String     @map("user_id")
      user   User       @relation(fields: [userId], references: [id])
      tags   VideoTag[]

      @@map("videos")
    }

    model Tag {
      id   String @id() @default(cuid())
      name String @unique()

      videos VideoTag[]

      @@map("tags")
    }

    model VideoTag {
      videoId String @map("video_id")
      tagId   String @map("tag_id")

      video Video @relation(fields: [videoId], references: [id])
      tag   Tag   @relation(fields: [tagId], references: [id])

      @@id([videoId, tagId])
      @@map("video_tags")
    }
  `
})
