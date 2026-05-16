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

  test.skip('requires_new flag (TODO: requiresNew option)', () => {});
  test.skip('joinable / inner-most transaction (TODO)', () => {});
});

describe('Transactions — Rollback sentinel', () => {
  test.skip('throw Rollback inside transaction rolls back silently (TODO: Rollback class semantics)', () => {});
});

describe('Transactions — after_commit / after_rollback', () => {
  test.skip('after_commit fires only after outer commit (TODO: after_commit callback)', () => {});
  test.skip('after_rollback fires when transaction rolls back (TODO)', () => {});
  test.skip('after_commit on update vs create (TODO)', () => {});
  test.skip('after_commit on destroy (TODO)', () => {});
  test.skip('after_create_commit shorthand (TODO)', () => {});
});

describe('Transactions — isolation', () => {
  test.skip('isolation: :read_committed (TODO: isolation level)', () => {});
  test.skip('isolation: :serializable (TODO)', () => {});
  test.skip('isolation: :repeatable_read (TODO)', () => {});
});

describe('Transactions — concurrency', () => {
  test.skip('with_lock acquires a row lock (TODO: with_lock)', () => {});
  test.skip('lock! refreshes lock (TODO: lock! method)', () => {});
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

  test.skip('record destroyed-state is restored in-memory after rollback (TODO: restore destroyed flag)', () => {});
  test.skip('save state restored after rollback (TODO: restore persisted flag)', () => {});
  test.skip('dirty state restored after rollback (TODO)', () => {});
});
