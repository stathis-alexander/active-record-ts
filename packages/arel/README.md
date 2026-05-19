# `@active-record-ts/arel`

Relational-algebra query builder for TypeScript. A port of Rails' [`Arel`](https://github.com/rails/rails/tree/main/activerecord/lib/arel).

Arel builds SQL ASTs and emits dialect-specific strings (Postgres, MySQL, SQLite). It does not connect to a database, validate column names, or care about schema — it produces _syntactically_ correct SQL, nothing more.

You usually don't use it directly — [`@active-record-ts/active-record`](../active-record) does. Reach for `arel` when you need to compose SQL that the high-level API doesn't cover.

## Usage

```ts
import { Arel } from '@active-record-ts/arel';

const users = new Arel.Table('users');
const mgr = users.project(users.column('id'), users.column('name'))
                 .where(users.column('age').gt(18))
                 .order(users.column('name'));

mgr.toSql();
// SELECT "users"."id", "users"."name" FROM "users"
// WHERE "users"."age" > 18 ORDER BY "users"."name"
```

Dialect-specific output:

```ts
import { Arel, Visitors } from '@active-record-ts/arel';

mgr.toSql(new Visitors.MySQL());      // backtick-quoted
mgr.toSql(new Visitors.PostgreSQL()); // double-quote-quoted
mgr.toSql(new Visitors.SQLite());
```

## Managers

- `SelectManager` — `SELECT` queries (via `Table#project`, etc.)
- `InsertManager` — `INSERT`
- `UpdateManager` — `UPDATE`
- `DeleteManager` — `DELETE`

## Test

```bash
bun run test:arel
```
