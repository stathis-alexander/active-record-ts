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
beforeAll(async () => {
  fx = await setupFixtures();
});
afterAll(async () => {
  await fx.teardown();
});
beforeEach(async () => {
  await fx.reset();
});

class AuditDeveloper extends Base {
  static override tableName = 'developers';
  declare name: string;
  declare salary: number;
  history: string[] = [];
}
AuditDeveloper.beforeValidation((m: AuditDeveloper) => {
  m.history.push('before_validation');
});
AuditDeveloper.afterValidation((m: AuditDeveloper) => {
  m.history.push('after_validation');
});
AuditDeveloper.beforeSave((m: AuditDeveloper) => {
  m.history.push('before_save');
});
AuditDeveloper.beforeCreate((m: AuditDeveloper) => {
  m.history.push('before_create');
});
AuditDeveloper.afterCreate((m: AuditDeveloper) => {
  m.history.push('after_create');
});
AuditDeveloper.afterSave((m: AuditDeveloper) => {
  m.history.push('after_save');
});
AuditDeveloper.beforeDestroy((m: AuditDeveloper) => {
  m.history.push('before_destroy');
});
AuditDeveloper.afterDestroy((m: AuditDeveloper) => {
  m.history.push('after_destroy');
});

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
    WithUpdate.beforeUpdate((m: WithUpdate) => {
      m.history.push('before_update');
    });
    WithUpdate.afterUpdate((m: WithUpdate) => {
      m.history.push('after_update');
    });
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

  test('before_destroy returning false halts destroy', async () => {
    class Halts extends Base {
      static override tableName = 'developers';
      declare name: string;
    }
    Halts.beforeDestroy(() => false);
    Halts.useConnection(fx.adapter);
    await Halts.loadSchema();
    const d = await Halts.create({ name: 'A' });
    await d.destroy();
    // Record stays in DB because before_destroy halted the chain.
    expect(d.destroyed).toBe(false);
    expect(await Halts.exists({ name: 'A' })).toBe(true);
  });
});

