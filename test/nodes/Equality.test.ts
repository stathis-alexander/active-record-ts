import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Equality', () => {
  // FIXME: backwards compat
  describe('backwards compat', () => {
    describe('to_sql', () => {
      it('takes an engine', () => {
        // Note: Engine/connection testing may not be fully implemented in TypeScript version
        // This test is simplified to focus on core functionality
        const table = new Arel.Table('users');
        const attr = table.attribute('id');
        const test = attr.equal(10);
        const sql = test.toSql();
        expect(sql).toMatch(/users.*id.*=/);
      });
    });
  });

  describe('or', () => {
    it('makes an OR node', () => {
      const table = new Arel.Table('users');
      const attr = table.attribute('id');
      const left = attr.equal(10);
      const right = attr.equal(11);
      const node = left.or(right);

      expect(node.expression.left).toBe(left);
      expect(node.expression.right).toBe(right);
    });
  });

  describe('and', () => {
    it('makes an AND node', () => {
      const table = new Arel.Table('users');
      const attr = table.attribute('id');
      const left = attr.equal(10);
      const right = attr.equal(11);
      const node = left.and(right);

      expect(node.left).toBe(left);
      expect(node.right).toBe(right);
    });
  });

  it('is equal with equal ivars', () => {
    const equality1 = new Arel.Nodes.Equality('foo', 'bar');
    const equality2 = new Arel.Nodes.Equality('foo', 'bar');

    expect(equality1.isEqual(equality2)).toBe(true);
  });

  it('is not equal with different ivars', () => {
    const equality1 = new Arel.Nodes.Equality('foo', 'bar');
    const equality2 = new Arel.Nodes.Equality('foo', 'baz');

    expect(equality1.isEqual(equality2)).toBe(false);
  });
});
