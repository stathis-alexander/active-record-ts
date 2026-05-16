/**
 * Type system for ActiveModel attributes.
 *
 * Each Type owns three coercion functions:
 *  - `cast` converts a value coming from user code (`record.name = 1`)
 *    into the canonical attribute value (e.g. `"1"` for a string column).
 *  - `serialize` converts an attribute value into a driver-compatible
 *    value for INSERT/UPDATE statements.
 *  - `deserialize` converts a value coming back from the driver into an
 *    attribute value.
 *
 * The named type registry mirrors Rails' `ActiveModel::Type` registry.
 * Adapters can register adapter-specific types (e.g. PostgreSQL's `uuid`
 * or `jsonb`) by calling `Type.register(name, factory)`.
 */

/** Base interface every type implementation satisfies. */
export interface Type<T = unknown> {
  /** Name of the type as registered (e.g. `'string'`, `'integer'`). */
  readonly type: string;
  cast(value: unknown): T | null;
  serialize(value: T | null): unknown;
  deserialize(value: unknown): T | null;
  /** Returns true when the two values represent the same logical attribute value. */
  equals?(a: T | null, b: T | null): boolean;
}

/** Helper to bail out of casting NULL-ish values uniformly. */
const isNullish = (value: unknown): boolean => value === null || value === undefined;

