import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'bin/active-record.ts',
  },
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  clean: true,
  sourcemap: true,
  target: 'es2022',
  shims: true,
  // Bun built-ins + optionalDependencies. tsup externalizes `dependencies`
  // and `peerDependencies` automatically but not `optionalDependencies`.
  external: ['bun', /^bun:/, 'mysql2', /^mysql2\//, 'postgres'],
});
