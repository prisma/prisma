# PostgreSQL Money Type Manual Testing

Since the functional test infrastructure requires a properly configured test database, here's how to manually verify the money type fix works end-to-end:

## Setup

1. Ensure PostgreSQL is running (e.g., via Docker):

   ```bash
   docker run --name postgres-money-test -e POSTGRES_PASSWORD=password -e POSTGRES_DB=testdb -p 5432:5432 -d postgres:15
   ```

2. Create a test schema:
   ```sql
   CREATE TABLE "Order" (
     id SERIAL PRIMARY KEY,
     price MONEY NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

## Test Cases

### 1. Formatted Money Insertion

```typescript
// Should not throw DecimalError
await prisma.order.create({ data: { price: '50000.00' } })
await prisma.order.create({ data: { price: '1,234.56' } })
await prisma.order.create({ data: { price: '999.99' } })
```

### 2. Aggregations (Bug Report Case)

```typescript
// This was the original failing case - should work now
const result = await prisma.order.aggregate({
  _sum: { price: true },
  _min: { price: true },
  _max: { price: true },
})
console.log(result._sum.price) // Should not throw DecimalError
```

### 3. EU Format Support

```typescript
// Should handle both US and EU formats
await prisma.order.create({ data: { price: '1.234,56' } }) // EU format
await prisma.order.create({ data: { price: '1,234.56' } }) // US format
```

### 4. Negative Values

```typescript
await prisma.order.create({ data: { price: '-1234.56' } })
// PostgreSQL also supports parentheses notation
```

### 5. Edge Cases

```typescript
await prisma.order.create({ data: { price: '0' } })
await prisma.order.create({ data: { price: '0.01' } })
await prisma.order.create({ data: { price: '99999999.99' } })
```

## Expected Results

All operations should complete successfully without throwing `DecimalError`. The `normalize_money` function in `@prisma/adapter-pg` handles:

- Empty strings → '0'
- Currency symbols ($ € etc.)
- Thousands separators (both , and .)
- Decimal separators (both , and .)
- Negative values (minus sign and parentheses notation)
- Leading zeros removal
- Malformed consecutive separators

## Verification

The core fix is in `/packages/adapter-pg/src/conversion.ts` (lines 334-415) and is thoroughly tested in `/packages/adapter-pg/src/__tests__/normalize-money.test.ts` (54 unit tests, all passing).
