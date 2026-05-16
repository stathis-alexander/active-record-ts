import { Table } from '../Table';
import type { CteOptions, RelationLike } from '../types';
import { hash } from '../utilities/hash';
import { BinaryNode } from './Binary';

export class CteNode extends BinaryNode {
  public name: string;
  public relation: RelationLike;
  public materialized?: boolean;

  constructor(name: string, relation: RelationLike, options?: CteOptions) {
    super(name, relation);
    this.name = name;
    this.relation = relation;
    this.materialized = options?.materialized;
  }

  toCte = () => this;
  toTable = () => new Table(this.name);
  override hash = () => hash([this.name, this.relation, this.materialized]);
}
