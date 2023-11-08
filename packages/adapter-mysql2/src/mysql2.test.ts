const { PrismaMySQL2 } = require('./mysql2')

describe('API completeness', () => {
  it('should check if all methods exist', () => {
    const mysql2 = new PrismaMySQL2()

    // main
    expect(mysql2.startTransaction).toBeDefined()
    expect(mysql2.close).toBeDefined()

    // queryable
    expect(mysql2.queryRaw).toBeDefined()
    expect(mysql2.executeRaw).toBeDefined()

    // // transaction
    // expect(mysql2.commit).toBeDefined();
    // expect(mysql2.rollback).toBeDefined();
    // expect(mysql2.dispose).toBeDefined();
  })
})
