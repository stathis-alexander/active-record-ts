import { describe, expect, test } from 'bun:test';
import { Model } from '../src';

class Person extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare age: number;
}
Person.attribute('id', 'integer');
Person.attribute('name', 'string');
Person.attribute('email', 'string');
Person.attribute('age', 'integer', { default: 0 });

class Customer extends Person {
  declare premium: boolean;
}
Customer.attribute('premium', 'boolean', { default: false });

describe('Model — attribute storage', () => {
  test('attributes cast on assignment', () => {
    const p = new Person({ id: '1', age: '30' });
    expect(p.id).toBe(1);
    expect(p.age).toBe(30);
  });
  test('subclasses inherit and extend attributes', () => {
    const c = new Customer({ name: 'Alex' });
    expect(c.name).toBe('Alex');
    expect(c.premium).toBe(false);
    expect(c.age).toBe(0);
  });
  test('assignAttributes batch-updates', () => {
    const p = new Person();
    p.assignAttributes({ name: 'A', age: '15' });
    expect(p.name).toBe('A');
    expect(p.age).toBe(15);
  });
  test('toJSON returns attribute snapshot', () => {
    const p = new Person({ id: 1, name: 'A', email: 'a@b.c', age: 20 });
    expect(p.toJSON()).toEqual({ id: 1, name: 'A', email: 'a@b.c', age: 20 });
  });
});

describe('Model — validations', () => {
  class ValidatedPerson extends Person {}
  ValidatedPerson.validates('name', { presence: true, length: { minimum: 2 } });
  ValidatedPerson.validates('email', { format: { with: /@/ } });
  ValidatedPerson.validates('age', { numericality: { greaterThanOrEqualTo: 0 } });

  test('presence + length', async () => {
    const p = new ValidatedPerson({ name: '', email: 'a@b.c' });
    expect(await p.validate()).toBe(false);
    expect(p.errors.on('name')).toContain("can't be blank");
  });
  test('format violation', async () => {
    const p = new ValidatedPerson({ name: 'Alex', email: 'invalid' });
    expect(await p.validate()).toBe(false);
    expect(p.errors.on('email')).toContain('is invalid');
  });
  test('numericality passes for zero default', async () => {
    const p = new ValidatedPerson({ name: 'Alex', email: 'a@b.c' });
    expect(await p.validate()).toBe(true);
  });
});

describe('Model — callbacks', () => {
  class Audited extends Model {
    declare id: number;
    declare name: string;
    public log: string[] = [];
  }
  Audited.attribute('id', 'integer');
  Audited.attribute('name', 'string');
  Audited.beforeValidation((r: Audited) => {
    r.log.push('before-validation');
  });
  Audited.afterValidation((r: Audited) => {
    r.log.push('after-validation');
  });

  test('runs in order around validate()', async () => {
    const a = new Audited();
    await a.validate();
    expect(a.log).toEqual(['before-validation', 'after-validation']);
  });

  test('before-callback returning false halts the chain', async () => {
    class Halts extends Model {
      declare id: number;
      public ran = false;
    }
    Halts.attribute('id', 'integer');
    Halts.beforeValidation(() => false);
    Halts.afterValidation((r: Halts) => {
      r.ran = true;
    });
    const h = new Halts();
    await h.validate();
    expect(h.ran).toBe(false);
  });
});

describe('Model — dirty tracking', () => {
  test('changes tracked through accessors', () => {
    const p = new Person({ name: 'Alex', age: 30 });
    p.name = 'Sandy';
    expect(p.changed()).toEqual(['name']);
    expect(p.changes()).toEqual({ name: ['Alex', 'Sandy'] });
  });
  test('restoreAttributes reverts', () => {
    const p = new Person({ name: 'Alex' });
    p.name = 'Sandy';
    p.restoreAttributes();
    expect(p.name).toBe('Alex');
  });
});
