import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Distinct', () => {
  describe('equality', () => {
    it('is equal to other distinct nodes', () => {
      const distinct1 = new Arel.Nodes.Distinct();
      const distinct2 = new Arel.Nodes.Distinct();

      expect(distinct1.isEqual(distinct2)).toBe(true);
    });

    it('is not equal with other nodes', () => {
      const distinctNode = new Arel.Nodes.Distinct();
      const node = new Arel.Nodes.Node();

      expect(distinctNode.isEqual(node)).toBe(false);
    });
  });
});
