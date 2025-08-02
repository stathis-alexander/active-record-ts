import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Casted', () => {
  it('is equal when eql? returns true', () => {
    const one = new Arel.Nodes.Casted(1, 2);
    const alsoOne = new Arel.Nodes.Casted(1, 2);

    expect(one.hash()).toBe(alsoOne.hash());
  });
});
