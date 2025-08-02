import { hash } from '../utilities/hash';
import { Node } from './Node';

type RelationType = any;
type WhereType = any[];
type ValuesType = any[];
type GroupType = any[];
type HavingType = any[];
type OrderType = any[];
type LimitType = any | null;
type OffsetType = any | null;
type CommentType = any | null;
type KeyType = any | null;

export class UpdateStatementNode extends Node {
  public relation: RelationType;
  public wheres: WhereType;
  public values: ValuesType;
  public groups: GroupType;
  public havings: HavingType;
  public orders: OrderType;
  public limit: LimitType;
  public offset: OffsetType;
  public comment: CommentType;
  public key: KeyType;

  constructor(relation?: RelationType) {
    super();
    this.relation = relation;
    this.wheres = [];
    this.values = [];
    this.groups = [];
    this.havings = [];
    this.orders = [];
    this.limit = null;
    this.offset = null;
    this.comment = null;
    this.key = null;
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
    ]);
}
