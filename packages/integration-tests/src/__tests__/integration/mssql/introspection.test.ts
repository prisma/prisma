import { introspectionIntegrationTest } from '../../__helpers__/integrationTest'
import { database } from './__database'
import { scenarios } from './__scenarios'
import { prismaClientSettings } from './__prismaClientSettings'

introspectionIntegrationTest({ scenarios, database, prismaClientSettings })
