/**
 * Ported from activerecord/test/cases/transactions_test.rb (Rails 7.2 branch).
 *
 * The Rails transactions_test is ~1850 lines covering nested transactions,
 * savepoint semantics, after_commit / after_rollback callbacks, isolation
 * levels, concurrent access, and a lot more. We port the fundamentals —
 * commit, rollback, nested savepoint — and skip the rest.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { type Fixtures, setupFixtures, Topic } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => { fx = await setupFixtures(); });
afterAll(async () => { await fx.teardown(); });
beforeEach(async () => { await fx.reset(); });

describe('Transactions — basic', () => {
  test('commit on success', async () => {
    await Topic.transaction(async () => {
      await Topic.create({ title: 'tx-ok' });
    });
    expect(await Topic.exists({ title: 'tx-ok' })).toBe(true);
  });

  test('rollback on throw', async () => {
    await expect(
      Topic.transaction(async () => {
        await Topic.create({ title: 'tx-bad' });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await Topic.exists({ title: 'tx-bad' })).toBe(false);
  });

  test('multiple inserts inside one transaction commit atomically', async () => {
    await Topic.transaction(async () => {
      await Topic.create({ title: 'a' });
      await Topic.create({ title: 'b' });
    });
    expect(await Topic.count()).toBe(2);
  });
});

describe('Transactions — nested with savepoints', () => {
  test('inner rollback preserves outer changes', async () => {
    await Topic.transaction(async () => {
      await Topic.create({ title: 'outer' });
      try {
        await Topic.transaction(async () => {
          await Topic.create({ title: 'inner' });
          throw new Error('inner boom');
        });
      } catch {
        /* expected */
      }
    });
    const titles = (await Topic.pluck<string>('title')).sort();
    expect(titles).toEqual(['outer']);
  });

  test('inner success keeps inner changes', async () => {
    await Topic.transaction(async () => {
      await Topic.create({ title: 'outer' });
      await Topic.transaction(async () => {
        await Topic.create({ title: 'inner' });
      });
    });
    expect(await Topic.count()).toBe(2);
  });

  test('requiresNew flag forces a fresh savepoint', async () => {
    // Inner transaction rolls back independently of the outer.
    await Topic.transaction(async () => {
      await Topic.create({ title: 'outer' });
      try {
        await Topic.transaction(async () => {
          await Topic.create({ title: 'inner' });
          throw new Error('rollback inner');
        }, { requiresNew: true });
      } catch {
        /* expected */
      }
    });
    const titles = (await Topic.pluck<string>('title')).sort();
    expect(titles).toEqual(['outer']);
  });

  test.skip('joinable / inner-most transaction (TODO: opt-out savepoint)', () => {});
});

describe('Transactions — Rollback sentinel', () => {
  test('throw new Rollback() rolls back without surfacing the error', async () => {
    const { Rollback } = await import('../../src');
    const result = await Topic.transaction(async () => {
      await Topic.create({ title: 'will-roll-back' });
      throw new Rollback();
    });
    expect(result).toBeUndefined();
    expect(await Topic.exists({ title: 'will-roll-back' })).toBe(false);
  });
});

