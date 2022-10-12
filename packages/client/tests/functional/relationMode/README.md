## Testing relationMode

See https://www.notion.so/prismaio/Phase-1-Report-on-findings-f21c7bb079c5414296286973fdcd62c2

Note: We are not testing SetNull with `foreignKeys` because it is invalid.
SetNull with a non-optionnal relation errors when the migration DDL is applied for all databases
(except for PostgreSQL where it fails at runtime)
