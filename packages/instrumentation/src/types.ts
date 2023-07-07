export enum PrismaLayerType {
  ClientOperations = 'prisma:client:operations',
  ClientConnect = 'prisma:client:connect',
  ClientSerialize = 'prisma:client:serialize',
  Engine = 'prisma:engine',
  EngineConnection = 'prisma:engine:connection',
  EngineQuery = 'prisma:engine:db_query',
  EngineSerialize = 'prisma:engine:serialize',
  ClientTransaction = 'prisma:client:transaction',
  EngineItxRunner = 'prisma:engine:itx_runner',
  EngineItxQueryBuilder = 'prisma:engine:itx_query_builder',
}
