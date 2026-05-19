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

Three packages in this monorepo:

| Package | Role |
| ------- | ---- |
| [`@arelts/arel`](packages/arel) | Relational-algebra query builder. Builds SQL ASTs, emits dialect-specific strings. |
| [`@arelts/active-model`](packages/active-model) | Typed attributes, dirty tracking, validations, callbacks. No persistence. |
| [`@arelts/active-record`](packages/active-record) | `Base` class, relations, associations, migrations, connection adapters (Postgres, MySQL, SQLite). |

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
