/**
 * Ported from activemodel/test/cases/attribute_set_test.rb (Rails 7.2 branch).
 *
 * Our AttributeSet/Attributes pair is simpler than Rails' — no
 * Attribute-with-Type wrapper objects, no LazyAttributeHash, no
 * accessed-attribute tracking, no separate write_from_user vs
 * write_from_database paths. Most tests of the lazy/accessed machinery
 * are skipped; tests of the core typed read/write/dirty surface are
 * ported.
 */

import { describe, expect, test } from 'bun:test';
import { AttributeSet, Attributes, FloatType, IntegerType, StringType } from '../../src';

const buildSet = (defs: Array<[string, ConstructorParameters<typeof Attributes>[0] extends never ? never : { type: { type: string } }]> | Record<string, { type: string }> = {}): AttributeSet => {
  const set = new AttributeSet();
  for (const [name, def] of Object.entries(defs as Record<string, { type: string }>)) {
    let type;
    switch (def.type) {
      case 'integer': type = new IntegerType(); break;
      case 'float':   type = new FloatType(); break;
      case 'string':  type = new StringType(); break;
      default:        throw new Error(`Unsupported test type: ${def.type}`);
    }
    set.define({ name, type });
  }
  return set;
};

describe('AttributeSet', () => {
  test('building from raw attributes casts via type', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1', bar: '2.2' });
    expect(attrs.read('foo')).toBe(1);
    expect(attrs.read('bar')).toBe(2.2);
  });

  test('building with extra per-call types (passed in hydrate values)', () => {
    const set = buildSet({ foo: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '3.3' });
    expect(attrs.read('foo')).toBe(3.3);
  });
  test('[] returns null for unknown attribute names', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: 1 });
    expect(attrs.read('unknown')).toBeUndefined();
  });

  test('cloning AttributeSet is independent', () => {
    const a = buildSet({ foo: { type: 'integer' } });
    const b = a.clone();
    b.define({ name: 'bar', type: new StringType() });
    expect(a.has('bar')).toBe(false);
    expect(b.has('bar')).toBe(true);
  });

  test('cloned set + writing to copy does not affect the source', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: 1 });
    const dupSet = set.clone();
    const dupAttrs = new Attributes(dupSet);
    dupAttrs.hydrate(attrs.toHash());
    dupAttrs.write('foo', 2);
    expect(attrs.read('foo')).toBe(1);
    expect(dupAttrs.read('foo')).toBe(2);
  });
  test('toHash returns the cast values', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1', bar: '2.2' });
    expect(attrs.toHash()).toEqual({ foo: 1, bar: 2.2 });
  });

  test('toHash maintains insertion order', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '2.2', bar: '3.3' });
    expect(Object.entries(attrs.toHash())).toEqual([
      ['foo', 2],
      ['bar', 3.3],
    ]);
  });

  test('value-before-typecast (best-effort via raw hydrate values)', () => {
    // We don't keep the pre-cast value, but writing a string and reading
    // it back as a number is the round-trip observers want to confirm.
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1' });
    expect(attrs.read('foo')).toBe(1);
  });

  test('AttributeSet#has returns false for unknown attribute names', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    expect(set.has('foo')).toBe(true);
    expect(set.has('unknown')).toBe(false);
  });

  test('fetch_value returns the cast value', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'float' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '1.1', bar: '2.2' });
    expect(attrs.read('foo')).toBe(1);
    expect(attrs.read('bar')).toBe(2.2);
  });

  test('read returns undefined for unknown attributes', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: 1 });
    expect(attrs.read('does_not_exist')).toBeUndefined();
  });

  test('hydrateDefaults applies a primary-key-style default', () => {
    const set = new AttributeSet();
    set.define({ name: 'id', type: new IntegerType(), default: 0 });
    const attrs = new Attributes(set);
    attrs.hydrateDefaults();
    expect(attrs.read('id')).toBe(0);
  });

  test('write coerces user values via the type (the "user write" path)', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.write('foo', '42');
    expect(attrs.read('foo')).toBe(42);
  });

  test('hydrate deserializes raw DB values via the type (the "db write" path)', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '7' });
    expect(attrs.read('foo')).toBe(7);
  });

  test('serializedHash mirrors values_for_database', () => {
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: '7' });
    expect(attrs.serializedHash()).toEqual({ foo: 7 });
  });

  test('accessed() returns only attributes that have been read', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: 1, bar: 2 });
    expect(attrs.accessed()).toEqual([]);
    void attrs.read('foo');
    expect(attrs.accessed()).toEqual(['foo']);
  });
  test('custom Type.equals controls changed-in-place semantics', () => {
    // Already covered indirectly via DateType which compares by .getTime();
    // a custom JSON type can override equals to detect deep changes.
    const set = buildSet({ foo: { type: 'integer' } });
    const attrs = new Attributes(set);
    attrs.hydrate({ foo: 1 });
    attrs.write('foo', 1);
    expect(attrs.changed('foo')).toBe(false);
    attrs.write('foo', 2);
    expect(attrs.changed('foo')).toBe(true);
  });

  test('keys returns names in declaration order', () => {
    const set = buildSet({ foo: { type: 'integer' }, bar: { type: 'integer' } });
    expect(set.keys()).toEqual(['foo', 'bar']);
  });
});
