export default ({ provider, providerFeatures, previewFeatures, id }) => {
  return `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = [${providerFeatures}${previewFeatures}]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${id}
  }
  `
}
