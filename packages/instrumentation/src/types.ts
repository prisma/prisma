export enum PrismaLayerType {
  ClientOperations = 'prisma:client:operations',
  ClientConnect = 'prisma:client:connect',
  ClientSerialize = 'prisma:client:serialize',
  ClientTransaction = 'prisma:client:transaction',
  Engine = 'prisma:engine',
  EngineConnection = 'prisma:engine:connection',
  EngineQuery = 'prisma:engine:db_query',
  EngineSerialize = 'prisma:engine:serialize',
  EngineItxRunner = 'prisma:engine:itx_runner',
  EngineItxQueryBuilder = 'prisma:engine:itx_query_builder',
}
