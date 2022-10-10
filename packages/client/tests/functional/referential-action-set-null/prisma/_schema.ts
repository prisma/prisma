import testMatrix from '../_matrix'

export default testMatrix.setupSchema(({ provider, providerFlavor }) => {
  return /* Prisma */ `
    generator client {
      provider      = "prisma-client-js"
    }
    
    datasource db {
      provider = "${provider}"
      url      = env("TEST_FUNCTIONAL_${providerFlavor.toLocaleUpperCase()}_URI")
    }

    // the functional client tests expect at least one model, otherwise we'd get
    // a TypeError while reading 'this.schema.outputObjectTypes.model'
    model Dummy {
      id    Int    @id
    }
  `
})
