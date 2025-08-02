import { AliasPredications } from '../AliasPredication';
import { Expressions } from '../Expressions';
import { OrderPredications } from '../OrderPredications';
import { Predications } from '../Predications';
import { hash } from '../utilities/hash';
import { isArelNode } from '../utilities/isArelNode';
import { FragmentsNode } from './Fragments';

type SqlLiteralNodeOptions = {
  retryable?: boolean;
};

type CoderType = any;
type AddOtherType = any;

export class SqlLiteralNode extends OrderPredications(Predications(Expressions(AliasPredications(String)))) {
  public readonly retryable: boolean;

  constructor(value: string, options: SqlLiteralNodeOptions = { retryable: false }) {
    super(value);
    this.retryable = options.retryable ?? false;
  }

  add = (other: AddOtherType) => {
    if (!isArelNode(other)) throw new Error('Expected arel node');

    return new FragmentsNode([this, other]);
  };
  encodeWith = (coder: CoderType) => {
    coder.scalar = this.toString();
  };
  fetchAttribute = () => null;
  hash = () => hash(this.toString());
  isEqual = (other: any) => hash(this) === hash(other);
}