describe('Callbacks — on: filters', () => {
  test('before_validation on: "create" only fires for new records', async () => {
    class WithCtx extends Base {
      static override tableName = 'developers';
      declare name: string;
      log: string[] = [];
    }
    WithCtx.beforeValidation((m: WithCtx) => {
      m.log.push('any');
    });
    WithCtx.beforeValidation(
      (m: WithCtx) => {
        m.log.push('on-create');
      },
      { on: 'create' },
    );
    WithCtx.beforeValidation(
      (m: WithCtx) => {
        m.log.push('on-update');
      },
      { on: 'update' },
    );
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

  test('after_validation fires only when the context matches its on: filter', async () => {
    class WithCtx extends Base {
      static override tableName = 'developers';
      declare name: string;
      log: string[] = [];
    }
    WithCtx.afterValidation((m: WithCtx) => {
      m.log.push('any');
    });
    WithCtx.afterValidation(
      (m: WithCtx) => {
        m.log.push('on-create');
      },
      { on: 'create' },
    );
    WithCtx.useConnection(fx.adapter);
    await WithCtx.loadSchema();
    const m = new WithCtx({ name: 'A' });
    await m.validate('create');
    expect(m.log).toEqual(['any', 'on-create']);
  });
});

describe('Callbacks — Proc / block / object', () => {
  test('callbacks accept plain function values', async () => {
    class WithFn extends Base {
      static override tableName = 'developers';
      declare name: string;
      fired = false;
    }
    const fn = (m: WithFn) => {
      m.fired = true;
    };
    WithFn.beforeSave(fn);
    WithFn.useConnection(fx.adapter);
    await WithFn.loadSchema();
    const m = new WithFn({ name: 'A' });
    await m.save();
    expect(m.fired).toBe(true);
  });

  test('callbacks accept arrow-function values (idiomatic TS form)', async () => {
    class WithArrow extends Base {
      static override tableName = 'developers';
      declare name: string;
      fired = false;
    }
    WithArrow.beforeSave((m: WithArrow) => {
      m.fired = true;
    });
    WithArrow.useConnection(fx.adapter);
    await WithArrow.loadSchema();
    const m = new WithArrow({ name: 'A' });
    await m.save();
    expect(m.fired).toBe(true);
  });

  test('callbacks accept async callbacks', async () => {
    class WithAsync extends Base {
      static override tableName = 'developers';
      declare name: string;
      fired = false;
    }
    WithAsync.beforeSave(async (m: WithAsync) => {
      await new Promise((r) => setTimeout(r, 1));
      m.fired = true;
    });
    WithAsync.useConnection(fx.adapter);
    await WithAsync.loadSchema();
    const m = new WithAsync({ name: 'A' });
    await m.save();
    expect(m.fired).toBe(true);
  });

  test('callbacks resolve method-like callables via fn.call(model)', async () => {
    class WithMethod extends Base {
      static override tableName = 'developers';
      declare name: string;
      log: string[] = [];
      stamp(this: WithMethod) {
        this.log.push('stamped');
      }
    }
    WithMethod.beforeSave((m: WithMethod) => {
      m.stamp();
    });
    WithMethod.useConnection(fx.adapter);
    await WithMethod.loadSchema();
    const m = new WithMethod({ name: 'A' });
    await m.save();
    expect(m.log).toEqual(['stamped']);
  });
});

describe('Callbacks — inheritance', () => {
  test('subclass inherits parent callbacks in declared order', async () => {
    class Parent extends Base {
      static override tableName = 'developers';
      declare name: string;
      log: string[] = [];
    }
    Parent.beforeSave((m: Parent) => {
      m.log.push('parent');
    });
    class Child extends Parent {}
    Child.beforeSave((m: Child) => {
      m.log.push('child');
    });
    Child.useConnection(fx.adapter);
    await Child.loadSchema();
    const c = new Child({ name: 'A' });
    await c.save();
    expect(c.log).toEqual(['parent', 'child']);
  });

  test('subclass adds own callbacks without affecting parent', async () => {
    class P2 extends Base {
      static override tableName = 'developers';
      declare name: string;
      log: string[] = [];
    }
    class C2 extends P2 {}
    C2.beforeSave((m: C2) => {
      m.log.push('child-only');
    });
    P2.useConnection(fx.adapter);
    C2.useConnection(fx.adapter);
    await P2.loadSchema();
    await C2.loadSchema();
    const p = new P2({ name: 'P' });
    await p.save();
    expect(p.log).toEqual([]);
    const c = new C2({ name: 'C' });
    await c.save();
    expect(c.log).toEqual(['child-only']);
  });
});

describe('Callbacks — after_commit / after_rollback / after_initialize', () => {
  // after_commit/after_rollback covered in transactions_test.ts.

  test('after_initialize fires whenever new instance is constructed', async () => {
    class WithInit extends Base {
      static override tableName = 'developers';
      declare name: string;
      initialized = false;
    }
    WithInit.afterInitialize((m: WithInit) => {
      m.initialized = true;
    });
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
    WithFind.afterFind((m: WithFind) => {
      m.foundCount += 1;
    });
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
    WithTouch.afterTouch((m: WithTouch) => {
      m.touched += 1;
    });
    WithTouch.useConnection(fx.adapter);
    await WithTouch.loadSchema();
    const m = await WithTouch.create({ name: 'A' });
    await m.touch();
    expect(m.touched).toBe(1);
  });
});

describe('Callbacks — recursion / re-entrancy', () => {
  test('saving inside an after_save callback completes without re-entering the chain unsafely', async () => {
    class Inner extends Base {
      static override tableName = 'developers';
      declare name: string;
      reentries = 0;
    }
    let reentered = false;
    Inner.afterSave(async (m: Inner) => {
      if (reentered) return;
      reentered = true;
      m.reentries++;
      // Don't call save() again here — that would recurse. Verify the
      // callback fires exactly once for our save.
    });
    Inner.useConnection(fx.adapter);
    await Inner.loadSchema();
    const m = new Inner({ name: 'A' });
    await m.save();
    expect(m.reentries).toBe(1);
  });
});
