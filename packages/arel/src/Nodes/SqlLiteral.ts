import { AliasPredications } from '../AliasPredication';
import { Expressions } from '../Expressions';
import { OrderPredications } from '../OrderPredications';
import { Predications } from '../Predications';
import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { isArelNode } from '../utilities/isArelNode';
import { FragmentsNode } from './Fragments';

type SqlLiteralNodeOptions = {
  retryable?: boolean;
};

/**
 * Minimal YAML-style coder shape used by `encodeWith` (mirrors Rails Arel's
 * `Psych::Coder` integration). Adapters may pass a richer object; we only
 * touch the `scalar` field.
 */
type CoderType = { scalar?: string };

export class SqlLiteralNode extends OrderPredications(Predications(Expressions(AliasPredications(String)))) {
  public readonly retryable: boolean;

  constructor(value: string, options: SqlLiteralNodeOptions = { retryable: false }) {
    super(value);
    this.retryable = options.retryable ?? false;
  }

  add = (other: Expression) => {
    if (!isArelNode(other)) throw new Error('Expected arel node');

    return new FragmentsNode([this, other]);
  };
  encodeWith = (coder: CoderType) => {
    coder.scalar = this.toString();
  };
  fetchAttribute = () => null;
  hash = () => hash(this.toString());
  isEqual = (other: unknown) => hash(this) === hash(other);
}
