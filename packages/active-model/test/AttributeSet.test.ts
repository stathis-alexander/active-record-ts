import { describe, expect, test } from 'bun:test';
import { Attributes, AttributeSet, IntegerType, StringType, DateTimeType } from '../src';

const personSet = (): AttributeSet => {
  const set = new AttributeSet();
  set.define({ name: 'id', type: new IntegerType() });
  set.define({ name: 'name', type: new StringType() });
  set.define({ name: 'age', type: new IntegerType(), default: 0 });
  set.define({ name: 'createdAt', type: new DateTimeType() });
  return set;
};

describe('AttributeSet', () => {
  test('keys preserves declaration order', () => {
    const set = personSet();
    expect(set.keys()).toEqual(['id', 'name', 'age', 'createdAt']);
  });
  test('clone is independent', () => {
    const a = personSet();
    const b = a.clone();
    b.define({ name: 'extra', type: new StringType() });
    expect(a.has('extra')).toBe(false);
    expect(b.has('extra')).toBe(true);
  });
});

describe('Attributes dirty tracking', () => {
  test('hydrate produces no changes', () => {
    const a = new Attributes(personSet());
    a.hydrate({ id: '1', name: 'Alex', age: '30', createdAt: '2026-01-01T00:00:00.000Z' });
    expect(a.changedAttributes()).toEqual([]);
  });
  test('write marks attribute changed', () => {
    const a = new Attributes(personSet());
    a.hydrate({ id: '1', name: 'Alex', age: '30', createdAt: null });
    a.write('name', 'Sandy');
    expect(a.changed('name')).toBe(true);
    expect(a.changedAttributes()).toEqual(['name']);
    expect(a.changes()).toEqual({ name: ['Alex', 'Sandy'] });
    expect(a.was('name')).toBe('Alex');
  });
  test('commit captures previous changes and clears pending', () => {
    const a = new Attributes(personSet());
    a.hydrate({ id: '1', name: 'Alex', age: '30', createdAt: null });
    a.write('name', 'Sandy');
    a.commit();
    expect(a.changedAttributes()).toEqual([]);
    expect(a.savedChanges()).toEqual({ name: ['Alex', 'Sandy'] });
  });
  test('restore reverts pending changes', () => {
    const a = new Attributes(personSet());
    a.hydrate({ id: '1', name: 'Alex', age: '30', createdAt: null });
    a.write('name', 'Sandy');
    a.restore();
    expect(a.read('name')).toBe('Alex');
    expect(a.changedAttributes()).toEqual([]);
  });
  test('defaults applied for new records', () => {
    const a = new Attributes(personSet());
    a.hydrateDefaults({ name: 'Bo' });
    expect(a.read('age')).toBe(0);
    expect(a.read('name')).toBe('Bo');
  });
  test('value-equals comparison via Type hook (Date)', () => {
    const a = new Attributes(personSet());
    a.hydrate({ id: 1, name: 'x', age: 0, createdAt: '2026-01-01T00:00:00.000Z' });
    a.write('createdAt', '2026-01-01T00:00:00.000Z');
    expect(a.changed('createdAt')).toBe(false);
  });
  test('dirtyHash returns only changed', () => {
    const a = new Attributes(personSet());
    a.hydrate({ id: 1, name: 'Alex', age: 30, createdAt: null });
    a.write('age', 31);
    expect(a.dirtyHash()).toEqual({ age: 31 });
  });
});
