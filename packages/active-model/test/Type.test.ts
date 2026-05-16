import { describe, expect, test } from 'bun:test';
import {
  BooleanType,
  DateTimeType,
  DateType,
  FloatType,
  IntegerType,
  JSONType,
  StringType,
  lookupType,
  registerType,
  valuesEqual,
} from '../src';

describe('StringType', () => {
  const t = new StringType();
  test('coerces primitives to strings', () => {
    expect(t.cast(1)).toBe('1');
    expect(t.cast(true)).toBe('true');
    expect(t.cast(null)).toBe(null);
    expect(t.cast(undefined)).toBe(null);
  });
});

describe('IntegerType', () => {
  const t = new IntegerType();
  test('parses numeric strings', () => {
    expect(t.cast('42')).toBe(42);
    expect(t.cast('42.9')).toBe(42);
    expect(t.cast('not a number')).toBe(null);
    expect(t.cast('')).toBe(null);
  });
  test('truncates floats', () => {
    expect(t.cast(3.9)).toBe(3);
    expect(t.cast(-3.9)).toBe(-3);
  });
  test('booleans coerce to 0/1', () => {
    expect(t.cast(true)).toBe(1);
    expect(t.cast(false)).toBe(0);
  });
});

describe('FloatType', () => {
  const t = new FloatType();
  test('preserves decimals', () => {
    expect(t.cast('3.14')).toBe(3.14);
    expect(t.cast(3.14)).toBe(3.14);
  });
});

describe('BooleanType', () => {
  const t = new BooleanType();
  test('recognizes Rails-style truthy/falsy strings', () => {
    expect(t.cast('t')).toBe(true);
    expect(t.cast('f')).toBe(false);
    expect(t.cast('1')).toBe(true);
    expect(t.cast('0')).toBe(false);
    expect(t.cast(null)).toBe(null);
    expect(t.cast('')).toBe(null);
  });
});

describe('DateType', () => {
  const t = new DateType();
  test('parses ISO date strings', () => {
    const d = t.cast('2026-05-16');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2026-05-16T00:00:00.000Z');
  });
  test('serialize returns yyyy-mm-dd', () => {
    expect(t.serialize(new Date(Date.UTC(2026, 4, 16)))).toBe('2026-05-16');
  });
  test('equals compares times', () => {
    const a = t.cast('2026-05-16');
    const b = t.cast('2026-05-16');
    expect(valuesEqual(t, a, b)).toBe(true);
  });
});

describe('DateTimeType', () => {
  const t = new DateTimeType();
  test('roundtrips ISO timestamps', () => {
    const original = '2026-05-16T12:34:56.000Z';
    const parsed = t.cast(original);
    expect(parsed).toBeInstanceOf(Date);
    expect(t.serialize(parsed)).toBe(original);
  });
});

describe('JSONType', () => {
  const t = new JSONType<{ a: number }>();
  test('parses JSON strings, passes objects through', () => {
    expect(t.cast('{"a":1}')).toEqual({ a: 1 });
    expect(t.cast({ a: 2 })).toEqual({ a: 2 });
  });
  test('serializes objects', () => {
    expect(t.serialize({ a: 3 })).toBe('{"a":3}');
  });
});

describe('registry', () => {
  test('built-ins are looked up by name', () => {
    expect(lookupType('string')).toBeInstanceOf(StringType);
    expect(lookupType('integer')).toBeInstanceOf(IntegerType);
    expect(lookupType('datetime')).toBeInstanceOf(DateTimeType);
  });
  test('unknown name throws', () => {
    expect(() => lookupType('does-not-exist')).toThrow();
  });
  test('factory registration', () => {
    class CustomType extends StringType {}
    registerType('custom', () => new CustomType());
    expect(lookupType('custom')).toBeInstanceOf(CustomType);
  });
});
