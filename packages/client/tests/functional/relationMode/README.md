## Testing relationMode

Note: We are not testing SetNull with `foreignKeys` because it is invalid.
SetNull with a non-optionnal relation errors when the migration DDL is applied for all databases
(except for PostgreSQL where it fails at runtime)
