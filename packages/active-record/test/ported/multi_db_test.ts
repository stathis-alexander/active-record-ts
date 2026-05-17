/**
 * Multi-database / multi-role connection tests.
 *
 * Covers:
 *  - `Klass.connectsTo({ writing, reading })` registers two adapters
 *  - `Klass.connectedTo({ role: 'reading' }, fn)` block routes via
 *    AsyncLocalStorage; defaults to writing outside the block.
 *  - Two independent databases registered under named keys
 *    (`{ events: ... }`), switched via `connectedTo({ database })`.
 *  - Abstract-class inheritance — a concrete subclass picks up the
 *    parent's connection map.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Base, Migration, Migrator, SQLiteAdapter, type MigrationConstructor } from '../../src';

class CreateWidgets extends Migration {
  static override version = '001';
  override async up() {
    await this.createTable('widgets', (t) => t.string('name'));
  }
}

let primary: SQLiteAdapter;
let replica: SQLiteAdapter;
let events: SQLiteAdapter;

beforeEach(async () => {
  primary = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  replica = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  events = new SQLiteAdapter({ adapter: 'sqlite', database: ':memory:' });
  await primary.connect();
  await replica.connect();
  await events.connect();
  await new Migrator(primary, [CreateWidgets] as MigrationConstructor[]).up();
  await new Migrator(replica, [CreateWidgets] as MigrationConstructor[]).up();
  await new Migrator(events, [CreateWidgets] as MigrationConstructor[]).up();
});

afterEach(async () => {
  await primary.disconnect();
  await replica.disconnect();
  await events.disconnect();
});

describe('Multi-DB — connectsTo + connectedTo', () => {
  test('connectsTo({ writing, reading }) routes writes to writing role and reads to active role', async () => {
    class Widget extends Base {
      static override tableName = 'widgets';
      declare name: string;
    }
    await Widget.connectsTo({ writing: primary, reading: replica });
    await Widget.loadSchema();

    // Write — goes to primary.
    await Widget.create({ name: 'p-one' });
    expect(await Widget.count()).toBe(1);

    // Manually seed replica with a different row so we can prove which
    // adapter a read hit.
    await replica.exec(`INSERT INTO "widgets" ("name") VALUES (?)`, ['r-one']);

    // Default role outside the block is `writing` — sees only the primary row.
    const writingRows = await Widget.pluck<string>('name');
    expect(writingRows).toEqual(['p-one']);

    // Inside the `reading` block — sees the replica row.
    await Widget.connectedTo({ role: 'reading' }, async () => {
      const replicaRows = await Widget.pluck<string>('name');
      expect(replicaRows).toEqual(['r-one']);
    });

    // After the block, back to writing.
    const afterBlock = await Widget.pluck<string>('name');
    expect(afterBlock).toEqual(['p-one']);
  });

  test('connectsTo({ database: ... }) under a non-role key registers a named DB', async () => {
    class Mixed extends Base {
      static override tableName = 'widgets';
      declare name: string;
    }
    await Mixed.connectsTo({ writing: primary, events: events });
    await Mixed.loadSchema();

    await Mixed.create({ name: 'in-primary' });
    expect(await Mixed.count()).toBe(1);

    await Mixed.connectedTo({ database: 'events' }, async () => {
      // events DB starts empty; insert there.
      await Mixed.create({ name: 'in-events' });
      expect(await Mixed.count()).toBe(1);
    });

    // Back to primary — still just the one row.
    expect(await Mixed.count()).toBe(1);
  });

  test('abstract class inheritance — subclass picks up the parent connection map', async () => {
    class AppRecord extends Base {
      static override abstractClass = true;
    }
    await AppRecord.connectsTo({ writing: primary, reading: replica });

    class Widget extends AppRecord {
      static override tableName = 'widgets';
      declare name: string;
    }
    await Widget.loadSchema();

    await Widget.create({ name: 'inherited' });
    expect(await Widget.count()).toBe(1);

    // Reading role propagates through the prototype chain too.
    await Widget.connectedTo({ role: 'reading' }, async () => {
      // Replica is empty so this should be 0.
      expect(await Widget.count()).toBe(0);
    });
  });

  test('connectedTo blocks isolate per call under concurrent execution', async () => {
    class Widget extends Base {
      static override tableName = 'widgets';
      declare name: string;
    }
    await Widget.connectsTo({ writing: primary, reading: replica });
    await Widget.loadSchema();

    await Widget.create({ name: 'primary-only' });
    await replica.exec(`INSERT INTO "widgets" ("name") VALUES (?)`, ['replica-only']);

    // Two concurrent reads in different role contexts. Both should land
    // on the correct adapter because AsyncLocalStorage preserves the
    // context across each await chain independently.
    const [writingResult, readingResult] = await Promise.all([
      Widget.pluck<string>('name'),
      Widget.connectedTo({ role: 'reading' }, async () => Widget.pluck<string>('name')),
    ]);
    expect(writingResult).toEqual(['primary-only']);
    expect(readingResult).toEqual(['replica-only']);
  });
});
