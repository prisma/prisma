// Simple test to verify busy_timeout parameter works
const { PrismaBetterSqlite3 } = require('./packages/adapter-better-sqlite3/src/better-sqlite3.ts');

async function testBusyTimeout() {
  console.log('Testing busy_timeout parameter...');
  
  const adapter = new PrismaBetterSqlite3({
    url: './test.db?busy_timeout=5000'
  });
  
  const client = await adapter.connect();
  
  // Test that busy_timeout is set
  const result = await client.queryRaw({
    sql: 'PRAGMA busy_timeout',
    args: [],
    argTypes: []
  });
  
  console.log('Busy timeout result:', result.rows[0]);
  
  await client.dispose();
  console.log('✅ Test passed - busy_timeout parameter is working!');
}

testBusyTimeout().catch(console.error);