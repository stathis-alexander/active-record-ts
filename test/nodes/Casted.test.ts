import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Casted', () => {
  it('is equal when eql? returns true', () => {
    const attr = new Arel.Table('users').attribute('id');
    const one = new Arel.Nodes.Casted(1, attr);
    const alsoOne = new Arel.Nodes.Casted(1, attr);

    expect(one.hash()).toBe(alsoOne.hash());
  });
});
