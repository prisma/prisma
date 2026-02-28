import { idForProvider } from '../../../_utils/idForProvider'
import { Providers } from '../../../_utils/providers'

export default function (provider: Providers) {
  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URL")
    }
    
    model SongVariant {
      id          ${idForProvider(provider)}
      songId      String
      searchTitle String
      lyrics      String
      createdAt   DateTime @default(now())
      deletedAt   DateTime?
      
      @@map("song_variants")
    }
  `
}