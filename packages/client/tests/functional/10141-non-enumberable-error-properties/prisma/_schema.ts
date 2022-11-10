import { idForProvider } from '../../_utils/idForProvider'
import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "${provider}"
    url      = "postgresql://lime_comfortable_imogen:UIjWtKsyh5@db-provision-postgres23452b4.c8yxynpclfrtwd.us-east-1.rds.amazonaws.com:5432/jade_spider"
  }
  
  model User {
    id ${idForProvider(provider)}
  }
  `
})
