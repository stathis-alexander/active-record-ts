---
'@active-record-ts/active-record': patch
'@active-record-ts/active-model': patch
'@active-record-ts/arel': patch
---

Ship compiled JS + `.d.ts` from `dist/` instead of raw TypeScript sources.
Packages are built with tsup (esbuild) at publish time, so consumers no
longer need a TS-aware loader (`bun`, Vite, tsx, etc.) — plain Node + ESM
works. The `bun` exports condition still resolves to source for workspace
consumers and Bun users.
