# ActiveRecord-TS

A TypeScript port of Rails' `ActiveRecord`.

**No codegen. No schema files. No build step.** Models, validations, callbacks, associations, and migrations are all plain TypeScript classes — `extends Base`, declare your fields, and run. Column types are introspected from the live database at startup via `loadSchema()`, so attribute schemas stay in sync with the DB without a `prisma generate` / `drizzle-kit push` / `typeorm migration:run --typeorm-generate-types` step.

```ts
class User extends Base {
  static override tableName = 'users';
  declare name: string;
  declare email: string;
}
User.validates('email', { presence: true, format: { with: /@/ } });
User.hasMany('posts', { class: () => Post });
```

That's the whole setup — no generator to run, no `.prisma` / `.sql` files to keep in sync, no decorators or reflect-metadata.

## Create, find, save

```ts
import { Base } from '@active-record-ts/active-record';

class User extends Base {
  static override tableName = 'users';
  declare id: number;
  declare name: string;
  declare email: string;
  declare age: number;
}

await User.establishConnection({ adapter: 'sqlite', database: ':memory:' });
await User.loadSchema();

// Create — INSERTs and returns a persisted instance
const alex = await User.create({ name: 'Alex', email: 'alex@example.com', age: 30 });

// Find by primary key — throws RecordNotFound on miss
const user = await User.find(alex.id);

// Find by attributes — returns null on miss
const sandy = await User.findBy({ email: 'sandy@example.com' });

// Mutate + save — runs validations and callbacks, returns false on failure
user.name = 'Sandy';
await user.save();

// Or assign + save in one call
await user.update({ age: 31 });

// Query — chain `where`/`order`/`limit`/... and `await` to execute
const adults = await User
  .where({ active: true })
  .where({ age: [21, 22, 23] })   // array => IN
  .order({ created_at: 'desc' })
  .limit(10);
```

### A note on query typing

The query DSL is **syntactically** typed, not **semantically** typed. TypeScript checks the *shape* of a `where` argument — `Record<string, unknown>`, a `[sql, ...binds]` tuple, or a raw SQL string — but it does **not** verify that the keys are real columns or that the values match a column's type. Both of these typecheck and only fail at runtime (or silently return nothing):

```ts
User.where({ nmae: 'Alex' });   // typo — no static error
User.where({ age: 'thirty' });  // wrong value type — no static error
```

This is intentional: columns are discovered at runtime via `loadSchema()`, so there's no static schema for the type system to check against. If you need column- and value-level type checks on queries, reach for a different library.

## Packages

Three packages in this monorepo:

| Package | Role |
| ------- | ---- |
| [`@active-record-ts/arel`](packages/arel) | Relational-algebra query builder. Builds SQL ASTs, emits dialect-specific strings. |
| [`@active-record-ts/active-model`](packages/active-model) | Typed attributes, dirty tracking, validations, callbacks. No persistence. |
| [`@active-record-ts/active-record`](packages/active-record) | `Base` class, relations, associations, migrations, connection adapters (Postgres, MySQL, SQLite). |

See [`examples/express-blog`](examples/express-blog) for an end-to-end Express app.

## Install

```bash
bun install
```

## Test

```bash
bun test                  # all packages
bun run test:active-record
bun run db:up             # spin up Postgres + MySQL for integration tests
```
