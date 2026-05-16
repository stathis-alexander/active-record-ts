import type { Expression, RelationLike } from '../types';
import { hash } from '../utilities/hash';
import type { CommentNode } from './Comment';
import { Node } from './Node';
import type { LimitNode, OffsetNode } from './Unary';

export class DeleteStatementNode extends Node {
  public relation: RelationLike | null;
  public wheres: Expression[];
  public groups: Expression[];
  public havings: Expression[];
  public orders: Expression[];
  public limit: LimitNode | null;
  public offset: OffsetNode | null;
  public comment: CommentNode | null;
  public key: Expression | null;
  public returning: Expression[];

  constructor(relation: RelationLike | null = null, wheres: Expression[] = []) {
    super();
    this.relation = relation;
    this.wheres = wheres;
    this.groups = [];
    this.havings = [];
    this.orders = [];
    this.limit = null;
    this.offset = null;
    this.comment = null;
    this.key = null;
    this.returning = [];
  }

  override hash() {
    return hash([
      this.relation,
      this.wheres,
      this.groups,
      this.havings,
      this.orders,
      this.limit,
      this.offset,
      this.comment,
      this.key,
      this.returning,
    ]);
  }
}
