# @active-record-ts/active-model

## 1.1.0

### Minor Changes

- [#25](https://github.com/stathis-alexander/active-record-ts/pull/25) [`e60a70e`](https://github.com/stathis-alexander/active-record-ts/commit/e60a70e5d4624f009c1e4627a2cc94d4e621c368) Thanks [@stathis-alexander](https://github.com/stathis-alexander)! - Publish compiled ESM artifacts.

  Packages now ship compiled JavaScript and `.d.ts` declarations from
  `dist/` instead of raw TypeScript sources. The build is run by
  [tsup](https://tsup.egoist.dev) (esbuild) via each package's `prepack`
  hook, so the release pipeline picks it up automatically.

  **For consumers**

  - No TypeScript-aware loader required. Plain Node + ESM works (and so
    do Vite, webpack, esbuild, tsx, Bun, etc.).
  - Type declarations are pre-generated as `.d.ts` files — no more
    parsing source on every consumer build.
  - The `bun` exports condition still resolves to the original TS source,
    so anything running under Bun (including this monorepo's own tests)
    keeps the zero-build dev loop.

  **`@active-record-ts/arel`**

  - Replaced `Bun.hash` with an inline FNV-1a so the compiled JS runs on
    any ESM runtime, not just Bun. The hash is used only as an internal
    cache key and is never persisted, so the algorithm swap is safe.

  **`@active-record-ts/active-record`**

  - The `active-record` CLI binary is now compiled to `dist/cli.js` with
    the shebang preserved.
  - `mysql2` and `postgres` (declared as `optionalDependencies`) and any
    `bun:*` built-ins remain external — they are not bundled into the
    shipped artifact.
