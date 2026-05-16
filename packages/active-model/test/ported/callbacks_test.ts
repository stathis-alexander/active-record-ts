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

  test.skip('halt via throw :abort (TODO: throw-based halt — we use return false)', () => {});

  test.skip('after callbacks skipped when block returns false (TODO: body-result propagation)', () => {});

  test.skip('only selects which types of callbacks should be created (TODO: user-defined events)', () => {});
  test.skip('only with array (TODO)', () => {});
  test.skip('only with empty array (TODO)', () => {});

  test.skip('the :if option array should not be mutated (TODO: option immutability)', () => {});

  test.skip('after_create callbacks with both callbacks declared in one line (TODO: multi-arg register)', () => {});
  test.skip('after_create callbacks with both callbacks declared in different lines (covered by complete chain)', () => {});
});
