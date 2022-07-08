import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, previewFeatures, referentialIntegrity, id }) => {
  let referentialIntegrityLine = ''

  switch (referentialIntegrity) {
    case 'prisma':
    case 'foreignKeys':
      referentialIntegrityLine = `referentialIntegrity = "${referentialIntegrity}"`
      break
    default:
      break
  }

  return /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
      previewFeatures = [${previewFeatures}]
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("DATABASE_URI_${provider}")
      ${referentialIntegrityLine}
    }

    model UserDefault {
      id      ${id}
      profile ProfileDefault?
    }
    model ProfileDefault {
      id     ${id}
      user   UserDefault    @relation(fields: [userId], references: [id])
      userId String  @unique
    }

    model UserCascade {
      id      ${id}
      profile ProfileCascade?
    }
    model ProfileCascade {
      id     ${id}
      user   UserCascade @relation(fields: [userId], references: [id], onUpdate: Cascade, onDelete: Cascade)
      userId String  @unique
    }
  `
})
