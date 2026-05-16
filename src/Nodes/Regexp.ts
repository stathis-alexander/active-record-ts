import type { Expression } from '../types';
import { BinaryNode } from './Binary';

type RegexpOptions = {
  caseSensitive?: boolean;
};

export class RegexpNode extends BinaryNode {
  public caseSensitive: boolean;

  constructor(left: Expression, right: Expression, options: RegexpOptions = { caseSensitive: true }) {
    super(left, right);
    this.caseSensitive = options.caseSensitive ?? true;
  }
}

export class NotRegexpNode extends RegexpNode {}
