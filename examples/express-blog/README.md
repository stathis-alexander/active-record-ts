# express-blog

End-to-end Express app on top of `@active-record-ts/active-record`. A small blog API with users, posts, validations, callbacks, associations, transactions, and migrations against in-memory SQLite.

## Run

```bash
bun install                              # from repo root
bun run --cwd examples/express-blog start
```

Defaults: SQLite in-memory, port 3000. Override with `DB_PATH=./blog.db PORT=4000`.

Open <http://localhost:3000/> for a tiny UI: enter name + email to look up a user, view the last 10 posts, and create a new post.

## What it shows

- `src/migrations.ts` — `Migration` subclasses + table builder DSL.
- `src/models.ts` — `Base` subclasses, validations, callbacks, `belongsTo` / `hasMany`.
- `src/db.ts` — `establishConnection` + `Migrator.up` + `loadSchema`.
- `src/index.ts` — `find`, `where`, `order`, `limit`, `save`, `update`, `destroy`, transactions, and `RecordNotFound` / `RecordInvalid` error mapping.

## Try it

```bash
curl -X POST localhost:3000/users -H 'content-type: application/json' \
  -d '{"name":"Alex","email":"a@b.c"}'
# -> 201 { "id": 1, ... }

curl -X POST localhost:3000/posts -H 'content-type: application/json' \
  -d '{"user_id":1,"title":"hello","body":"first post","published":true}'

curl localhost:3000/posts?published=true
curl localhost:3000/users/1/posts
```
