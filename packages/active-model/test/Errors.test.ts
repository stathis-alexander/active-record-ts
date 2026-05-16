import { describe, expect, test } from 'bun:test';
import { Errors, BASE } from '../src';

describe('Errors', () => {
  test('records and groups messages by attribute', () => {
    const e = new Errors();
    e.add('name', "can't be blank");
    e.add('email', 'is invalid');
    e.add('name', 'is too short');
    expect(e.any).toBe(true);
    expect(e.empty).toBe(false);
    expect(e.on('name')).toEqual(["can't be blank", 'is too short']);
    expect(e.messages).toEqual({ name: ["can't be blank", 'is too short'], email: ['is invalid'] });
  });
  test('fullMessages prefixes the humanized attribute', () => {
    const e = new Errors();
    e.add('first_name', "can't be blank");
    expect(e.fullMessages).toContain("First name can't be blank");
  });
  test('base errors are not prefixed', () => {
    const e = new Errors();
    e.add(BASE, 'something went wrong');
    expect(e.fullMessages).toEqual(['something went wrong']);
  });
  test('clear empties the collection', () => {
    const e = new Errors();
    e.add('name', 'bad');
    e.clear();
    expect(e.empty).toBe(true);
  });
  test('delete removes a single attribute', () => {
    const e = new Errors();
    e.add('name', 'bad');
    e.add('email', 'bad');
    e.delete('name');
    expect(e.includes('name')).toBe(false);
    expect(e.includes('email')).toBe(true);
  });
});
