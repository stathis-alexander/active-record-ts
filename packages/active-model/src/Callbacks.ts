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
export type CallbackEvent =
  | 'validation'
  | 'save'
  | 'create'
  | 'update'
  | 'destroy'
  | 'commit'
  | 'rollback'
  | 'initialize'
  | 'find'
  | 'touch';

export type CallbackFn<T> = (record: T) => void | boolean | Promise<void | boolean>;
export type AroundCallbackFn<T> = (record: T, run: () => Promise<void>) => Promise<void>;

type CallbackEntry<T> = {
  kind: CallbackKind;
  fn: CallbackFn<T> | AroundCallbackFn<T>;
  /** Conditional guard — if it returns false, the callback is skipped. */
  if?: (record: T) => boolean;
  unless?: (record: T) => boolean;
  /** Limit the callback to one or more contexts (e.g. validation context). */
  on?: string | string[];
};

/** Sentinel — throw inside a callback to cleanly halt the chain. */
export class HaltError extends Error {
  constructor() {
    super('Callback chain halted');
  }
}

/**
 * Symbol-shaped sentinel callers can throw to halt the chain — mirrors
 * Rails' `throw :abort` semantics. The chain swallows it and treats it
 * as a `false` return from a `before_*` callback.
 */
export const ABORT_SENTINEL = Symbol.for('@arelts/active-model:abort');

/** Convenience helper for chain implementations: convert "throw :abort" to a clean halt. */
export const throwAbort = (): never => {
  throw ABORT_SENTINEL;
};

export class CallbackChain<T> {
  private readonly chains: Record<CallbackEvent, CallbackEntry<T>[]> = {
    validation: [],
    save: [],
    create: [],
    update: [],
    destroy: [],
    commit: [],
    rollback: [],
    initialize: [],
    find: [],
    touch: [],
  };

  /** Register a new callback under `event` of `kind`. */
  add(event: CallbackEvent, kind: CallbackKind, fn: CallbackFn<T> | AroundCallbackFn<T>,
      options?: { if?: (record: T) => boolean; unless?: (record: T) => boolean; on?: string | string[] }): void {
    this.chains[event].push({ kind, fn, if: options?.if, unless: options?.unless, on: options?.on });
  }

  /** Copy chains from a parent so subclasses inherit before extending. */
  inheritFrom(parent: CallbackChain<T>): void {
    for (const event of Object.keys(this.chains) as CallbackEvent[]) {
      this.chains[event] = [...parent.chains[event]];
    }
  }

  /**
   * Run the chain around `body`. Returns `false` when a `before` callback
   * halts; otherwise returns the return value of `body`. Pass a `context`
   * to filter callbacks registered with `on:` — primarily used for
   * validation contexts (`create`/`update`) but available everywhere.
   */
  async run(event: CallbackEvent, record: T, body: () => Promise<void>, context?: string): Promise<boolean> {
    const entries = this.chains[event];
    const befores = entries.filter((e) => e.kind === 'before');
    const afters = entries.filter((e) => e.kind === 'after');
    const arounds = entries.filter((e) => e.kind === 'around');

    for (const entry of befores) {
      if (!guard(entry, record, context)) continue;
      try {
        const result = await (entry.fn as CallbackFn<T>)(record);
        if (result === false) return false;
      } catch (err) {
        if (err instanceof HaltError) return false;
        if (err === ABORT_SENTINEL) return false;
        throw err;
      }
    }

    // Build the inner runner as a chain of around callbacks wrapping `body`.
    let runner: () => Promise<void> = body;
    for (let i = arounds.length - 1; i >= 0; i--) {
      const around = arounds[i];
      if (!around || !guard(around, record, context)) continue;
      const inner = runner;
      runner = () => (around.fn as AroundCallbackFn<T>)(record, inner);
    }

    await runner();

    for (const entry of afters) {
      if (!guard(entry, record, context)) continue;
      try {
        await (entry.fn as CallbackFn<T>)(record);
      } catch (err) {
        if (err instanceof HaltError) break;
        if (err === ABORT_SENTINEL) break;
        throw err;
      }
    }
    return true;
  }
}

const guard = <T>(entry: CallbackEntry<T>, record: T, context?: string): boolean => {
  if (entry.on !== undefined) {
    const wanted = Array.isArray(entry.on) ? entry.on : [entry.on];
    if (context === undefined) return false;
    if (!wanted.includes(context)) return false;
  }
  if (entry.if && !entry.if(record)) return false;
  if (entry.unless && entry.unless(record)) return false;
  return true;
};
