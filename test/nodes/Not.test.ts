import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Not', () => {
  describe('not', () => {
    it('makes a NOT node', () => {
      const table = new Arel.Table('users');
      const attr = table.attribute('id');
      const expr = attr.equal(10);
      const node = expr.not();

      expect(node).toBeInstanceOf(Arel.Nodes.Not);
      expect(node.expression).toBe(expr);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const not1 = new Arel.Nodes.Not('foo');
      const not2 = new Arel.Nodes.Not('foo');

      expect(not1.isEqual(not2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const not1 = new Arel.Nodes.Not('foo');
      const not2 = new Arel.Nodes.Not('baz');

      expect(not1.isEqual(not2)).toBe(false);
    });
  });
});
