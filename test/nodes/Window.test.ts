import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Window', () => {
  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const window1 = new Arel.Nodes.Window();
      window1.orders = [1, 2];
      window1.partitions = [1];
      window1.frame(3);

      const window2 = new Arel.Nodes.Window();
      window2.orders = [1, 2];
      window2.partitions = [1];
      window2.frame(3);

      expect(window1.isEqual(window2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const window1 = new Arel.Nodes.Window();
      window1.orders = [1, 2];
      window1.partitions = [1];
      window1.frame(3);

      const window2 = new Arel.Nodes.Window();
      window2.orders = [1, 2];
      window2.partitions = [1];
      window2.frame(4);

      expect(window1.isEqual(window2)).toBe(false);
    });
  });
});

describe('NamedWindow', () => {
  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const window1 = new Arel.Nodes.NamedWindow('foo');
      window1.orders = [1, 2];
      window1.partitions = [1];
      window1.frame(3);

      const window2 = new Arel.Nodes.NamedWindow('foo');
      window2.orders = [1, 2];
      window2.partitions = [1];
      window2.frame(3);

      expect(window1.isEqual(window2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const window1 = new Arel.Nodes.NamedWindow('foo');
      window1.orders = [1, 2];
      window1.partitions = [1];
      window1.frame(3);

      const window2 = new Arel.Nodes.NamedWindow('bar');
      window2.orders = [1, 2];
      window2.partitions = [1];
      window2.frame(3);

      expect(window1.isEqual(window2)).toBe(false);
    });
  });
});

describe('CurrentRow', () => {
  describe('equality', () => {
    it('is equal to other current row nodes', () => {
      const currentRow1 = new Arel.Nodes.CurrentRow();
      const currentRow2 = new Arel.Nodes.CurrentRow();

      expect(currentRow1.isEqual(currentRow2)).toBe(true);
    });

    it('is not equal with other nodes', () => {
      const currentRow = new Arel.Nodes.CurrentRow();
      const node = new Arel.Nodes.Node();

      expect(currentRow.isEqual(node)).toBe(false);
    });
  });
});
