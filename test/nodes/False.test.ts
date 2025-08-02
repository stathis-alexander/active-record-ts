import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('False', () => {
  describe('equality', () => {
    it('is equal to other false nodes', () => {
      const false1 = new Arel.Nodes.False();
      const false2 = new Arel.Nodes.False();

      expect(false1.isEqual(false2)).toBe(true);
    });

    it('is not equal with other nodes', () => {
      const falseNode = new Arel.Nodes.False();
      const node = new Arel.Nodes.Node();

      expect(falseNode.isEqual(node)).toBe(false);
    });
  });
});