export class StringType implements Type<string> {
  readonly type = 'string';
  cast(value: unknown): string | null {
    if (isNullish(value)) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  serialize(value: string | null) {
    return value;
  }
  deserialize(value: unknown): string | null {
    return this.cast(value);
  }
}

export class IntegerType implements Type<number> {
  readonly type = 'integer';
  cast(value: unknown): number | null {
    if (isNullish(value) || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }
  serialize(value: number | null) {
    return value;
  }
  deserialize(value: unknown): number | null {
    return this.cast(value);
  }
}

export class BigIntType implements Type<bigint> {
  readonly type = 'bigint';
  cast(value: unknown): bigint | null {
    if (isNullish(value) || value === '') return null;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : null;
    if (typeof value === 'string') {
      try {
        return BigInt(value);
      } catch {
        return null;
      }
    }
    return null;
  }
  serialize(value: bigint | null) {
    return value;
  }
  deserialize(value: unknown): bigint | null {
    return this.cast(value);
  }
}

export class FloatType implements Type<number> {
  readonly type = 'float';
  cast(value: unknown): number | null {
    if (isNullish(value) || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return null;
  }
  serialize(value: number | null) {
    return value;
  }
  deserialize(value: unknown): number | null {
    return this.cast(value);
  }
}

/**
 * Stored as a string to preserve precision. Drivers commonly return decimals
 * as strings; we keep them that way for callers to feed into a decimal lib
 * of choice (we don't ship one).
 */
export class DecimalType implements Type<string> {
  readonly type = 'decimal';
  cast(value: unknown): string | null {
    if (isNullish(value) || value === '') return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    return String(value);
  }
  serialize(value: string | null) {
    return value;
  }
  deserialize(value: unknown): string | null {
    return this.cast(value);
  }
}

const TRUTHY = new Set(['1', 't', 'T', 'true', 'TRUE', 'on', 'ON', 1, true]);
const FALSY = new Set(['0', 'f', 'F', 'false', 'FALSE', 'off', 'OFF', 0, false]);

export class BooleanType implements Type<boolean> {
  readonly type = 'boolean';
  cast(value: unknown): boolean | null {
    if (isNullish(value) || value === '') return null;
    if (TRUTHY.has(value as never)) return true;
    if (FALSY.has(value as never)) return false;
    return Boolean(value);
  }
  serialize(value: boolean | null) {
    return value;
  }
  deserialize(value: unknown): boolean | null {
    return this.cast(value);
  }
}

const dateOnly = (date: Date): Date => {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export class DateType implements Type<Date> {
  readonly type = 'date';
  cast(value: unknown): Date | null {
    if (isNullish(value) || value === '') return null;
    if (value instanceof Date) return dateOnly(value);
    if (typeof value === 'string') {
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
      return Number.isNaN(d.getTime()) ? null : dateOnly(d);
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : dateOnly(d);
    }
    return null;
  }
  serialize(value: Date | null): string | null {
    if (value == null) return null;
    return value.toISOString().slice(0, 10);
  }
  deserialize(value: unknown): Date | null {
    return this.cast(value);
  }
  equals(a: Date | null, b: Date | null): boolean {
    if (a == null || b == null) return a === b;
    return a.getTime() === b.getTime();
  }
}

export class DateTimeType implements Type<Date> {
  readonly type = 'datetime';
  cast(value: unknown): Date | null {
    if (isNullish(value) || value === '') return null;
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  serialize(value: Date | null): string | null {
    if (value == null) return null;
    return value.toISOString();
  }
  deserialize(value: unknown): Date | null {
    return this.cast(value);
  }
  equals(a: Date | null, b: Date | null): boolean {
    if (a == null || b == null) return a === b;
    return a.getTime() === b.getTime();
  }
}

export class JSONType<T = unknown> implements Type<T> {
  readonly type = 'json';
  cast(value: unknown): T | null {
    if (isNullish(value)) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    return value as T;
  }
  serialize(value: T | null): string | null {
    if (value == null) return null;
    return JSON.stringify(value);
  }
  deserialize(value: unknown): T | null {
    return this.cast(value);
  }
}

export class BinaryType implements Type<Uint8Array> {
  readonly type = 'binary';
  cast(value: unknown): Uint8Array | null {
    if (isNullish(value)) return null;
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string') return new TextEncoder().encode(value);
    if (Array.isArray(value)) return new Uint8Array(value as number[]);
    return null;
  }
  serialize(value: Uint8Array | null) {
    return value;
  }
  deserialize(value: unknown): Uint8Array | null {
    return this.cast(value);
  }
  equals(a: Uint8Array | null, b: Uint8Array | null): boolean {
    if (a == null || b == null) return a === b;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
}

/**
 * Pass-through type for unmapped or adapter-specific values. Used as the
 * default when schema reflection finds a column type we don't know about.
 */
export class ValueType implements Type<unknown> {
  readonly type = 'value';
  cast(value: unknown) {
    return isNullish(value) ? null : value;
  }
  serialize(value: unknown) {
    return value;
  }
  deserialize(value: unknown) {
    return isNullish(value) ? null : value;
  }
}

/** Compare two values via the type's `equals` hook if present, else `===`. */
export const valuesEqual = <T>(type: Type<T>, a: T | null, b: T | null): boolean =>
  type.equals ? type.equals(a, b) : a === b;

type Factory = () => Type;

const REGISTRY = new Map<string, Factory>();

/** Register a named type (factory invoked per `Type.lookup`). */
export const registerType = (name: string, factory: Factory): void => {
  REGISTRY.set(name, factory);
};

/** Resolve a named type. Throws if unregistered. */
export const lookupType = (name: string): Type => {
  const factory = REGISTRY.get(name);
  if (!factory) throw new Error(`Unknown attribute type: ${name}`);
  return factory();
};

/** True when the named type has been registered. */
export const hasType = (name: string): boolean => REGISTRY.has(name);

registerType('string', () => new StringType());
registerType('text', () => new StringType());
registerType('integer', () => new IntegerType());
registerType('int', () => new IntegerType());
registerType('bigint', () => new BigIntType());
registerType('float', () => new FloatType());
registerType('double', () => new FloatType());
registerType('decimal', () => new DecimalType());
registerType('numeric', () => new DecimalType());
registerType('boolean', () => new BooleanType());
registerType('bool', () => new BooleanType());
registerType('date', () => new DateType());
registerType('datetime', () => new DateTimeType());
registerType('timestamp', () => new DateTimeType());
registerType('time', () => new DateTimeType());
registerType('json', () => new JSONType());
registerType('jsonb', () => new JSONType());
registerType('binary', () => new BinaryType());
registerType('blob', () => new BinaryType());
registerType('bytea', () => new BinaryType());
registerType('value', () => new ValueType());
