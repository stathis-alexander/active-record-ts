import { hash } from '../utilities/hash';
import { Node } from './Node';

type RelationType = any;
type ColumnsType = any[];
type ValuesType = any | null;
type SelectType = any | null;

export class InsertStatementNode extends Node {
  public relation: RelationType;
  public columns: ColumnsType;
  public values: ValuesType;
  public select: SelectType;

  constructor(relation?: RelationType) {
    super();

    this.relation = relation;
    this.columns = [];
    this.values = null;
    this.select = null;
  }

  override hash = () => hash([this.relation, this.columns, this.values, this.select]);
}
