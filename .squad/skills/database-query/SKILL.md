---
name: database-query
description: Query SQLite databases, inspect schemas, run migrations, and analyze data
tags: [data, sql, database]
agentMatch:
  roles: ["Backend Dev", "Lead"]
requires:
  bins: []
  env: []
---

## Database Query

You can query and manage the project's SQLite databases.

- **Schema inspection** — list tables, columns, indexes
- **Data queries** — SELECT, JOIN, aggregate queries
- **Migrations** — create and run schema changes
- **Analysis** — data profiling, integrity checks

### Guidelines

- Always use parameterized queries to prevent SQL injection
- Test migrations on a copy before applying to production data
- Use transactions for multi-statement operations
- Be cautious with DELETE/UPDATE — verify WHERE clauses first
- The project uses `better-sqlite3` for synchronous SQLite access
