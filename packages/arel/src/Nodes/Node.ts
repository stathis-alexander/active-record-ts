import { Collectors } from '../Collectors';
import { FactoryMethods } from '../FactoryMethods';
import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { Visitors } from '../Visitors';
import { Nodes } from '.';

/**
 * Callback shape consumed by `fetchAttribute`. Receives the discovered
 * attribute-like value and returns whether the caller is interested in it.
 */
export type FetchAttributeCallback = (value: Expression) => boolean;

export class Node extends FactoryMethods {
  and = (right: Expression) => new Nodes.And([this, right]);
  equality = () => false;
  isEqual = (other: Node) => {
    if (!(other instanceof Node)) return false;

    return this.hash() === other.hash();
  };
  fetchAttribute: (callback: FetchAttributeCallback) => unknown = () => null;
  hash() {
    return hash(this.constructor.name);
  }
  invert = (): Node => new Nodes.Not(this);
  isNull = () => false;
  not = () => new Nodes.Not(this);
  or = (right: Expression) => new Nodes.Grouping(new Nodes.Or([this, right]));
  toSql = (_engine?: unknown) => {
    return new Visitors.ToSql().accept(this, new Collectors.SqlString()).value();
  };
}
