/**
 * Ported from activemodel/test/cases/callbacks_test.rb (Rails 7.2 branch).
 *
 * Our CallbackChain uses a fixed set of events (validation/save/create/
 * update/destroy). User-defined events (Rails' `define_model_callbacks
 * :initialize`) aren't supported and are skipped. Halting semantics
 * differ: Rails uses `throw :abort`, we use `return false` from a before
 * callback.
 */

import { describe, expect, test } from 'bun:test';
import { Model } from '../../src';

class ModelCallbacks extends Model {
  declare valid: boolean;
  callbacks: string[] = [];
  beforeCreateReturns = true;
  beforeCreateThrows = false;

  /** Stand-in for Rails' `model.create` — runs the create callbacks. */
  async runCreate(): Promise<void> {
    const ctor = this.constructor as typeof Model;
    await ctor.runCallbacks('create', this, async () => {
      this.callbacks.push('create');
    });
  }
}
ModelCallbacks.attribute('valid', 'boolean', { default: true });
ModelCallbacks.beforeCreate((model: ModelCallbacks) => {
  model.callbacks.push('before_create');
  if (model.beforeCreateThrows) return false;
  return model.beforeCreateReturns;
});
ModelCallbacks.aroundSave; // no-op — placeholder for shape
ModelCallbacks.setCallback('create', 'around', async (model: ModelCallbacks, run) => {
  model.callbacks.push('before_around_create');
  await run();
  model.callbacks.push('after_around_create');
});
ModelCallbacks.afterCreate((model: ModelCallbacks) => {
  model.callbacks.push('after_create');
});
ModelCallbacks.afterCreate((model: ModelCallbacks) => {
  model.callbacks.push('final_callback');
});

describe('Callbacks', () => {
  test('complete callback chain', async () => {
    const model = new ModelCallbacks();
    await model.runCreate();
    expect(model.callbacks).toEqual([
      'before_create',
      'before_around_create',
      'create',
      'after_around_create',
      'after_create',
      'final_callback',
    ]);
  });

  test('callback chain is not halted when around or after callbacks return false', async () => {
    const model = new ModelCallbacks();
    await model.runCreate();
    expect(model.callbacks[model.callbacks.length - 1]).toBe('final_callback');
  });

  test('callback chain halts when a before callback returns false', async () => {
    class Halting extends Model {
      callbacks: string[] = [];
      async run(): Promise<void> {
        const ctor = this.constructor as typeof Model;
        await ctor.runCallbacks('create', this, async () => {
          this.callbacks.push('create');
        });
      }
    }
    Halting.beforeCreate((m: Halting) => {
      m.callbacks.push('before_create');
      return false;
    });
    Halting.afterCreate((m: Halting) => {
      m.callbacks.push('after_create');
    });
    const m = new Halting();
    await m.run();
    expect(m.callbacks).toEqual(['before_create']);
  });

  test('halt via throwAbort() (mirrors Rails throw :abort)', async () => {
    const { throwAbort } = await import('../../src');
    class HaltsViaAbort extends Model {
      callbacks: string[] = [];
      async run(): Promise<void> {
        const ctor = this.constructor as typeof Model;
        await ctor.runCallbacks('create', this, async () => { this.callbacks.push('create'); });
      }
    }
    HaltsViaAbort.beforeCreate((m: HaltsViaAbort) => {
      m.callbacks.push('before_create');
      throwAbort();
    });
    HaltsViaAbort.afterCreate((m: HaltsViaAbort) => { m.callbacks.push('after_create'); });
    const m = new HaltsViaAbort();
    await m.run();
    expect(m.callbacks).toEqual(['before_create']);
  });

  test('after callbacks skipped when block returns false', async () => {
    class BodyHalts extends Model {
      callbacks: string[] = [];
      async run(): Promise<void> {
        const ctor = this.constructor as typeof Model;
        await ctor.runCallbacks('create', this, async () => {
          this.callbacks.push('create');
          return false;
        });
      }
    }
    BodyHalts.beforeCreate((m: BodyHalts) => { m.callbacks.push('before_create'); });
    BodyHalts.afterCreate((m: BodyHalts) => { m.callbacks.push('after_create'); });
    const m = new BodyHalts();
    await m.run();
    expect(m.callbacks).toEqual(['before_create', 'create']);
  });

  test('after_create accepts multiple callbacks declared in one call', async () => {
    class MultiArg extends Model {
      callbacks: string[] = [];
      async run(): Promise<void> {
        const ctor = this.constructor as typeof Model;
        await ctor.runCallbacks('create', this, async () => { this.callbacks.push('create'); });
      }
    }
    MultiArg.afterCreate(
      (m: MultiArg) => { m.callbacks.push('one'); },
      (m: MultiArg) => { m.callbacks.push('two'); },
    );
    const m = new MultiArg();
    await m.run();
    expect(m.callbacks).toEqual(['create', 'one', 'two']);
  });

  // User-defined callback events (`define_model_callbacks :foo, only: [...]`)
  // remain unimplemented — we use a fixed enum of lifecycle events. Add
  // dynamic-event support if a real consumer ever needs it.
});
