# Prisma Studio "value" Column Bug Analysis

## Issue Summary
Prisma Studio fails to load tables that contain a column named "value" due to ambiguous column references in generated SQL queries.

## Root Cause
The issue occurs in the Studio's query generation logic where it creates Common Table Expressions (CTEs) that alias count results as "value":

```sql
with "count" as (select cast(coalesce(count(*), 0) as text) as "value" from "public"."PaymentGateway"...)
```

When the table itself has a column named "value", PostgreSQL cannot determine which "value" is being referenced, resulting in the error:
```
column reference "value" is ambiguous
```

## Affected Components
- **Primary**: `@prisma/studio-core-licensed` package (closed source)
- **Secondary**: Studio CLI wrapper in `packages/cli/src/Studio.ts`

## Reproduction Case
Tables with columns named "value" consistently trigger this bug:

```prisma
model PaymentGateway {
  id     Int     @id @default(autoincrement())
  name   String
  value  String  // This column causes the bug
  active Boolean @default(true)
}
```

## Proposed Solution
The fix needs to be implemented in the Studio core package's query generation logic:

### Option 1: Qualified Column References
Use fully qualified column names in CTEs:
```sql
with "count" as (
  select cast(coalesce(count(*), 0) as text) as "count_value" 
  from "public"."PaymentGateway"
)
```

### Option 2: Unique CTE Aliases
Generate unique aliases for CTE columns to avoid conflicts:
```sql
with "count" as (
  select cast(coalesce(count(*), 0) as text) as "_studio_count_value" 
  from "public"."PaymentGateway"
)
```

### Option 3: Table Aliases
Use table aliases in the main query to disambiguate:
```sql
with "count" as (
  select cast(coalesce(count(*), 0) as text) as "value" 
  from "public"."PaymentGateway" as "t"
)
select "t"."value" as "table_value", "count"."value" as "count_value"
from "public"."PaymentGateway" as "t", "count"
```

## Test Cases Added
- Created test fixture: `packages/cli/src/__tests__/fixtures/studio-value-column-bug/`
- Added Studio command tests: `packages/cli/src/__tests__/commands/Studio.test.ts`
- Created reproduction case: `reproduction-value-column-bug/`

## Workaround
Until the fix is implemented, users can:
1. Rename the "value" column to something else (e.g., "val", "data", "content")
2. Use Prisma Client directly instead of Studio for data inspection

## Files Modified
- `packages/cli/src/__tests__/fixtures/studio-value-column-bug/schema.prisma`
- `packages/cli/src/__tests__/fixtures/studio-value-column-bug/prisma.config.ts`
- `packages/cli/src/__tests__/commands/Studio.test.ts`
- `reproduction-value-column-bug/` (complete reproduction case)

## Next Steps
1. Report this issue to the Prisma Studio team
2. Implement the fix in `@prisma/studio-core-licensed`
3. Add regression tests for reserved/problematic column names
4. Update documentation about column naming considerations for Studio

## Impact
- **Severity**: Minor (workaround available)
- **Frequency**: Consistent for affected schemas
- **Environment**: Development only (Studio is dev tool)