# Supported Databases

The Prisma Framework currently supports the following databases:

| Database | Version | Status |
| --- | --- | --- |
| MySQL | 5.7 | **Official** support | 
| MySQL | 8 | **Experimental** support |
| PostgreSQL |  10.X | **Official** support |
| SQLite | 3.28.0 | **Official** support |

When a database version is **officially** supported, it means that there is an internal test suite that's running against this version. **Experimental** support means that there are currently no internal tests against that database version. In most cases, this means that using this database version is still absolutely fine.

Note that a fixed version of SQLite is shipped with every Prisma Framework release.
