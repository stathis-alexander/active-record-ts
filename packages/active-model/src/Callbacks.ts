/**
 * Per-class callback chains for save/create/update/destroy/validation.
 *
 * Each chain holds an ordered list of callbacks. A `before` callback may
 * abort the chain by returning `false`. `around` callbacks receive a
 * `yield` function that runs the rest of the chain.
 *
 * The shape mirrors `ActiveSupport::Callbacks` enough to express Rails-y
 * lifecycle hooks, without trying to be a general callback framework.
 */

export type CallbackKind = 'before' | 'after' | 'around';
export type CallbackEvent = 'validation' | 'save' | 'create' | 'update' | 'destroy';

export type CallbackFn<T> = (record: T) => void | boolean | Promise<void | boolean>;
export type AroundCallbackFn<T> = (record: T, run: () => Promise<void>) => Promise<void>;

type CallbackEntry<T> = {
  kind: CallbackKind;
  fn: CallbackFn<T> | AroundCallbackFn<T>;
  /** Conditional guard — if it returns false, the callback is skipped. */
  if?: (record: T) => boolean;
  unless?: (record: T) => boolean;
};

/** Sentinel — throw inside a callback to cleanly halt the chain. */
export class HaltError extends Error {
  constructor() {
    super('Callback chain halted');
  }
}

export class CallbackChain<T> {
  private readonly chains: Record<CallbackEvent, CallbackEntry<T>[]> = {
    validation: [],
    save: [],
    create: [],
    update: [],
    destroy: [],
  };

  /** Register a new callback under `event` of `kind`. */
  add(event: CallbackEvent, kind: CallbackKind, fn: CallbackFn<T> | AroundCallbackFn<T>,
      options?: { if?: (record: T) => boolean; unless?: (record: T) => boolean }): void {
    this.chains[event].push({ kind, fn, if: options?.if, unless: options?.unless });
  }

  /** Copy chains from a parent so subclasses inherit before extending. */
  inheritFrom(parent: CallbackChain<T>): void {
    for (const event of Object.keys(this.chains) as CallbackEvent[]) {
      this.chains[event] = [...parent.chains[event]];
    }
  }

  /**
   * Run the chain around `body`. Returns `false` when a `before` callback
   * halts; otherwise returns the return value of `body`.
   */
  async run(event: CallbackEvent, record: T, body: () => Promise<void>): Promise<boolean> {
    const entries = this.chains[event];
    const befores = entries.filter((e) => e.kind === 'before');
    const afters = entries.filter((e) => e.kind === 'after');
    const arounds = entries.filter((e) => e.kind === 'around');

    for (const entry of befores) {
      if (!guard(entry, record)) continue;
      try {
        const result = await (entry.fn as CallbackFn<T>)(record);
        if (result === false) return false;
      } catch (err) {
        if (err instanceof HaltError) return false;
        throw err;
      }
    }

    // Build the inner runner as a chain of around callbacks wrapping `body`.
    let runner: () => Promise<void> = body;
    for (let i = arounds.length - 1; i >= 0; i--) {
      const around = arounds[i];
      if (!around || !guard(around, record)) continue;
      const inner = runner;
      runner = () => (around.fn as AroundCallbackFn<T>)(record, inner);
    }

    await runner();

    for (const entry of afters) {
      if (!guard(entry, record)) continue;
      try {
        await (entry.fn as CallbackFn<T>)(record);
      } catch (err) {
        if (err instanceof HaltError) break;
        throw err;
      }
    }
    return true;
  }
}

const guard = <T>(entry: CallbackEntry<T>, record: T): boolean => {
  if (entry.if && !entry.if(record)) return false;
  if (entry.unless && entry.unless(record)) return false;
  return true;
};
