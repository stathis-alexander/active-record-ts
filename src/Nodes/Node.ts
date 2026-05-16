import { Collectors } from '../Collectors';
import { FactoryMethods } from '../FactoryMethods';
import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { Visitors } from '../Visitors';
import { Nodes } from '.';
import type { RightType } from './Binary';

/**
 * Callback shape consumed by `fetchAttribute`. Receives the discovered
 * attribute-like value and returns whether the caller is interested in it.
 */
export type FetchAttributeCallbackType = (value: Expression) => boolean;

/** Public alias used by call sites that don't want the `Type` suffix. */
export type FetchAttributeCallback = FetchAttributeCallbackType;

/** Adapter-supplied engine (typically a connection or pool). */
type EngineType = unknown;

export class Node extends FactoryMethods {
  and = (right: RightType) => new Nodes.And([this, right]);
  equality = () => false;
  isEqual = (other: Node) => {
    if (!(other instanceof Node)) return false;

    return this.hash() === other.hash();
  };
  fetchAttribute: (callback: FetchAttributeCallbackType) => unknown = () => null;
  hash() {
    return hash(this.constructor.name);
  }
  invert = (): Node => new Nodes.Not(this);
  isNull = () => false;
  not = () => new Nodes.Not(this);
  or = (right: RightType) => new Nodes.Grouping(new Nodes.Or([this, right]));
  toSql = (_engine?: EngineType) => {
    return new Visitors.ToSql().accept(this, new Collectors.SqlString()).value();
  };
}
