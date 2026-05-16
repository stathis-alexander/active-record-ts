import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('binaryTest', () => {
  describe('hash', () => {
    it('generates a hash based on its value', () => {
      const eq = new Arel.Nodes.Equality('foo', 'bar');
      const eq2 = new Arel.Nodes.Equality('foo', 'bar');
      const eq3 = new Arel.Nodes.Equality('bar', 'baz');

      expect(eq.hash()).toBe(eq2.hash());
      expect(eq.hash()).not.toBe(eq3.hash());
    });

    it('generates a hash specific to its class', () => {
      const eq = new Arel.Nodes.Equality('foo', 'bar');
      const neq = new Arel.Nodes.Inequality('foo', 'bar');

      expect(eq.hash()).not.toBe(neq.hash());
    });
  });
});
