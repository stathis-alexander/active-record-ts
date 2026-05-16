import type { Expression, RelationLike } from '../types';
import { hash } from '../utilities/hash';
import type { CommentNode } from './Comment';
import { Node } from './Node';
import type { LimitNode, OffsetNode } from './Unary';

export class UpdateStatementNode extends Node {
  public relation: RelationLike | null;
  public wheres: Expression[];
  public values: Expression[];
  public groups: Expression[];
  public havings: Expression[];
  public orders: Expression[];
  public limit: LimitNode | null;
  public offset: OffsetNode | null;
  public comment: CommentNode | null;
  public key: Expression | null;
  public returning: Expression[];

  constructor(relation?: RelationLike | null) {
    super();
    this.relation = relation ?? null;
    this.wheres = [];
    this.values = [];
    this.groups = [];
    this.havings = [];
    this.orders = [];
    this.limit = null;
    this.offset = null;
    this.comment = null;
    this.key = null;
    this.returning = [];
  }

  override hash = () =>
    hash([
      this.relation,
      this.wheres,
      this.values,
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
