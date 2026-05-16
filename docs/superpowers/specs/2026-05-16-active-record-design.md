# ActiveRecord + ActiveModel TypeScript Port — Design

Date: 2026-05-16
Author: ajs

## Goal

Port Rails ActiveRecord and the subset of ActiveModel it depends on
(Attributes, Dirty, Validations, Callbacks) to TypeScript. Use the
already-built `arel` package for SQL generation. Run against Postgres,
MySQL, and SQLite using Bun-native primitives where possible.

Stay close to the Rails design (class-level config, an enumerable
`Relation`, dirty tracking, callbacks, validations) but adapt to
TypeScript idioms (typed attribute reflection, no method_missing, no
metaprogramming on bind values).

## Repo Layout

Convert the repo to a Bun workspaces monorepo:

```
arelts/
├── packages/
│   ├── arel/              # existing src/ moved here
│   ├── active-model/      # new
│   └── active-record/     # new
├── docker/
│   └── docker-compose.yml
├── test/                  # cross-package integration tests
├── package.json           # workspaces root
├── bun.toml
├── tsconfig.json
└── biome.jsonc
```

Each package has its own `package.json`, `tsconfig.json`, and `test/`
directory. The arel test suite stays intact during the move.

## Connection Adapters

One abstract `ConnectionAdapter` plus three concrete adapters. Each adapter
owns its arel visitor and exposes a uniform query API.

| DB           | Driver                                   | Visitor      | Adapter id        |
| ------------ | ---------------------------------------- | ------------ | ----------------- |
| SQLite       | `bun:sqlite` (native)                    | `SQLite`     | `'sqlite'`        |
| Postgres     | Bun's `sql` (`Bun.SQL`)                  | `PostgreSQL` | `'postgres-bun'`  |
| Postgres     | `postgres` npm package (porsager)        | `PostgreSQL` | `'postgres'`      |
| MySQL        | `mysql2/promise` (no Bun-native yet)     | `MySQL`      | `'mysql'`         |

Adapter responsibilities:
- `execute(sql, binds)` — run raw SQL, return rows
- `exec(sql, binds)` — run statement without rows, return affected/last id
- `transaction(fn)` — begin/commit/rollback, supports nesting via savepoints
- `columns(tableName)` — introspect table schema
- `primaryKey(tableName)`
- `quoteIdentifier(name)` — passed through to visitor
- `arelVisitor()` — return the right visitor instance
- `lastInsertId()` — adapter-specific, used by sqlite/mysql (PG uses RETURNING)

Connection pooling: defer to the driver's built-in pool. Single-connection
mode works for tests and Bun workers.

## ActiveModel

### Attributes

Type registry mapping a logical type name (`'string'`, `'integer'`,
`'float'`, `'boolean'`, `'date'`, `'datetime'`, `'decimal'`, `'json'`,
`'binary'`) to a `Type<TS>` with two coercion functions:

```ts
interface Type<T> {
  cast(value: unknown): T | null;          // JS -> attribute value
  serialize(value: T | null): unknown;     // attribute value -> driver value
  deserialize(value: unknown): T | null;   // driver value -> attribute value
}
```

Per-class attribute set on a `static attributeSet: AttributeSet` declared
either explicitly (`Model.attribute('name', 'string')`) or inferred from
database columns at boot (`await Model.loadSchema()`).

### Dirty

Each instance keeps an `originalAttributes` snapshot and a `changedAttributes`
map. Public surface: `changes()`, `changed()`, `<attr>Changed()` (via a
generated helper, not metaprogramming), `<attr>Was()`, `savedChanges()`,
`<attr>PreviouslyChanged()`. We expose a generic method-style API
(`record.changed('name')`) plus optional typed property-style helpers.

### Validations

Built-in validators: `presence`, `absence`, `length`, `format`,
`numericality`, `inclusion`, `exclusion`, `confirmation`, `acceptance`,
`uniqueness` (uniqueness lives in active-record because it queries).

