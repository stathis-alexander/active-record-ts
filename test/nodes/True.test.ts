import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('True', () => {
  describe('equality', () => {
    it('is equal to other true nodes', () => {
      const true1 = new Arel.Nodes.True();
      const true2 = new Arel.Nodes.True();

      expect(true1.isEqual(true2)).toBe(true);
    });

    it('is not equal with other nodes', () => {
      const trueNode = new Arel.Nodes.True();
      const node = new Arel.Nodes.Node();

      expect(trueNode.isEqual(node)).toBe(false);
    });
  });
});
