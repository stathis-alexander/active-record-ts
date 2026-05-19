# `@active-record-ts/active-record`

A TypeScript port of Rails' [`ActiveRecord`](https://github.com/rails/rails/tree/main/activerecord). Subclass `Base`, point it at a database, get a chainable `Relation` API plus persistence, callbacks, associations, and migrations.

Built on [`@active-record-ts/arel`](../arel) for SQL generation and [`@active-record-ts/active-model`](../active-model) for attributes, dirty tracking, validations, and callbacks.

## Install

```bash
bun add @active-record-ts/active-record
# pick a driver:
bun add postgres        # postgres
bun add mysql2          # mysql
# sqlite uses bun:sqlite (built-in)
```

## Quickstart

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
await User.loadSchema();  // introspect columns -> attributes

await User.create({ name: 'Alex', email: 'a@b.c', age: 30 });
const u = await User.find(1);
u.name = 'Sandy';
await u.save();
```

## Connection adapters

```ts
// SQLite (built into Bun)
await Model.establishConnection({ adapter: 'sqlite', database: ':memory:' });

// Postgres (via node-postgres-compatible `postgres` package)
await Model.establishConnection({ adapter: 'postgres', url: process.env.DATABASE_URL });

// MySQL (via mysql2)
await Model.establishConnection({ adapter: 'mysql', url: process.env.DATABASE_URL });
```

Multi-role / multi-database via `connectsTo` + `connectedTo`:

```ts
await AppRecord.connectsTo({
  writing: { adapter: 'postgres', url: PRIMARY_URL },
  reading: { adapter: 'postgres', url: REPLICA_URL },
});

await AppRecord.connectedTo({ role: 'reading' }, async () => {
  return User.where({ active: true }).count();
});
```

## Features

### CRUD

```ts
const u  = await User.create({ name: 'Alex' });
const u2 = await User.find(1);                   // throws RecordNotFound on miss
const u3 = await User.findBy({ email: 'a@b.c' }); // null on miss
await u.update({ name: 'Sandy' });
await u.destroy();
```

### Relations

`where`, `order`, `limit`, `offset`, `select`, `joins`, `includes`, `group`, `having`, `distinct`, `none`, `readonly` — all chainable, all return a `Relation`. `await` a relation directly to execute it.

```ts
const adults = await User
  .where({ active: true })
  .where({ age: [21, 22, 23] })   // IN
  .order({ age: 'desc' })
  .limit(10);

await User.where({ age: 30 }).count();
await User.exists({ email: 'a@b.c' });
await User.order({ age: 'asc' }).pluck<string>('name');
```

### Bulk operations

```ts
await User.updateAll({ active: false });           // UPDATE users SET active = 0
await User.where({ age: 0 }).deleteAll();          // DELETE without callbacks
await User.where({ flagged: true }).destroyAll();  // instantiate + run callbacks
```

### Validations

```ts
class User extends Base {
  static override tableName = 'users';
  declare name: string;
  declare email: string;
}

User.validates('name', { presence: true, length: { minimum: 2 } });
User.validates('email', { presence: true, format: { with: /@/ } });

const u = new User({ name: '' });
await u.save();                  // false
u.errors.fullMessages;           // ["Name can't be blank", ...]
```

### Callbacks

```ts
User.beforeSave((u) => { u.email = u.email.toLowerCase(); });
User.afterCreate(async (u) => { await sendWelcomeEmail(u.email); });
User.beforeDestroy(async (u) => {
  if (u.protected) throw new Error('cannot destroy');
});
```

Available: `beforeValidation`, `afterValidation`, `beforeSave`, `afterSave`, `aroundSave`, `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDestroy`, `afterDestroy`.

### Dirty tracking

```ts
const u = await User.find(1);
u.name = 'Sandy';
u.changed();          // ['name']
u.changes();          // { name: ['Alex', 'Sandy'] }
await u.save();
u.savedChanges();     // { name: ['Alex', 'Sandy'] }
await u.reload();     // restore from DB
```

### Associations

```ts
class User extends Base { static override tableName = 'users'; }
class Post extends Base { static override tableName = 'posts'; }

Post.belongsTo('user',  { class: () => User });
User.hasMany('posts',   { class: () => Post, dependent: 'destroy' });
User.hasOne('profile',  { class: () => Profile });

const post = await Post.find(1);
const author = await post.user;          // User | null
const posts  = await user.posts.where({ published: true }).order({ created_at: 'desc' });
```

`through:` and polymorphic associations are supported:

```ts
User.hasMany('memberships', { class: () => Membership });
User.hasMany('teams', { through: 'memberships' });

Comment.belongsTo('commentable', { polymorphic: true });
```

### Transactions

```ts
await User.transaction(async () => {
  await User.create({ name: 'Alex' });
  await User.create({ name: 'Sandy' });
  // throw -> rollback. Throw `Rollback` to roll back silently.
});

// With isolation level:
await User.transaction(async () => { /* ... */ }, { isolation: 'serializable' });
```

### Migrations

```ts
import { Migration, Migrator } from '@active-record-ts/active-record';

class CreateUsers extends Migration {
  static override version = '20260101000001';
  override async up() {
    await this.createTable('users', (t) => {
      t.string('name', { null: false });
      t.string('email', { index: { unique: true } });
      t.timestamps();
    });
  }
  override async down() {
    await this.dropTable('users');
  }
}

const migrator = new Migrator(adapter, [CreateUsers]);
await migrator.up();        // apply pending
await migrator.rollback();  // unwind last
```

Schema DSL: `createTable`, `dropTable`, `addColumn`, `removeColumn`, `addIndex`, `addForeignKey`, plus column-type shorthands (`t.string`, `t.integer`, `t.boolean`, `t.timestamps`, etc.).

### Read-only relations

```ts
const u = await User.readonly().find(1);
await u.save();  // throws ReadOnlyRecord
```

## Test

```bash
bun run test:active-record
bun run db:up    # start Postgres + MySQL for integration tests
```
