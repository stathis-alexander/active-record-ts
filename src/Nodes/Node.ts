import { Collectors } from '../Collectors';
import { FactoryMethods } from '../FactoryMethods';
import { hash } from '../utilities/hash';
import { Visitors } from '../Visitors';
import { Nodes } from '.';
import type { RightType } from './Binary';

type EngineType = any;
type FetchAttributeValueType = any;
export type FetchAttributeCallbackType = (value: FetchAttributeValueType) => boolean;

export class Node extends FactoryMethods {
  public readonly __object_id: number;

  constructor() {
    super();
    this.__object_id = Math.random();
  }

  and = (right: RightType) => new Nodes.And([this, right]);
  equality = () => false;
  isEqual = (other: Node) => {
    if (!(other instanceof Node)) return false;

    return this.hash() === other.hash();
  };
  fetchAttribute: (callback: FetchAttributeCallbackType) => any = () => null;
  hash() {
    return hash(this.constructor.name);
  }
  invert = (): Node => new Nodes.Not(this);
  isNull = () => false;
  not = () => new Nodes.Not(this);
  or = (right: RightType) => new Nodes.Grouping(new Nodes.Or([this, right]));
  toSql = (_engine?: EngineType) => {
    // engine.with_connection do |connection|
    //   connection.visitor.accept(self, collector).value
    // end
    return new Visitors.ToSql().accept(this, new Collectors.SqlString()).value();
  };
}