Validators run by traversing a per-class `validators` list. Each validator
implements `validate(record, errors)`. Errors are kept in an `Errors`
object on the record (`record.errors`) with the same surface as Rails'
`ActiveModel::Errors` minus i18n.

### Callbacks

Per-class callback chain for `validation`, `save`, `create`, `update`,
`destroy`. Each chain stores `{ kind: 'before'|'after'|'around', fn }`.
`runCallbacks(kind, () => body())` walks the chain, halting if a `before`
callback returns `false`.

### Errors

Plain class with `add(attribute, message)`, `messages`, `fullMessages`,
`any`, `empty`, `clear`. No i18n — pass through raw strings.

## ActiveRecord

### Base

```ts
class User extends ActiveRecord.Base {
  static override tableName = 'users';
  static override primaryKey = 'id';

  declare id: number;
  declare name: string;
  declare email: string;
}

await User.establishConnection({ adapter: 'postgresql', ... });
await User.loadSchema();   // optional — reflects columns + types

await User.where({ email: 'a@b.c' }).first();
await User.create({ name: 'Alex' });
```

Class methods (mirror Rails' `ActiveRecord::Base`):

- Configuration: `establishConnection`, `connection`, `tableName`,
  `primaryKey`, `attribute`, `attributesSchema`, `loadSchema`.
- Query (returns `Relation`): `all`, `where`, `not`, `order`, `limit`,
  `offset`, `select`, `joins`, `group`, `having`, `distinct`, `lock`,
  `none`.
- Finders: `find`, `findBy`, `findByPk`, `first`, `last`, `take`,
  `exists`, `count`, `sum`, `min`, `max`, `average`, `pluck`, `ids`.
- Persistence (class-level): `create`, `createMany`, `insertAll`,
  `upsertAll`, `updateAll`, `destroyAll`, `deleteAll`.
- Validations: `validates(...)` (and granular variants).
- Callbacks: `beforeSave`, `afterCreate`, etc.
- Transactions: `transaction(fn)`.

Instance methods:
- Lifecycle: `save`, `saveOrThrow`, `update`, `updateOrThrow`,
  `destroy`, `reload`, `touch`.
- State: `persisted`, `newRecord`, `destroyed`.
- Validations: `valid`, `invalid`, `errors`.
- Dirty: `changes`, `changed`, `savedChanges`, attribute history methods.
- Attribute IO: `attributes`, `setAttributes`, `assignAttributes`,
  `[Symbol.iterator]` over attribute names.

### Relation

Chainable, lazy. Backed by a `SelectManager`. Holds:
- `klass`, `arelTable`
- `whereClauses`, `orderValues`, `groupValues`, `havingClauses`,
  `selectValues`, `joinValues`, `limitValue`, `offsetValue`,
  `distinctValue`, `lockValue`
- `loaded`, `records`

Materialization runs `toSql()` through the adapter's visitor, executes,
and instantiates records (with `_setLoadedAttributes`, bypassing dirty
tracking). `then()` is implemented so `await User.where(...)` works
directly.

Methods on `Relation` mirror Rails':
- Chainable: `where`, `whereNot`, `order`, `reorder`, `limit`,
  `offset`, `select`, `pluck`, `joins`, `group`, `having`, `distinct`,
  `lock`, `none`, `or`, `merge`, `unscope`.
- Terminal: `find`, `findBy`, `first`, `last`, `take`, `exists`,
  `count`, `sum`, `min`, `max`, `average`, `toArray`, `toSql`,
  `loadAsync`, `updateAll`, `destroyAll`, `deleteAll`.

`where()` accepts:
- a `Record<string, value>` mapping → equality / IN
- an arel `Node` / `Expression`
- a `[sql, ...binds]` tuple → bound SQL literal
- a raw string → unsanitized SQL literal

### Persistence

`save()` flow:
1. Run `beforeValidation` callbacks
2. Run validators
3. If errors, return false; else run `afterValidation`
4. Run `beforeSave` (+ `beforeCreate` or `beforeUpdate`)
5. INSERT or UPDATE via an `InsertManager`/`UpdateManager`
   - INSERT uses `RETURNING *` on PG, `RETURNING id` on SQLite,
     and `lastInsertId()` on MySQL
   - UPDATE uses the `WHERE primary_key = ?` predicate, includes only
     dirty attributes
6. Refresh attributes from the returned row
7. Mark `_savedChanges = currentChanges`, clear dirty state
8. Run `afterCreate`/`afterUpdate`, then `afterSave`

`destroy()` flow:
1. `beforeDestroy`
2. `DELETE FROM <table> WHERE pk = ?`
3. Mark `_destroyed = true`
4. `afterDestroy`

### Transactions

`Model.transaction(async (tx) => { ... })`. Implemented via a per-adapter
context that pins the same connection for the duration of the callback.
Nesting uses `SAVEPOINT`. Errors thrown inside roll back; the error is
rethrown unless it's `Rollback` (our own sentinel error).

### Type Casting Hook

`Model.typeCastForDatabase(name, value)` is provided to the Arel `Table`
as its `typeCaster`. This lets Arel-generated INSERTs / UPDATEs go
through the same serialization as model writes.

## Migrations (Phase 1 — included)

Per the user's confirmation, migrations are part of Phase 1.

`Migration` base class with a DSL:

```ts
class CreateUsers extends Migration {
  async up(): Promise<void> {
    this.createTable('users', (t) => {
      t.string('name', { null: false });
      t.string('email', { null: false, index: { unique: true } });
      t.timestamps();
    });
  }
  async down(): Promise<void> {
    this.dropTable('users');
  }
}
```

- DSL methods: `createTable`, `dropTable`, `addColumn`, `removeColumn`,
  `changeColumn`, `renameColumn`, `addIndex`, `removeIndex`,
  `addForeignKey`, `removeForeignKey`, `execute`.
- Each DSL call emits adapter-specific DDL via the adapter's
  `SchemaStatements` mixin.
- Tracked in a `schema_migrations` table (version string, single column,
  same as Rails). Runner: `Migrator.up(migrations, target?)`,
  `Migrator.down(migrations, target?)`, `Migrator.rollback(steps?)`.
- No schema dumper in Phase 1 (deferred).

## Out of Scope (Phase 1)

These are deferred — too large for an initial port and not blocking the
core CRUD flow:

- Associations (belongs_to, has_many, has_one, polymorphic, through)
- Eager loading / `includes` / `preload`
- Schema dumper (`schema.rb` equivalent)
- Single Table Inheritance / `inheritance_column`
- Counter cache
- Encrypted attributes
- Multi-database / shards / replicas
- Optimistic locking (`lock_version`)
- Nested attributes
- Composite primary keys
- Store / serialized attributes (`store_accessor`)
- Async query API beyond `await relation`

These can be tackled in follow-up phases.

## Testing

Three tiers:
1. **Unit** (no DB): active-model attribute/dirty/validation/callback logic,
   relation SQL generation against arel string output.
2. **Adapter** (per DB): connection/exec, schema introspection, transaction
   semantics. Skipped automatically if the DB isn't reachable.
3. **End-to-end** (per DB): User/Post fixtures, save/find/destroy round
   trips. Driven by docker-compose for PG and MySQL; SQLite uses an
   in-memory database.

Test runner is Bun's built-in (already used by arel). A `test/_helpers.ts`
file in active-record builds adapter factories so a single test file
parameterizes across PG/MySQL/SQLite.

## Migration Path for Arel Tests

The arel test directory moves wholesale into `packages/arel/test/`. The
root `bun.toml`'s `[test]` block becomes per-package. Verify all tests
still pass before starting active-record work.
