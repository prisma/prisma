import { RDSDataClient } from '@aws-sdk/client-rds-data'
import { PrismaAurora } from '@prisma/adapter-aurora'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const awsRegion = `${env.AWS_REGION}` //The region that the aurora cluster is deployed to
    const resourceArn = `${env.RESOURCE_ARN}` //The ARN of the aurora cluster to connect to
    const secretArn = `${env.SECRET_ARN}` // The database secret that is used for authentication to the cluster. Your Service/Lambda will need access to this see https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_database_secret.html
    const databaseName = `${env.DATABASE_NAME}` // The name of the database to connect to in the cluster

    // Init prisma client
    const client = new RDSDataClient({ region: awsRegion })
    const adapter = new PrismaAurora(client, { resourceArn, secretArn, databaseName })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    return new Response(result)
  },
}
