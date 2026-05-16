/**
 * Per-class connection registry. Each `Base` subclass either holds its own
 * adapter or inherits the nearest ancestor's. Resolution walks the
 * prototype chain so subclasses transparently see their parent's adapter.
 */

import type { ConnectionAdapter } from './ConnectionAdapter';

/** Hidden field stored on the constructor itself. */
const CONNECTION = Symbol.for('@arelts/active-record:connection');

// biome-ignore lint/suspicious/noExplicitAny: registry stored on constructor
type Ctor = any;

export const setConnection = (ctor: Ctor, adapter: ConnectionAdapter): void => {
  Object.defineProperty(ctor, CONNECTION, { value: adapter, enumerable: false, configurable: true, writable: true });
};

export const getConnection = (ctor: Ctor): ConnectionAdapter | null => {
  let target: Ctor | null = ctor;
  while (target && target !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(target, CONNECTION)) return target[CONNECTION] as ConnectionAdapter;
    target = Object.getPrototypeOf(target);
  }
  return null;
};

export const clearConnection = (ctor: Ctor): void => {
  if (Object.prototype.hasOwnProperty.call(ctor, CONNECTION)) {
    delete ctor[CONNECTION];
  }
};
