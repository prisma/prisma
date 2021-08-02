import { runtimeIntegrationTest } from '../../__helpers__/integrationTest'
import { database } from './__database'
import { scenarios } from './__scenarios'
import { prismaClientSettings } from './__prismaClientSettings'

runtimeIntegrationTest({ database, scenarios, prismaClientSettings })
