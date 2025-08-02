import { hash } from '../utilities/hash';
import { Node } from './Node';

type RelationType = any;
type WheresType = any[];
type GroupsType = any[];
type HavingsType = any[];
type OrdersType = any[];
type LimitType = any | null;
type OffsetType = any | null;
type CommentType = any | null;
type KeyType = any | null;

export class DeleteStatementNode extends Node {
  public relation: RelationType;
  public wheres: WheresType;
  public groups: GroupsType;
  public havings: HavingsType;
  public orders: OrdersType;
  public limit: LimitType;
  public offset: OffsetType;
  public comment: CommentType;
  public key: KeyType;

  constructor(relation: RelationType = null, wheres: WheresType = []) {
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
    ]);
  }
}
