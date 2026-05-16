# Local databases for integration tests

This `docker-compose.yml` provisions Postgres and MySQL for the
active-record integration tests. SQLite uses an in-memory file and
doesn't need a container.

```bash
# from the repo root
bun run db:up        # start both
bun run db:down      # stop and remove volumes
```

## Connection details

| DB       | Host        | Port   | DB           | User     | Password |
| -------- | ----------- | ------ | ------------ | -------- | -------- |
| Postgres | localhost   | 54329  | arelts_test  | arelts   | arelts   |
| MySQL    | 127.0.0.1   | 33069  | arelts_test  | arelts   | arelts   |

Ports are non-default so they don't collide with whatever else you have
running locally.

## Env vars

The integration test harness reads these (and skips the suite when the
relevant DB is unreachable):

- `AR_PG_URL` (default: `postgres://arelts:arelts@localhost:54329/arelts_test`)
- `AR_MYSQL_URL` (default: `mysql://arelts:arelts@127.0.0.1:33069/arelts_test`)
- `AR_BUN_PG` — set to `1` to also run the Postgres suite against `Bun.SQL`
