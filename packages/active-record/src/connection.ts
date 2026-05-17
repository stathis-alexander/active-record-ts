/**
 * Per-class connection registry with named roles and databases.
 *
 * Single-DB apps still call `Class.useConnection(adapter)` (or
 * `Class.establishConnection(config)`) and one anonymous adapter handles
 * everything. Multi-DB apps call
 *
 *   Class.connectsTo({
 *     writing: { adapter: 'postgres', url: PRIMARY_URL },
 *     reading: { adapter: 'postgres', url: REPLICA_URL },
 *   });
 *
 * which connects two adapters under the named roles. Resolution picks
 * the role from the active `AsyncLocalStorage` context (set by
 * `Class.connectedTo({ role }, fn)`), falling back to `'writing'`.
 *
 * Named *databases* work the same way — you can register additional
 * connections under arbitrary keys and switch via
 * `connectedTo({ database: 'events' }, fn)`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ConnectionAdapter } from './ConnectionAdapter';

const REGISTRY = Symbol.for('@arelts/active-record:connections');

export type Role = 'writing' | 'reading' | (string & {});

export type RoleRegistry = {
  /** The default anonymous adapter (set by `useConnection`/`establishConnection`). */
  default?: ConnectionAdapter;
  /** Named roles registered via `connectsTo`. */
  roles: Map<string, ConnectionAdapter>;
  /** Named databases registered via `connectsTo` with non-role keys. */
  databases: Map<string, ConnectionAdapter>;
};

/** Active-context shape pushed by `connectedTo`. */
export type ConnectionContext = {
  role?: string;
  database?: string;
};

/** Async-local storage for the currently-active connection context. */
export const connectionContext = new AsyncLocalStorage<ConnectionContext>();

// biome-ignore lint/suspicious/noExplicitAny: registry stored on constructor
type Ctor = any;

/** Ensure a registry exists on this class (creates one on demand). */
const ensureRegistry = (ctor: Ctor): RoleRegistry => {
  if (!Object.prototype.hasOwnProperty.call(ctor, REGISTRY)) {
    const fresh: RoleRegistry = { roles: new Map(), databases: new Map() };
    Object.defineProperty(ctor, REGISTRY, { value: fresh, enumerable: false, configurable: true, writable: false });
  }
  return ctor[REGISTRY] as RoleRegistry;
};

/** Resolve the registry walking the prototype chain (does NOT create). */
const findRegistry = (ctor: Ctor): RoleRegistry | null => {
  let target: Ctor | null = ctor;
  while (target && target !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(target, REGISTRY)) return target[REGISTRY] as RoleRegistry;
    target = Object.getPrototypeOf(target);
  }
  return null;
};

/** Legacy single-adapter API: set the default connection. */
export const setConnection = (ctor: Ctor, adapter: ConnectionAdapter): void => {
  ensureRegistry(ctor).default = adapter;
};

/** Register an adapter under a named role on this class. */
export const setRoleConnection = (ctor: Ctor, role: string, adapter: ConnectionAdapter): void => {
  ensureRegistry(ctor).roles.set(role, adapter);
};

/** Register an adapter under a named database on this class. */
export const setDatabaseConnection = (ctor: Ctor, database: string, adapter: ConnectionAdapter): void => {
  ensureRegistry(ctor).databases.set(database, adapter);
};

/**
 * Resolve the active adapter for this class. Looks up:
 *   1. The async-local context's database override.
 *   2. The async-local context's role.
 *   3. The class's `writing` role (Rails default).
 *   4. The class's anonymous `default` adapter.
 *
 * Walks up the prototype chain at each step so subclasses inherit.
 */
export const getConnection = (ctor: Ctor): ConnectionAdapter | null => {
  const ctx = connectionContext.getStore();
  const reg = findRegistry(ctor);
  if (ctx?.database) {
    const adapter = lookupChain(ctor, (r) => r.databases.get(ctx.database!));
    if (adapter) return adapter;
  }
  if (ctx?.role) {
    const adapter = lookupChain(ctor, (r) => r.roles.get(ctx.role!));
    if (adapter) return adapter;
  }
  const writing = lookupChain(ctor, (r) => r.roles.get('writing'));
  if (writing) return writing;
  if (reg?.default) return reg.default;
  // Walk the chain for inherited default.
  return lookupChain(ctor, (r) => r.default);
};

const lookupChain = (ctor: Ctor, pick: (r: RoleRegistry) => ConnectionAdapter | undefined): ConnectionAdapter | null => {
  let target: Ctor | null = ctor;
  while (target && target !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(target, REGISTRY)) {
      const adapter = pick(target[REGISTRY] as RoleRegistry);
      if (adapter) return adapter;
    }
    target = Object.getPrototypeOf(target);
  }
  return null;
};

/** Reset every connection slot on this class (used in tests / teardown). */
export const clearConnection = (ctor: Ctor): void => {
  if (Object.prototype.hasOwnProperty.call(ctor, REGISTRY)) {
    delete (ctor as Record<symbol, unknown>)[REGISTRY];
  }
};

/** Read this class's registry for inspection. */
export const getRegistry = (ctor: Ctor): RoleRegistry | null => findRegistry(ctor);
