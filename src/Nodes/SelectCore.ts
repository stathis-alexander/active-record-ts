import { hash } from '../utilities/hash';
import { Nodes } from '.';
import type { LeftType } from './Binary';
import { Node } from './Node';

type RelationType = any;
type SourceType = any | null;
type ProjectionsType = any[];
type WheresType = any[];
type GroupsType = any[];
type HavingsType = any[];
type WindowsType = any[];
type CommentType = any | null;
type SetQuantifierType = any | null;
type OptimizerHintsType = any | null;

export class SelectCoreNode extends Node {
  public source: SourceType;

  public projections: ProjectionsType;
  public wheres: WheresType;
  public groups: GroupsType;
  public havings: HavingsType;
  public windows: WindowsType;

  public comment: CommentType;
  public setQuantifier: SetQuantifierType;
  public optimizerHints: OptimizerHintsType;

  constructor(relation?: RelationType) {
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

  get from() {
    return this.source.left;
  }

  set from(value: LeftType) {
    this.source.left = value;
  }

  get froms() {
    return this.from;
  }

  set froms(value: LeftType) {
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
