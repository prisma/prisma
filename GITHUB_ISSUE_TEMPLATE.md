# Bug Report: Prisma Studio fails to load tables with column named "value"

## Bug Description
Prisma Studio generates SQL queries with ambiguous column references when tables contain a column named "value", preventing the table from loading in Studio.

## Error Message
```
column reference "value" is ambiguous
```

## SQL Query Generated
```sql
with "count" as (select cast(coalesce(count(*), 0) as text) as "value" from "public"."PaymentGateway"...)
```

## Reproduction Steps
1. Create a table with a column named "value":
```prisma
model PaymentGateway {
  id     Int     @id @default(autoincrement())
  name   String
  value  String  // This column causes the issue
  active Boolean @default(true)
}
```

2. Run `prisma studio`
3. Try to view the PaymentGateway table
4. Observe the ambiguous column reference error

## Expected Behavior
Studio should display the table data without errors, properly disambiguating between the table's "value" column and the CTE's "value" alias.

## Actual Behavior
Studio fails to load the table and shows SQL errors in the console.

## Environment
- **OS**: [Your OS]
- **Database**: PostgreSQL
- **Node.js version**: [Your Node version]
- **Prisma version**: [Your Prisma version]

## Workaround
Rename the "value" column to something else (e.g., "val", "data", "content").

## Proposed Solution
The Studio query generator should use unique aliases for CTE columns or fully qualified column names to avoid conflicts with table columns.

## Test Case
A complete reproduction case has been created with:
- Schema with problematic "value" columns
- Test fixtures for validation
- Suggested fixes for the query generation logic

## Severity
🔹 Minor: Unexpected behavior, but does not block development (workaround available)

## Frequency
Consistently reproducible for any table with a "value" column.