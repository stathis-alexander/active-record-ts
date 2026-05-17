/**
 * Ported from activerecord/test/cases/callbacks_test.rb (Rails 7.2 branch).
 *
 * Rails' AR callbacks layer adds many features over the AM core: callback
 * filter objects, `throw :abort` halt semantics, `on: :create` / `:update`
 * filters, `after_commit`/`after_rollback`, `after_initialize`,
 * `after_touch`. We port the basics — chain ordering and halting via
 * before-callback returning false — and skip the rest.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Base } from '../../src';
import { type Fixtures, setupFixtures } from './_fixtures';

let fx: Fixtures;
beforeAll(async () => { fx = await setupFixtures(); });
afterAll(async () => { await fx.teardown(); });
beforeEach(async () => { await fx.reset(); });

class AuditDeveloper extends Base {
  static override tableName = 'developers';
  declare name: string;
  declare salary: number;
  history: string[] = [];
}
AuditDeveloper.beforeValidation((m: AuditDeveloper) => { m.history.push('before_validation'); });
AuditDeveloper.afterValidation((m: AuditDeveloper) => { m.history.push('after_validation'); });
AuditDeveloper.beforeSave((m: AuditDeveloper) => { m.history.push('before_save'); });
AuditDeveloper.beforeCreate((m: AuditDeveloper) => { m.history.push('before_create'); });
AuditDeveloper.afterCreate((m: AuditDeveloper) => { m.history.push('after_create'); });
AuditDeveloper.afterSave((m: AuditDeveloper) => { m.history.push('after_save'); });
AuditDeveloper.beforeDestroy((m: AuditDeveloper) => { m.history.push('before_destroy'); });
AuditDeveloper.afterDestroy((m: AuditDeveloper) => { m.history.push('after_destroy'); });

describe('Callbacks — chain ordering on create', () => {
  test('full chain runs in order around save+create', async () => {
    AuditDeveloper.useConnection(fx.adapter);
    await AuditDeveloper.loadSchema();
    const d = new AuditDeveloper({ name: 'X', salary: 1 });
    await d.save();
    expect(d.history).toEqual([
      'before_validation',
      'after_validation',
      'before_save',
      'before_create',
      'after_create',
      'after_save',
    ]);
  });
});

describe('Callbacks — chain ordering on update', () => {
  test('update fires update callbacks (not create) and save chain', async () => {
    AuditDeveloper.useConnection(fx.adapter);
    await AuditDeveloper.loadSchema();
    class WithUpdate extends AuditDeveloper {}
    WithUpdate.beforeUpdate((m: WithUpdate) => { m.history.push('before_update'); });
    WithUpdate.afterUpdate((m: WithUpdate) => { m.history.push('after_update'); });
    WithUpdate.useConnection(fx.adapter);
    await WithUpdate.loadSchema();
    const d = new WithUpdate({ name: 'X', salary: 1 });
    await d.save();
    d.history = [];
    d.writeAttribute('name', 'Y');
    await d.save();
    expect(d.history).toEqual([
      'before_validation',
      'after_validation',
      'before_save',
      'before_update',
      'after_update',
      'after_save',
    ]);
  });
});

describe('Callbacks — halt semantics', () => {
  test('before callback returning false halts save', async () => {
    class Halts extends Base {
      static override tableName = 'developers';
      declare name: string;
    }
    Halts.beforeSave(() => false);
    Halts.useConnection(fx.adapter);
    await Halts.loadSchema();
    const d = new Halts({ name: 'A' });
    const ok = await d.save();
    expect(ok).toBe(false);
    expect(d.persisted).toBe(false);
  });


  test.skip('before_destroy returning false halts destroy (TODO: destroy halt parity)', () => {});
});

describe('Callbacks — on: filters', () => {
  test('before_validation on: "create" only fires for new records', async () => {
    class WithCtx extends Base {
      static override tableName = 'developers';
      declare name: string;
      log: string[] = [];
    }
    WithCtx.beforeValidation((m: WithCtx) => { m.log.push('any'); });
    WithCtx.beforeValidation((m: WithCtx) => { m.log.push('on-create'); }, { on: 'create' });
    WithCtx.beforeValidation((m: WithCtx) => { m.log.push('on-update'); }, { on: 'update' });
    WithCtx.useConnection(fx.adapter);
    await WithCtx.loadSchema();

    const m = new WithCtx({ name: 'A' });
    await m.save();
    expect(m.log).toContain('on-create');
    expect(m.log).not.toContain('on-update');

    m.log = [];
    m.writeAttribute('name', 'B');
    await m.save();
    expect(m.log).toContain('on-update');
    expect(m.log).not.toContain('on-create');
  });

  test('validators with on: "create" only check new records', async () => {
    class WithCtxValidator extends Base {
      static override tableName = 'developers';
      declare name: string;
    }
    WithCtxValidator.validatesPresenceOf('name', { on: 'create' });
    WithCtxValidator.useConnection(fx.adapter);
    await WithCtxValidator.loadSchema();

    const m = new WithCtxValidator();
    expect(await m.save()).toBe(false);
    expect(m.errors.on('name').length > 0).toBe(true);

    // Once persisted with a name, a subsequent update should not trigger the create-only validator.
    m.writeAttribute('name', 'X');
    await m.save();
    m.writeAttribute('name', '');
    expect(await m.save()).toBe(true);
  });

  test.skip('after_validation context filtering (TODO: nuanced after-context tests)', () => {});
});

describe('Callbacks — Proc / block / object', () => {
  test.skip('callbacks accept Proc objects (TODO: Proc parity)', () => {});
  test.skip('callbacks accept callable objects with matching method (TODO)', () => {});
  test.skip('callbacks accept blocks (TODO: do/end style)', () => {});
  test.skip('symbol callback resolves to instance method (TODO)', () => {});
});

describe('Callbacks — inheritance', () => {
  test.skip('subclass inherits parent callbacks (TODO: verify inheritance ordering across subclasses)', () => {});
  test.skip('subclass adds own callbacks without affecting parent (TODO)', () => {});
});

describe('Callbacks — after_commit / after_rollback / after_initialize', () => {
  // after_commit/after_rollback covered in transactions_test.ts.

  test('after_initialize fires whenever new instance is constructed', async () => {
    class WithInit extends Base {
      static override tableName = 'developers';
      declare name: string;
      initialized = false;
    }
    WithInit.afterInitialize((m: WithInit) => { m.initialized = true; });
    WithInit.useConnection(fx.adapter);
    await WithInit.loadSchema();
    const m = new WithInit({ name: 'X' });
    // Wait one microtask — the fire-and-forget hook completes.
    await Promise.resolve();
    expect(m.initialized).toBe(true);
  });

  test('after_find fires when records are hydrated from the DB', async () => {
    class WithFind extends Base {
      static override tableName = 'developers';
      declare name: string;
      foundCount = 0;
    }
    WithFind.afterFind((m: WithFind) => { m.foundCount += 1; });
    WithFind.useConnection(fx.adapter);
    await WithFind.loadSchema();
    await WithFind.create({ name: 'A' });
    const found = await WithFind.first();
    await Promise.resolve();
    expect(found?.foundCount).toBe(1);
  });

  test('after_touch fires after `touch()`', async () => {
    class WithTouch extends Base {
      static override tableName = 'developers';
      declare name: string;
      touched = 0;
    }
    WithTouch.afterTouch((m: WithTouch) => { m.touched += 1; });
    WithTouch.useConnection(fx.adapter);
    await WithTouch.loadSchema();
    const m = await WithTouch.create({ name: 'A' });
    await m.touch();
    expect(m.touched).toBe(1);
  });
});

describe('Callbacks — recursion / re-entrancy', () => {
  test.skip('saving inside an after_save callback (TODO: re-entry safety)', () => {});
});