describe('Transactions — after_commit / after_rollback', () => {
  test('after_commit fires only after outermost commit', async () => {
    class WithHook extends Topic {}
    const log: string[] = [];
    WithHook.afterCommit(() => { log.push('commit'); });
    WithHook.useConnection(fx.adapter);
    await WithHook.loadSchema();
    await WithHook.transaction(async () => {
      await WithHook.create({ title: 'a' });
      expect(log).toEqual([]);  // not yet
      await WithHook.transaction(async () => {
        await WithHook.create({ title: 'b' });
      });
      expect(log).toEqual([]);  // still not yet — outer hasn't committed
    });
    // Now outer committed; both create hooks fire.
    expect(log).toEqual(['commit', 'commit']);
  });

  test('after_rollback fires when the transaction rolls back', async () => {
    class WithHook extends Topic {}
    const log: string[] = [];
    WithHook.afterCommit(() => { log.push('commit'); });
    WithHook.afterRollback(() => { log.push('rollback'); });
    WithHook.useConnection(fx.adapter);
    await WithHook.loadSchema();
    try {
      await WithHook.transaction(async () => {
        await WithHook.create({ title: 'a' });
        throw new Error('boom');
      });
    } catch {
      /* expected */
    }
    expect(log).toEqual(['rollback']);
  });

  test('after_commit filtered by on: "create" / "update"', async () => {
    class WithHook extends Topic {}
    const log: string[] = [];
    WithHook.afterCommit(() => { log.push('create-commit'); }, { on: 'create' });
    WithHook.afterCommit(() => { log.push('update-commit'); }, { on: 'update' });
    WithHook.useConnection(fx.adapter);
    await WithHook.loadSchema();
    const t = await WithHook.create({ title: 'a' });
    expect(log).toEqual(['create-commit']);
    log.length = 0;
    t.writeAttribute('title', 'b');
    await t.save();
    expect(log).toEqual(['update-commit']);
  });

  test('after_commit on destroy', async () => {
    class WithHook extends Topic {}
    const log: string[] = [];
    WithHook.afterCommit(() => { log.push('destroy-commit'); }, { on: 'destroy' });
    WithHook.useConnection(fx.adapter);
    await WithHook.loadSchema();
    const t = await WithHook.create({ title: 'a' });
    log.length = 0;
    await t.destroy();
    expect(log).toEqual(['destroy-commit']);
  });

  test.skip('after_create_commit shorthand (TODO: helper alias)', () => {});
});

describe('Transactions — isolation', () => {
  test.skip('isolation: :read_committed (TODO: isolation level)', () => {});
  test.skip('isolation: :serializable (TODO)', () => {});
  test.skip('isolation: :repeatable_read (TODO)', () => {});
});

describe('Transactions — concurrency', () => {
  test('withLock wraps in a transaction and yields the reloaded record', async () => {
    const t = await Topic.create({ title: 'guarded' });
    let observed: string | null = null;
    await t.withLock(async (record) => {
      observed = record.readAttribute('title') as string;
      record.writeAttribute('title', 'guarded-mutated');
      await record.save();
    });
    expect(observed).toBe('guarded' as never);
    const after = await Topic.find(t.id);
    expect(after.readAttribute('title')).toBe('guarded-mutated');
  });

  test('lock! reloads the record from the database', async () => {
    const t = await Topic.create({ title: 'original' });
    t.writeAttribute('title', 'pending in memory');
    await Topic.transaction(async () => {
      await t.lockOrThrow();
    });
    expect(t.readAttribute('title')).toBe('original');
  });

  test.skip('two concurrent transactions see correct state (TODO: real concurrency setup)', () => {});
});

describe('Transactions — record state', () => {
  test('records destroyed inside a rolled-back tx are restored in DB', async () => {
    const t = await Topic.create({ title: 'keep me' });
    try {
      await Topic.transaction(async () => {
        await t.destroy();
        throw new Error('roll back the delete');
      });
    } catch {
      /* expected */
    }
    expect(await Topic.exists({ title: 'keep me' })).toBe(true);
  });

  test('record destroyed-state is restored in-memory after rollback', async () => {
    const t = await Topic.create({ title: 'live' });
    try {
      await Topic.transaction(async () => {
        await t.destroy();
        throw new Error('roll back');
      });
    } catch {
      /* expected */
    }
    expect(t.destroyed).toBe(false);
    expect(t.persisted).toBe(true);
  });

  test('save state restored after rollback (create case)', async () => {
    let created: Topic | null = null;
    try {
      await Topic.transaction(async () => {
        created = await Topic.create({ title: 'tx-only' });
        expect(created.persisted).toBe(true);
        throw new Error('rollback');
      });
    } catch {
      /* expected */
    }
    // The in-memory record reverts to newRecord, since the INSERT was rolled back.
    expect(created!.persisted).toBe(false);
  });

  test('attribute state is NOT restored after rollback (matches Rails — call reload to refetch)', async () => {
    const t = await Topic.create({ title: 'original' });
    try {
      await Topic.transaction(async () => {
        t.writeAttribute('title', 'pending');
        await t.save();
        throw new Error('rollback');
      });
    } catch {
      /* expected */
    }
    // In-memory keeps the value we assigned — same as Rails.
    expect(t.readAttribute('title')).toBe('pending');
    // The DB row was rolled back though.
    await t.reload();
    expect(t.readAttribute('title')).toBe('original');
  });
});
