/**
 * Migration runner. Tracks applied migrations in `schema_migrations`,
 * applies them in version order, and supports `up` / `down` / `rollback`.
 */

import type { ConnectionAdapter } from './ConnectionAdapter';
import type { MigrationConstructor } from './Migration';

const TABLE = 'schema_migrations';

export class Migrator {
  constructor(private readonly adapter: ConnectionAdapter, private readonly migrations: MigrationConstructor[]) {}

  /** Ensure the schema_migrations tracking table exists. */
  async ensureSchemaTable(): Promise<void> {
    const quoted = this.adapter.quoteIdentifier(TABLE);
    const quotedCol = this.adapter.quoteIdentifier('version');
    await this.adapter.exec(`CREATE TABLE IF NOT EXISTS ${quoted} (${quotedCol} VARCHAR(255) PRIMARY KEY)`);
  }

  /** All applied migration versions, sorted. */
  async appliedVersions(): Promise<string[]> {
    await this.ensureSchemaTable();
    const rows = (await this.adapter.execute(
      `SELECT ${this.adapter.quoteIdentifier('version')} AS v FROM ${this.adapter.quoteIdentifier(TABLE)}`,
    )) as Array<{ v: string }>;
    return rows.map((r) => r.v).sort();
  }

  /** Apply all pending migrations (or up to `target` if given). */
  async up(target?: string): Promise<string[]> {
    const applied = new Set(await this.appliedVersions());
    const sorted = this.sortedMigrations();
    const ran: string[] = [];
    for (const M of sorted) {
      if (applied.has(M.version)) continue;
      if (target && M.version > target) break;
      const inst = new M();
      inst.bind(this.adapter);
      await inst.up();
      await this.recordApplied(M.version);
      ran.push(M.version);
    }
    return ran;
  }

  /** Roll back migrations down to `target` (exclusive). */
  async down(target = ''): Promise<string[]> {
    const applied = new Set(await this.appliedVersions());
    const sorted = this.sortedMigrations().reverse();
    const reverted: string[] = [];
    for (const M of sorted) {
      if (!applied.has(M.version)) continue;
      if (target && M.version <= target) break;
      const inst = new M();
      inst.bind(this.adapter);
      await inst.down();
      await this.recordReverted(M.version);
      reverted.push(M.version);
    }
    return reverted;
  }

  /** Roll back the most recent `steps` migrations. */
  async rollback(steps = 1): Promise<string[]> {
    const applied = await this.appliedVersions();
    const reverted: string[] = [];
    const sorted = this.sortedMigrations().reverse();
    let count = 0;
    for (const M of sorted) {
      if (!applied.includes(M.version)) continue;
      if (count >= steps) break;
      const inst = new M();
      inst.bind(this.adapter);
      await inst.down();
      await this.recordReverted(M.version);
      reverted.push(M.version);
      count++;
    }
    return reverted;
  }

  private sortedMigrations(): MigrationConstructor[] {
    return [...this.migrations].sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  }

  private async recordApplied(version: string): Promise<void> {
    const quoted = this.adapter.quoteIdentifier(TABLE);
    const quotedCol = this.adapter.quoteIdentifier('version');
    const placeholder = this.placeholder(1);
    await this.adapter.exec(`INSERT INTO ${quoted} (${quotedCol}) VALUES (${placeholder})`, [version]);
  }

  private async recordReverted(version: string): Promise<void> {
    const quoted = this.adapter.quoteIdentifier(TABLE);
    const quotedCol = this.adapter.quoteIdentifier('version');
    const placeholder = this.placeholder(1);
    await this.adapter.exec(`DELETE FROM ${quoted} WHERE ${quotedCol} = ${placeholder}`, [version]);
  }

  /** Bind placeholder syntax — PG uses $N, others use ?. */
  private placeholder(index: number): string {
    return this.adapter.adapterName === 'postgres' || this.adapter.adapterName === 'postgres-bun' ? `$${index}` : '?';
  }
}
