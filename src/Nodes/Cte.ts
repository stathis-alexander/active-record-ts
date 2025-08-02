import { Table } from '../Table';
import { hash } from '../utilities/hash';
import { BinaryNode, type LeftType, type RightType } from './Binary';

type CteNodeOptions = { materialized?: boolean };

export class CteNode extends BinaryNode {
  public name: LeftType;
  public relation: RightType;
  public materialized?: boolean;

  constructor(name: LeftType, relation: RightType, options?: CteNodeOptions) {
    super(name, relation);
    this.name = name;
    this.relation = relation;
    this.materialized = options?.materialized;
  }

  toCte = () => this;
  toTable = () => new Table(this.name);
  override hash = () => hash([this.name, this.relation, this.materialized]);
}
