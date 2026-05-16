import type { Expression, RelationLike } from '../types';
import { hash } from '../utilities/hash';
import { Node } from './Node';
import type { SelectStatementNode } from './SelectStatement';
import type { SqlLiteralNode } from './SqlLiteral';
import type { ValuesListNode } from './ValuesList';

export class InsertStatementNode extends Node {
  public relation: RelationLike | null;
  public columns: Expression[];
  public values: ValuesListNode | SqlLiteralNode | null;
  public select: SelectStatementNode | unknown | null;
  public returning: Expression[];

  constructor(relation?: RelationLike | null) {
    super();

    this.relation = relation ?? null;
    this.columns = [];
    this.values = null;
    this.select = null;
    this.returning = [];
  }

  override hash = () => hash([this.relation, this.columns, this.values, this.select, this.returning]);
}
