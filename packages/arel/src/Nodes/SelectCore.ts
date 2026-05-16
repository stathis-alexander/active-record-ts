import type { Expression, RelationLike } from '../types';
import { hash } from '../utilities/hash';
import { Nodes } from '.';
import type { CommentNode } from './Comment';
import type { JoinSourceNode } from './JoinSource';
import { Node } from './Node';
import type { DistinctNode } from './Terminal';
import type { DistinctOnNode, OptimizerHintsNode } from './Unary';
import type { NamedWindowNode } from './Window';

export class SelectCoreNode extends Node {
  public source: JoinSourceNode;

  public projections: Expression[];
  public wheres: Expression[];
  public groups: Expression[];
  public havings: Expression[];
  public windows: NamedWindowNode[];

  public comment: CommentNode | null;
  public setQuantifier: DistinctNode | DistinctOnNode | null;
  public optimizerHints: OptimizerHintsNode | null;

  constructor(relation?: RelationLike) {
    super();

    this.source = new Nodes.JoinSource(relation);

    this.projections = [];
    this.wheres = [];
    this.groups = [];
    this.windows = [];
    this.havings = [];

    this.comment = null;
    this.setQuantifier = null;
    this.optimizerHints = null;
  }

  get from(): RelationLike | undefined | null {
    return this.source.left;
  }

  set from(value: RelationLike | undefined | null) {
    this.source.left = value;
  }

  get froms(): RelationLike | undefined | null {
    return this.from;
  }

  set froms(value: RelationLike | undefined | null) {
    this.from = value;
  }

  override hash = () =>
    hash([
      this.source,
      this.setQuantifier,
      this.projections,
      this.optimizerHints,
      this.wheres,
      this.groups,
      this.havings,
      this.windows,
      this.comment,
    ]);
}
